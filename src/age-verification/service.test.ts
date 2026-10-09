import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signUp } from "@/auth/service";
import { ageVerifications, auditLog, users } from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import type { AgeVerifier } from "./provider";
import { beginAgeVerification, completeAgeVerification } from "./service";
import { StubAgeVerifier } from "./stub";

let t: Awaited<ReturnType<typeof createTestDb>>;
let userId: string;
let otherUserId: string;
beforeAll(async () => {
  t = await createTestDb();
  const a = await signUp(t.db, {
    email: "a@example.com",
    password: "a-long-enough-password",
    handle: "alpha",
  });
  const b = await signUp(t.db, {
    email: "b@example.com",
    password: "a-long-enough-password",
    handle: "bravo",
  });
  if (!a.ok || a.existing || !b.ok || b.existing) throw new Error("setup");
  userId = a.userId;
  otherUserId = b.userId;
});
afterAll(async () => {
  await t.close();
});

const RETURN = "https://members.example/verify-age/callback";

describe("StubAgeVerifier", () => {
  it("refuses to start when not allowed (production default)", async () => {
    await expect(
      new StubAgeVerifier(false).start({ userId, verificationId: "x", returnUrl: RETURN }),
    ).rejects.toThrow(/not configured/);
  });
  it("points at the internal stub page when allowed", async () => {
    const r = await new StubAgeVerifier(true).start({
      userId,
      verificationId: "abc",
      returnUrl: RETURN,
    });
    expect(r.redirectUrl).toBe("https://members.example/verify-age/stub?v=abc");
  });
});

describe("beginAgeVerification / completeAgeVerification", () => {
  it("records a pending attempt and a failed outcome leaves the user unverified", async () => {
    const begin = await beginAgeVerification(t.db, new StubAgeVerifier(true), userId, RETURN);
    expect(begin.ok).toBe(true);
    if (!begin.ok) return;
    const row = await t.db.query.ageVerifications.findFirst({
      where: eq(ageVerifications.id, begin.verificationId),
    });
    expect(row?.status).toBe("pending");
    expect(row?.providerRef).toBe(`stub-${begin.verificationId}`);

    const done = await completeAgeVerification(t.db, {
      verificationId: begin.verificationId,
      userId,
      outcome: "failed",
    });
    expect(done).toEqual({ ok: true, outcome: "failed" });
    const u = await t.db.query.users.findFirst({ where: eq(users.id, userId) });
    expect(u?.ageVerifiedAt).toBeNull();
    expect(
      await completeAgeVerification(t.db, {
        verificationId: begin.verificationId,
        userId,
        outcome: "passed",
      }),
    ).toEqual({
      ok: false,
      error: "not_pending",
    });
  });

  it("a callback for another user's attempt is rejected", async () => {
    const begin = await beginAgeVerification(t.db, new StubAgeVerifier(true), userId, RETURN);
    if (!begin.ok) throw new Error("setup");
    expect(
      await completeAgeVerification(t.db, {
        verificationId: begin.verificationId,
        userId: otherUserId,
        outcome: "passed",
      }),
    ).toEqual({ ok: false, error: "not_found" });
    const u = await t.db.query.users.findFirst({ where: eq(users.id, otherUserId) });
    expect(u?.ageVerifiedAt).toBeNull();
  });

  it("a pass sets ageVerifiedAt with provider and reference, and metadata is scrubbed", async () => {
    const begin = await beginAgeVerification(t.db, new StubAgeVerifier(true), userId, RETURN);
    if (!begin.ok) throw new Error("setup");
    const done = await completeAgeVerification(t.db, {
      verificationId: begin.verificationId,
      userId,
      outcome: "passed",
      metadata: { method: "doc", document_number: "X123", email: "a@example.com" },
    });
    expect(done).toEqual({ ok: true, outcome: "passed" });
    const u = await t.db.query.users.findFirst({ where: eq(users.id, userId) });
    expect(u?.ageVerifiedAt).toBeInstanceOf(Date);
    expect(u?.ageVerificationProvider).toBe("stub");
    expect(u?.ageVerificationRef).toBe(`stub-${begin.verificationId}`);
    const row = await t.db.query.ageVerifications.findFirst({
      where: eq(ageVerifications.id, begin.verificationId),
    });
    expect(row?.metadata).toEqual({
      method: "doc",
      document_number: "[REDACTED]",
      email: "a***@example.com",
    });
    // Starting again is refused once verified.
    expect(await beginAgeVerification(t.db, new StubAgeVerifier(true), userId, RETURN)).toEqual({
      ok: false,
      error: "already_verified",
    });
  });

  it("marks the attempt failed when the provider cannot start", async () => {
    const broken: AgeVerifier = {
      name: "broken",
      start: async () => {
        throw new Error("vendor down");
      },
    };
    const r = await beginAgeVerification(t.db, broken, otherUserId, RETURN);
    expect(r).toEqual({ ok: false, error: "provider_unavailable" });
    const rows = await t.db.query.ageVerifications.findMany({
      where: eq(ageVerifications.userId, otherUserId),
    });
    expect(rows.at(-1)?.status).toBe("failed");
  });

  it("writes audit rows for start and outcome", async () => {
    const rows = await t.db.select({ action: auditLog.action }).from(auditLog);
    const actions = rows.map((r) => r.action);
    expect(actions).toContain("age_verification.started");
    expect(actions).toContain("age_verification.passed");
    expect(actions).toContain("age_verification.failed");
  });
});
