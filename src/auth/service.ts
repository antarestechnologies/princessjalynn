import { and, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { authTokens, sessions, users } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { dummyPasswordHash, hashPassword, randomToken, sha256, verifyPassword } from "@/lib/crypto";
import { recordAudit } from "./audit";
import type { SignUpInput } from "./schemas";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export interface RequestMeta {
  ipPrefix?: string | null;
  userAgent?: string | null;
}

export type SessionUser = typeof users.$inferSelect;

// ---------- sign up ----------
export type SignUpResult =
  | { ok: true; existing: false; userId: string; verifyToken: string }
  /** Email already registered: caller sends a "you already have an account" email instead. */
  | { ok: true; existing: true; userId: string }
  | { ok: false; error: "handle_taken" };

export async function signUp(
  db: AppDb,
  input: SignUpInput,
  meta: RequestMeta = {},
): Promise<SignUpResult> {
  const existing = await db.query.users.findFirst({
    where: sql`lower(${users.email}) = ${input.email.toLowerCase()}`,
    columns: { id: true },
  });
  if (existing) {
    await recordAudit(db, {
      action: "auth.signup.duplicate_email",
      targetType: "user",
      targetId: existing.id,
      ipPrefix: meta.ipPrefix,
    });
    return { ok: true, existing: true, userId: existing.id };
  }

  const handleTaken = await db.query.users.findFirst({
    where: sql`lower(${users.handle}) = ${input.handle.toLowerCase()}`,
    columns: { id: true },
  });
  if (handleTaken) return { ok: false, error: "handle_taken" };

  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(users)
    .values({ email: input.email, handle: input.handle, passwordHash })
    .returning({ id: users.id });

  const verifyToken = await createToken(db, user.id, "email_verify", EMAIL_VERIFY_TTL_MS);
  await recordAudit(db, {
    actorUserId: user.id,
    action: "auth.signup",
    targetType: "user",
    targetId: user.id,
    ipPrefix: meta.ipPrefix,
  });
  return { ok: true, existing: false, userId: user.id, verifyToken };
}

// ---------- one-time tokens ----------
type TokenKind = (typeof authTokens.$inferSelect)["kind"];

async function createToken(
  db: AppDb,
  userId: string,
  kind: TokenKind,
  ttlMs: number,
): Promise<string> {
  // Invalidate earlier unused tokens of the same kind so only the newest link works.
  await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(eq(authTokens.userId, userId), eq(authTokens.kind, kind), isNull(authTokens.usedAt)),
    );
  const raw = randomToken();
  await db.insert(authTokens).values({
    userId,
    kind,
    tokenHash: sha256(raw),
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return raw;
}

export type TokenError = "invalid" | "expired" | "used";

async function consumeToken(
  db: AppDb,
  raw: string,
  kind: TokenKind,
  now = new Date(),
): Promise<{ ok: true; userId: string } | { ok: false; error: TokenError }> {
  if (!raw || raw.length > 200) return { ok: false, error: "invalid" };
  const row = await db.query.authTokens.findFirst({
    where: and(eq(authTokens.tokenHash, sha256(raw)), eq(authTokens.kind, kind)),
  });
  if (!row) return { ok: false, error: "invalid" };
  if (row.usedAt) return { ok: false, error: "used" };
  if (row.expiresAt.getTime() <= now.getTime()) return { ok: false, error: "expired" };
  // Mark used atomically; if two requests race, only one sees a row updated.
  const updated = await db
    .update(authTokens)
    .set({ usedAt: now })
    .where(and(eq(authTokens.id, row.id), isNull(authTokens.usedAt)))
    .returning({ id: authTokens.id });
  if (updated.length === 0) return { ok: false, error: "used" };
  return { ok: true, userId: row.userId };
}

export async function createEmailVerificationToken(db: AppDb, userId: string): Promise<string> {
  return createToken(db, userId, "email_verify", EMAIL_VERIFY_TTL_MS);
}

export async function verifyEmail(db: AppDb, raw: string, now = new Date()) {
  const result = await consumeToken(db, raw, "email_verify", now);
  if (!result.ok) return result;
  await db
    .update(users)
    .set({ emailVerifiedAt: now, updatedAt: now })
    .where(and(eq(users.id, result.userId), isNull(users.emailVerifiedAt)));
  await recordAudit(db, {
    actorUserId: result.userId,
    action: "auth.email_verified",
    targetType: "user",
    targetId: result.userId,
  });
  return result;
}

// ---------- sign in / sessions ----------
export type SignInResult =
  | { ok: true; sessionToken: string; expiresAt: Date; user: SessionUser }
  | { ok: false; error: "invalid_credentials" | "suspended" };

export async function signIn(
  db: AppDb,
  input: { email: string; password: string },
  meta: RequestMeta = {},
): Promise<SignInResult> {
  const user = await db.query.users.findFirst({
    where: sql`lower(${users.email}) = ${input.email.toLowerCase()}`,
  });
  // Always run one password verification so timing does not reveal whether the email exists.
  const hash = user?.passwordHash ?? (await dummyPasswordHash());
  const valid = await verifyPassword(input.password, hash);
  if (!user || !valid || user.deletedAt) {
    await recordAudit(db, {
      action: "auth.login.failed",
      targetType: "user",
      targetId: user?.id ?? null,
      ipPrefix: meta.ipPrefix,
    });
    return { ok: false, error: "invalid_credentials" };
  }
  if (user.status !== "active") {
    await recordAudit(db, {
      actorUserId: user.id,
      action: "auth.login.blocked",
      targetType: "user",
      targetId: user.id,
      metadata: { status: user.status },
      ipPrefix: meta.ipPrefix,
    });
    return { ok: false, error: "suspended" };
  }
  const { token, expiresAt } = await createSession(db, user.id, meta);
  await recordAudit(db, {
    actorUserId: user.id,
    action: "auth.login",
    targetType: "user",
    targetId: user.id,
    ipPrefix: meta.ipPrefix,
  });
  return { ok: true, sessionToken: token, expiresAt, user };
}

export async function createSession(db: AppDb, userId: string, meta: RequestMeta = {}) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    userId,
    tokenHash: sha256(token),
    expiresAt,
    ipPrefix: meta.ipPrefix ?? null,
    userAgent: meta.userAgent ?? null,
  });
  return { token, expiresAt };
}

export interface SessionLookup {
  user: SessionUser;
  session: typeof sessions.$inferSelect;
}

export async function getSessionUser(db: AppDb, rawToken: string | undefined, now = new Date()) {
  if (!rawToken || rawToken.length > 200) return null;
  const row = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(rawToken)), gt(sessions.expiresAt, now)))
    .limit(1);
  const found = row[0];
  if (!found) return null;
  if (found.user.status !== "active" || found.user.deletedAt) return null;
  // Touch last_seen at most once per 5 minutes to keep writes low.
  if (now.getTime() - found.session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, found.session.id));
  }
  return found satisfies SessionLookup;
}

export async function signOut(db: AppDb, rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, sha256(rawToken)));
}

export async function revokeAllSessions(db: AppDb, userId: string, exceptSessionId?: string) {
  const where = exceptSessionId
    ? and(eq(sessions.userId, userId), ne(sessions.id, exceptSessionId))
    : eq(sessions.userId, userId);
  await db.delete(sessions).where(where);
}

// ---------- password reset ----------
/** Returns a token only when the account exists; the caller must respond identically either way. */
export async function requestPasswordReset(db: AppDb, email: string, meta: RequestMeta = {}) {
  const user = await db.query.users.findFirst({
    where: sql`lower(${users.email}) = ${email.toLowerCase()}`,
    columns: { id: true, email: true, status: true, deletedAt: true },
  });
  if (!user || user.deletedAt || user.status !== "active") return null;
  const token = await createToken(db, user.id, "password_reset", PASSWORD_RESET_TTL_MS);
  await recordAudit(db, {
    actorUserId: user.id,
    action: "auth.password_reset.requested",
    targetType: "user",
    targetId: user.id,
    ipPrefix: meta.ipPrefix,
  });
  return { token, userId: user.id, email: user.email };
}

export async function resetPassword(
  db: AppDb,
  raw: string,
  newPassword: string,
  meta: RequestMeta = {},
) {
  const result = await consumeToken(db, raw, "password_reset");
  if (!result.ok) return result;
  const passwordHash = await hashPassword(newPassword);
  const now = new Date();
  await db
    .update(users)
    .set({
      passwordHash,
      updatedAt: now,
      emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, ${now})`,
    })
    .where(eq(users.id, result.userId));
  // Every existing session is invalidated: the reset may be recovering from a compromise.
  await revokeAllSessions(db, result.userId);
  await recordAudit(db, {
    actorUserId: result.userId,
    action: "auth.password_reset.completed",
    targetType: "user",
    targetId: result.userId,
    ipPrefix: meta.ipPrefix,
  });
  return result;
}
