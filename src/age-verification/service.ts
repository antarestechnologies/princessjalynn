import { and, eq, isNull } from "drizzle-orm";
import { ageVerifications, users } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { recordAudit } from "@/auth/audit";
import { scrub } from "@/lib/logger";
import type { AgeVerificationOutcome, AgeVerifier } from "./provider";

export type BeginResult =
  | { ok: true; redirectUrl: string; verificationId: string }
  | { ok: false; error: "already_verified" | "provider_unavailable" };

export async function beginAgeVerification(
  db: AppDb,
  verifier: AgeVerifier,
  userId: string,
  returnUrl: string,
  meta: { ipPrefix?: string | null } = {},
): Promise<BeginResult> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { ageVerifiedAt: true },
  });
  if (user?.ageVerifiedAt) return { ok: false, error: "already_verified" };

  // Expire any dangling pending attempt so there is one live attempt per user.
  await db
    .update(ageVerifications)
    .set({ status: "expired", completedAt: new Date() })
    .where(and(eq(ageVerifications.userId, userId), eq(ageVerifications.status, "pending")));

  const [row] = await db
    .insert(ageVerifications)
    .values({ userId, provider: verifier.name })
    .returning({ id: ageVerifications.id });

  let started: Awaited<ReturnType<AgeVerifier["start"]>>;
  try {
    started = await verifier.start({ userId, verificationId: row.id, returnUrl });
  } catch {
    await db
      .update(ageVerifications)
      .set({
        status: "failed",
        completedAt: new Date(),
        metadata: { reason: "provider_start_failed" },
      })
      .where(eq(ageVerifications.id, row.id));
    return { ok: false, error: "provider_unavailable" };
  }

  if (started.providerRef) {
    await db
      .update(ageVerifications)
      .set({ providerRef: started.providerRef })
      .where(eq(ageVerifications.id, row.id));
  }
  await recordAudit(db, {
    actorUserId: userId,
    action: "age_verification.started",
    targetType: "age_verification",
    targetId: row.id,
    metadata: { provider: verifier.name },
    ipPrefix: meta.ipPrefix,
  });
  return { ok: true, redirectUrl: started.redirectUrl, verificationId: row.id };
}

export type CompleteResult =
  { ok: true; outcome: AgeVerificationOutcome } | { ok: false; error: "not_found" | "not_pending" };

/**
 * Called by the adapter's callback/webhook handler once the vendor has an outcome.
 * `userId` must match the attempt: a callback cannot verify someone else's account.
 */
export async function completeAgeVerification(
  db: AppDb,
  input: {
    verificationId: string;
    userId: string;
    outcome: AgeVerificationOutcome;
    providerRef?: string | null;
    /** Non-identifying vendor detail only (method, reason code). Scrubbed anyway. */
    metadata?: Record<string, unknown>;
  },
  now = new Date(),
): Promise<CompleteResult> {
  const row = await db.query.ageVerifications.findFirst({
    where: and(
      eq(ageVerifications.id, input.verificationId),
      eq(ageVerifications.userId, input.userId),
    ),
  });
  if (!row) return { ok: false, error: "not_found" };
  if (row.status !== "pending") return { ok: false, error: "not_pending" };

  const updated = await db
    .update(ageVerifications)
    .set({
      status: input.outcome,
      completedAt: now,
      providerRef: input.providerRef ?? row.providerRef,
      metadata: input.metadata ? (scrub(input.metadata) as Record<string, unknown>) : row.metadata,
    })
    .where(and(eq(ageVerifications.id, row.id), eq(ageVerifications.status, "pending")))
    .returning({ id: ageVerifications.id });
  if (updated.length === 0) return { ok: false, error: "not_pending" };

  if (input.outcome === "passed") {
    await db
      .update(users)
      .set({
        ageVerifiedAt: now,
        ageVerificationProvider: row.provider,
        ageVerificationRef: input.providerRef ?? row.providerRef,
        updatedAt: now,
      })
      .where(and(eq(users.id, input.userId), isNull(users.ageVerifiedAt)));
  }
  await recordAudit(db, {
    actorUserId: input.userId,
    action: `age_verification.${input.outcome}`,
    targetType: "age_verification",
    targetId: row.id,
    metadata: { provider: row.provider },
  });
  return { ok: true, outcome: input.outcome };
}
