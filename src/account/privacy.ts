import { randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { recordAudit } from "@/auth/audit";
import {
  ageVerifications,
  authTokens,
  checkoutSessions,
  entitlements,
  playbackGrants,
  purchases,
  sessions,
  subscriptionPayments,
  subscriptions,
  tips,
  users,
} from "@/db/schema";
import type { AppDb } from "@/db/types";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { findActiveSubscription } from "@/payments/service";
import type { PaymentProcessor } from "@/payments/types";

/**
 * Fan privacy rights (PLAN.md Phase 6): export everything held about the account, and delete
 * the account. Deletion anonymises rather than hard-deletes, because payment and leak-tracing
 * records may have legal retention requirements; the attorney sets those periods.
 */

export async function exportAccountData(
  db: AppDb,
  userId: string,
  meta: { ipPrefix?: string | null } = {},
) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return null;
  const subs = await db.query.subscriptions.findMany({ where: eq(subscriptions.userId, userId) });
  const subIds = subs.map((s) => s.id);
  const [sess, subPays, ppv, tipRows, ents, grants, checkouts, ageChecks] = await Promise.all([
    db
      .select({
        createdAt: sessions.createdAt,
        lastSeenAt: sessions.lastSeenAt,
        expiresAt: sessions.expiresAt,
        ipPrefix: sessions.ipPrefix,
        userAgent: sessions.userAgent,
      })
      .from(sessions)
      .where(eq(sessions.userId, userId)),
    Promise.all(
      subIds.map((id) =>
        db.query.subscriptionPayments.findMany({
          where: eq(subscriptionPayments.subscriptionId, id),
        }),
      ),
    ).then((x) => x.flat()),
    db.query.purchases.findMany({ where: eq(purchases.userId, userId) }),
    db.query.tips.findMany({ where: eq(tips.userId, userId) }),
    db.query.entitlements.findMany({ where: eq(entitlements.userId, userId) }),
    db
      .select({
        mediaId: playbackGrants.mediaId,
        issuedAt: playbackGrants.issuedAt,
        expiresAt: playbackGrants.expiresAt,
        ipPrefix: playbackGrants.ipPrefix,
      })
      .from(playbackGrants)
      .where(eq(playbackGrants.userId, userId))
      .orderBy(desc(playbackGrants.issuedAt)),
    db.query.checkoutSessions.findMany({ where: eq(checkoutSessions.userId, userId) }),
    db
      .select({
        provider: ageVerifications.provider,
        status: ageVerifications.status,
        startedAt: ageVerifications.startedAt,
        completedAt: ageVerifications.completedAt,
      })
      .from(ageVerifications)
      .where(eq(ageVerifications.userId, userId)),
  ]);
  await recordAudit(db, {
    actorUserId: userId,
    action: "account.export",
    targetType: "user",
    targetId: userId,
    ipPrefix: meta.ipPrefix,
  });
  return {
    exportedAt: new Date().toISOString(),
    notice:
      "Everything this site stores about your account. Card details are held only by the payment processor. ID checks were done by the age-verification provider; we store only the outcome.",
    account: {
      id: user.id,
      email: user.email,
      handle: user.handle,
      createdAt: user.createdAt,
      emailVerifiedAt: user.emailVerifiedAt,
      ageAttestedAt: user.ageAttestedAt,
      ageVerifiedAt: user.ageVerifiedAt,
      ageVerificationProvider: user.ageVerificationProvider,
      status: user.status,
    },
    sessions: sess,
    subscriptions: subs.map(({ processorCustomerId: _c, ...s }) => s),
    subscriptionPayments: subPays,
    purchases: ppv,
    tips: tipRows,
    entitlements: ents,
    viewingGrants: grants,
    checkouts,
    ageVerificationAttempts: ageChecks,
  };
}

export type DeleteResult =
  | { ok: true }
  | { ok: false; error: "bad_password" | "admin_account" | "not_found" | "processor_error" };

export async function deleteAccount(
  db: AppDb,
  processor: PaymentProcessor,
  input: { userId: string; password: string },
  meta: { ipPrefix?: string | null } = {},
  now = new Date(),
): Promise<DeleteResult> {
  const user = await db.query.users.findFirst({ where: eq(users.id, input.userId) });
  if (!user || user.deletedAt) return { ok: false, error: "not_found" };
  if (user.role === "admin") return { ok: false, error: "admin_account" };
  if (!(await verifyPassword(input.password, user.passwordHash))) {
    await recordAudit(db, {
      actorUserId: user.id,
      action: "account.delete.bad_password",
      targetType: "user",
      targetId: user.id,
      ipPrefix: meta.ipPrefix,
    });
    return { ok: false, error: "bad_password" };
  }

  // Stop billing first. If the processor cannot be reached, do not delete: a deleted account
  // that keeps getting charged is the worst outcome (and a chargeback).
  const sub = await findActiveSubscription(db, user.id, now);
  if (sub && sub.status !== "canceled") {
    try {
      await processor.cancelSubscription(sub.processorSubscriptionId);
    } catch {
      return { ok: false, error: "processor_error" };
    }
  }

  const tag = user.id.slice(0, 8);
  await db
    .update(users)
    .set({
      email: `deleted+${user.id}@invalid.invalid`,
      handle: `deleted_${tag}`,
      passwordHash: await hashPassword(randomBytes(32).toString("base64url")),
      status: "deleted",
      deletedAt: now,
      ageVerificationRef: null,
      updatedAt: now,
    })
    .where(eq(users.id, user.id));
  await db.delete(sessions).where(eq(sessions.userId, user.id));
  await db.delete(authTokens).where(eq(authTokens.userId, user.id));
  await db
    .update(entitlements)
    .set({ revokedAt: now, revokeReason: "account_deleted", updatedAt: now })
    .where(and(eq(entitlements.userId, user.id), isNull(entitlements.revokedAt)));
  await db
    .update(checkoutSessions)
    .set({ status: "abandoned" })
    .where(and(eq(checkoutSessions.userId, user.id), eq(checkoutSessions.status, "pending")));
  await recordAudit(db, {
    actorUserId: user.id,
    action: "account.delete",
    targetType: "user",
    targetId: user.id,
    ipPrefix: meta.ipPrefix,
  });
  return { ok: true };
}
