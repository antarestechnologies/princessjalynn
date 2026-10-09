import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditLog, authTokens, sessions, users } from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import {
  createSession,
  getSessionUser,
  requestPasswordReset,
  resetPassword,
  revokeAllSessions,
  signIn,
  signOut,
  signUp,
  verifyEmail,
} from "./service";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const PW = "a-long-enough-password";

describe("signUp", () => {
  it("creates an unverified user and a verification token", async () => {
    const r = await signUp(t.db, { email: "Fan@Example.com", password: PW, handle: "fan_one" });
    expect(r.ok && !r.existing).toBe(true);
    if (!r.ok || r.existing) return;
    const u = await t.db.query.users.findFirst({ where: eq(users.id, r.userId) });
    expect(u?.email).toBe("Fan@Example.com");
    expect(u?.emailVerifiedAt).toBeNull();
    expect(u?.passwordHash).not.toContain(PW);
    expect(r.verifyToken.length).toBeGreaterThan(30);
    const tokens = await t.db.query.authTokens.findMany({ where: eq(authTokens.userId, r.userId) });
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenHash).not.toBe(r.verifyToken);
  });

  it("reports an existing email as existing (case-insensitively) without creating a user", async () => {
    const before = await t.db.execute<{ n: number }>(sql`select count(*)::int as n from users`);
    const r = await signUp(t.db, {
      email: "FAN@example.COM",
      password: PW,
      handle: "someone_else",
    });
    expect(r).toMatchObject({ ok: true, existing: true });
    const after = await t.db.execute<{ n: number }>(sql`select count(*)::int as n from users`);
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it("rejects a taken handle case-insensitively", async () => {
    const r = await signUp(t.db, { email: "other@example.com", password: PW, handle: "FAN_ONE" });
    expect(r).toEqual({ ok: false, error: "handle_taken" });
  });
});

describe("verifyEmail", () => {
  it("accepts a token once, then reports it used; rejects garbage and expired tokens", async () => {
    const r = await signUp(t.db, { email: "v@example.com", password: PW, handle: "verifier" });
    if (!r.ok || r.existing) throw new Error("setup");
    expect(await verifyEmail(t.db, "not-a-token")).toEqual({ ok: false, error: "invalid" });
    const late = new Date(Date.now() + 25 * 3600 * 1000);
    expect(await verifyEmail(t.db, r.verifyToken, late)).toEqual({ ok: false, error: "expired" });
    expect(await verifyEmail(t.db, r.verifyToken)).toEqual({ ok: true, userId: r.userId });
    expect(await verifyEmail(t.db, r.verifyToken)).toEqual({ ok: false, error: "used" });
    const u = await t.db.query.users.findFirst({ where: eq(users.id, r.userId) });
    expect(u?.emailVerifiedAt).toBeInstanceOf(Date);
  });
});

describe("signIn / sessions", () => {
  it("rejects wrong passwords and unknown emails identically", async () => {
    const a = await signIn(t.db, { email: "fan@example.com", password: "wrong-password-here" });
    const b = await signIn(t.db, { email: "nobody@example.com", password: "wrong-password-here" });
    expect(a).toEqual({ ok: false, error: "invalid_credentials" });
    expect(b).toEqual({ ok: false, error: "invalid_credentials" });
  });

  it("creates a session that resolves to the user and dies on sign-out", async () => {
    const r = await signIn(
      t.db,
      { email: "fan@example.com", password: PW },
      { ipPrefix: "203.0.113.0/24" },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const found = await getSessionUser(t.db, r.sessionToken);
    expect(found?.user.handle).toBe("fan_one");
    expect(found?.session.ipPrefix).toBe("203.0.113.0/24");
    expect(await getSessionUser(t.db, r.sessionToken + "x")).toBeNull();
    expect(await getSessionUser(t.db, undefined)).toBeNull();
    await signOut(t.db, r.sessionToken);
    expect(await getSessionUser(t.db, r.sessionToken)).toBeNull();
  });

  it("does not resolve an expired session or a suspended user", async () => {
    const u = await t.db.query.users.findFirst({ where: eq(users.handle, "fan_one") });
    const s = await createSession(t.db, u!.id);
    expect(await getSessionUser(t.db, s.token, new Date(s.expiresAt.getTime() + 1000))).toBeNull();
    await t.db.update(users).set({ status: "suspended" }).where(eq(users.id, u!.id));
    expect(await getSessionUser(t.db, s.token)).toBeNull();
    expect(await signIn(t.db, { email: "fan@example.com", password: PW })).toEqual({
      ok: false,
      error: "suspended",
    });
    await t.db.update(users).set({ status: "active" }).where(eq(users.id, u!.id));
  });

  it("revokeAllSessions keeps only the excepted session", async () => {
    const u = await t.db.query.users.findFirst({ where: eq(users.handle, "fan_one") });
    const a = await createSession(t.db, u!.id);
    const b = await createSession(t.db, u!.id);
    const keep = await getSessionUser(t.db, a.token);
    await revokeAllSessions(t.db, u!.id, keep!.session.id);
    expect(await getSessionUser(t.db, a.token)).not.toBeNull();
    expect(await getSessionUser(t.db, b.token)).toBeNull();
  });
});

describe("password reset", () => {
  it("returns nothing for unknown emails and a token for known ones", async () => {
    expect(await requestPasswordReset(t.db, "nobody@example.com")).toBeNull();
    const r = await requestPasswordReset(t.db, "FAN@example.com");
    expect(r?.email).toBe("Fan@Example.com");
    expect(r?.token.length).toBeGreaterThan(30);
  });

  it("only the newest reset token works, and a reset revokes every session", async () => {
    const u = await t.db.query.users.findFirst({ where: eq(users.handle, "fan_one") });
    const live = await createSession(t.db, u!.id);
    const first = await requestPasswordReset(t.db, "fan@example.com");
    const second = await requestPasswordReset(t.db, "fan@example.com");
    expect(await resetPassword(t.db, first!.token, "brand-new-password-1")).toEqual({
      ok: false,
      error: "used",
    });
    expect(await resetPassword(t.db, second!.token, "brand-new-password-1")).toEqual({
      ok: true,
      userId: u!.id,
    });
    expect(await resetPassword(t.db, second!.token, "brand-new-password-2")).toEqual({
      ok: false,
      error: "used",
    });
    expect(await getSessionUser(t.db, live.token)).toBeNull();
    const remaining = await t.db.query.sessions.findMany({ where: eq(sessions.userId, u!.id) });
    expect(remaining).toHaveLength(0);
    expect((await signIn(t.db, { email: "fan@example.com", password: PW })).ok).toBe(false);
    expect(
      (await signIn(t.db, { email: "fan@example.com", password: "brand-new-password-1" })).ok,
    ).toBe(true);
  });
});

describe("audit trail", () => {
  it("records the auth events without PII", async () => {
    const rows = await t.db
      .select({ action: auditLog.action, metadata: auditLog.metadata })
      .from(auditLog);
    const actions = new Set(rows.map((r) => r.action));
    for (const a of [
      "auth.signup",
      "auth.signup.duplicate_email",
      "auth.email_verified",
      "auth.login",
      "auth.login.failed",
      "auth.login.blocked",
      "auth.password_reset.requested",
      "auth.password_reset.completed",
    ]) {
      expect(actions, a).toContain(a);
    }
    expect(JSON.stringify(rows)).not.toMatch(/example\.com/);
    expect(JSON.stringify(rows)).not.toContain(PW);
  });
});
