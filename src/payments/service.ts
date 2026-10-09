import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { recordAudit } from "@/auth/audit";
import {
  checkoutSessions,
  entitlements,
  posts,
  purchases,
  subscriptionPayments,
  subscriptions,
  tips,
  users,
  webhookEvents,
} from "@/db/schema";
import type { AppDb } from "@/db/types";
import { scrub } from "@/lib/logger";
import type { Mailer } from "@/lib/mailer";
import { receiptEmail, accessRevokedEmail, renewalFailedEmail } from "./emails";
import type { CheckoutKind, NormalizedEvent, PaymentProcessor } from "./types";

export interface PaymentConfig {
  subscriptionPriceCents: number;
  currency: string;
  billingDescriptor: string;
  gracePeriodDays: number;
  appUrl: string;
}

export interface PaymentDeps {
  mailer: Mailer;
  config: PaymentConfig;
  /** Injectable clock; defaults to wall time. Tests move it to walk billing periods. */
  now?: () => Date;
}

const clockOf = (deps: PaymentDeps) => (deps.now ? deps.now() : new Date());

type User = typeof users.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;

export const MIN_TIP_CENTS = 100;
export const MAX_TIP_CENTS = 50_000;

// ---------- checkout ----------
export type StartCheckoutResult =
  | { ok: true; redirectUrl: string; checkoutId: string }
  | {
      ok: false;
      error:
        | "already_subscribed"
        | "already_purchased"
        | "post_not_ppv"
        | "bad_amount"
        | "processor_error";
    };

export async function startCheckout(
  db: AppDb,
  processor: PaymentProcessor,
  deps: PaymentDeps,
  input: { user: User; kind: CheckoutKind; postId?: string; amountCents?: number },
): Promise<StartCheckoutResult> {
  const { user, kind } = input;
  let amountCents: number;
  let description: string;
  let postId: string | null = null;

  if (kind === "subscription") {
    if (await findActiveSubscription(db, user.id, clockOf(deps)))
      return { ok: false, error: "already_subscribed" };
    amountCents = deps.config.subscriptionPriceCents;
    description = "Monthly membership";
  } else if (kind === "ppv") {
    const post = input.postId
      ? await db.query.posts.findFirst({ where: eq(posts.id, input.postId) })
      : null;
    if (!post || post.tier !== "ppv" || post.priceCents == null)
      return { ok: false, error: "post_not_ppv" };
    const owned = await db.query.entitlements.findFirst({
      where: and(
        eq(entitlements.userId, user.id),
        eq(entitlements.kind, "post"),
        eq(entitlements.postId, post.id),
        isNull(entitlements.revokedAt),
      ),
    });
    if (owned) return { ok: false, error: "already_purchased" };
    amountCents = post.priceCents;
    description = "Single item";
    postId = post.id;
  } else {
    const amt = input.amountCents ?? 0;
    if (!Number.isInteger(amt) || amt < MIN_TIP_CENTS || amt > MAX_TIP_CENTS)
      return { ok: false, error: "bad_amount" };
    amountCents = amt;
    description = "Tip";
    postId = input.postId ?? null;
  }

  const [checkout] = await db
    .insert(checkoutSessions)
    .values({
      userId: user.id,
      kind,
      postId,
      amountCents,
      currency: deps.config.currency,
      description,
      processor: processor.name,
    })
    .returning();

  try {
    const created = await processor.createCheckout({
      checkoutId: checkout.id,
      kind,
      userId: user.id,
      userRef: user.id,
      amountCents,
      currency: deps.config.currency,
      description,
      returnUrl: `${deps.config.appUrl}/checkout/return?c=${checkout.id}`,
      cancelUrl: `${deps.config.appUrl}/checkout/return?c=${checkout.id}&canceled=1`,
    });
    if (created.processorRef) {
      await db
        .update(checkoutSessions)
        .set({ processorRef: created.processorRef })
        .where(eq(checkoutSessions.id, checkout.id));
    }
    await recordAudit(db, {
      actorUserId: user.id,
      action: `checkout.start.${kind}`,
      targetType: "checkout",
      targetId: checkout.id,
      metadata: { amountCents },
    });
    return { ok: true, redirectUrl: created.redirectUrl, checkoutId: checkout.id };
  } catch {
    await db
      .update(checkoutSessions)
      .set({ status: "failed" })
      .where(eq(checkoutSessions.id, checkout.id));
    return { ok: false, error: "processor_error" };
  }
}

export async function findActiveSubscription(
  db: AppDb,
  userId: string,
  now = new Date(),
): Promise<Subscription | null> {
  const row = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.userId, userId),
      or(
        eq(subscriptions.status, "active"),
        eq(subscriptions.status, "past_due"),
        and(eq(subscriptions.status, "canceled"), gt(subscriptions.currentPeriodEnd, now)),
      ),
    ),
    orderBy: [desc(subscriptions.createdAt)],
  });
  return row ?? null;
}

export async function latestSubscription(db: AppDb, userId: string): Promise<Subscription | null> {
  const row = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
    orderBy: [desc(subscriptions.createdAt)],
  });
  return row ?? null;
}

// ---------- webhook ingest ----------
export type IngestResult = { applied: number; duplicates: number; failed: number };

/** Verify + apply. Throws WebhookSignatureError from the adapter when the signature is bad. */
export async function ingestWebhook(
  db: AppDb,
  processor: PaymentProcessor,
  deps: PaymentDeps,
  input: { headers: Headers; rawBody: string },
): Promise<IngestResult> {
  const events = await processor.parseWebhook(input);
  const result: IngestResult = { applied: 0, duplicates: 0, failed: 0 };
  for (const event of events) {
    const r = await processWebhookEvent(db, processor.name, deps, event, clockOf(deps));
    result[r === "applied" ? "applied" : r === "duplicate" ? "duplicates" : "failed"]++;
  }
  return result;
}

export async function processWebhookEvent(
  db: AppDb,
  processorName: string,
  deps: PaymentDeps,
  event: NormalizedEvent,
  now = clockOf(deps),
): Promise<"applied" | "duplicate" | "failed"> {
  // Idempotency: the unique (processor, eventId) index makes a replay a no-op.
  const inserted = await db
    .insert(webhookEvents)
    .values({
      processor: processorName,
      eventId: event.id,
      type: event.type,
      payload: scrub(event) as Record<string, unknown>,
    })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  if (inserted.length === 0) return "duplicate";
  const rowId = inserted[0].id;

  try {
    await applyEvent(db, processorName, deps, event, now);
    await db.update(webhookEvents).set({ processedAt: now }).where(eq(webhookEvents.id, rowId));
    return "applied";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(webhookEvents)
      .set({ processedAt: now, error: message.slice(0, 500) })
      .where(eq(webhookEvents.id, rowId));
    return "failed";
  }
}

async function applyEvent(
  db: AppDb,
  processorName: string,
  deps: PaymentDeps,
  event: NormalizedEvent,
  now: Date,
) {
  switch (event.type) {
    case "subscription.created":
      return onSubscriptionCreated(db, processorName, deps, event, now);
    case "subscription.renewed":
      return onSubscriptionRenewed(db, processorName, deps, event, now);
    case "subscription.renewal_failed":
      return onRenewalFailed(db, processorName, deps, event, now);
    case "subscription.canceled":
      return onCanceled(db, processorName, event, now);
    case "subscription.expired":
      return onExpired(db, processorName, event, now);
    case "purchase.completed":
      return onPurchaseCompleted(db, processorName, deps, event, now);
    case "payment.refunded":
      return onRefunded(db, processorName, deps, event, now);
    case "payment.chargeback":
      return onChargeback(db, processorName, deps, event, now);
  }
}

// ---------- entitlement helpers ----------
async function liveSubscriptionEntitlement(db: AppDb, subscriptionId: string) {
  return db.query.entitlements.findFirst({
    where: and(
      eq(entitlements.source, "subscription"),
      eq(entitlements.sourceId, subscriptionId),
      isNull(entitlements.revokedAt),
    ),
    orderBy: [desc(entitlements.createdAt)],
  });
}

async function setSubscriptionAccess(db: AppDb, sub: Subscription, startsAt: Date, endsAt: Date) {
  const live = await liveSubscriptionEntitlement(db, sub.id);
  if (live) {
    await db
      .update(entitlements)
      .set({ endsAt, updatedAt: new Date() })
      .where(eq(entitlements.id, live.id));
  } else {
    await db.insert(entitlements).values({
      userId: sub.userId,
      kind: "subscription",
      source: "subscription",
      sourceId: sub.id,
      startsAt,
      endsAt,
    });
  }
}

async function revokeSubscriptionAccess(db: AppDb, sub: Subscription, reason: string, now: Date) {
  await db
    .update(entitlements)
    .set({ revokedAt: now, revokeReason: reason, updatedAt: now })
    .where(
      and(
        eq(entitlements.source, "subscription"),
        eq(entitlements.sourceId, sub.id),
        isNull(entitlements.revokedAt),
      ),
    );
}

async function subByProcessorId(db: AppDb, processorName: string, processorSubscriptionId: string) {
  const sub = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.processor, processorName),
      eq(subscriptions.processorSubscriptionId, processorSubscriptionId),
    ),
  });
  if (!sub) throw new Error(`unknown subscription ${processorSubscriptionId}`);
  return sub;
}

async function userEmail(db: AppDb, userId: string) {
  const u = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { email: true, handle: true },
  });
  return u;
}

// ---------- handlers ----------
async function onSubscriptionCreated(
  db: AppDb,
  processorName: string,
  deps: PaymentDeps,
  e: Extract<NormalizedEvent, { type: "subscription.created" }>,
  now: Date,
) {
  const checkout = await db.query.checkoutSessions.findFirst({
    where: eq(checkoutSessions.id, e.data.checkoutId),
  });
  if (!checkout || checkout.kind !== "subscription")
    throw new Error("checkout not found or not a subscription");
  const periodStart = new Date(e.data.periodStart);
  const periodEnd = new Date(e.data.periodEnd);

  // Upsert by processor subscription id so a redelivered "created" (new event id) is harmless.
  const [sub] = await db
    .insert(subscriptions)
    .values({
      userId: checkout.userId,
      processor: processorName,
      processorSubscriptionId: e.data.processorSubscriptionId,
      processorCustomerId: e.data.processorCustomerId ?? null,
      status: "active",
      priceCents: e.data.amountCents,
      currency: e.data.currency,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    })
    .onConflictDoUpdate({
      target: [subscriptions.processor, subscriptions.processorSubscriptionId],
      set: {
        status: "active",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        graceUntil: null,
        updatedAt: now,
      },
    })
    .returning();

  await db
    .insert(subscriptionPayments)
    .values({
      subscriptionId: sub.id,
      processor: processorName,
      processorTransactionId: e.data.transactionId,
      amountCents: e.data.amountCents,
      currency: e.data.currency,
      periodStart,
      periodEnd,
    })
    .onConflictDoNothing();
  await setSubscriptionAccess(db, sub, periodStart, periodEnd);
  await db
    .update(checkoutSessions)
    .set({ status: "completed", completedAt: now })
    .where(eq(checkoutSessions.id, checkout.id));
  await recordAudit(db, {
    actorUserId: checkout.userId,
    action: "subscription.created",
    targetType: "subscription",
    targetId: sub.id,
    metadata: { amountCents: e.data.amountCents },
  });

  const u = await userEmail(db, checkout.userId);
  if (u)
    await deps.mailer.send(
      receiptEmail(u.email, {
        kind: "subscription",
        amountCents: e.data.amountCents,
        currency: e.data.currency,
        descriptor: deps.config.billingDescriptor,
        periodEnd,
        appUrl: deps.config.appUrl,
      }),
    );
}

async function onSubscriptionRenewed(
  db: AppDb,
  processorName: string,
  deps: PaymentDeps,
  e: Extract<NormalizedEvent, { type: "subscription.renewed" }>,
  now: Date,
) {
  const sub = await subByProcessorId(db, processorName, e.data.processorSubscriptionId);
  const periodStart = new Date(e.data.periodStart);
  const periodEnd = new Date(e.data.periodEnd);
  const [updated] = await db
    .update(subscriptions)
    .set({
      status: "active",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      graceUntil: null,
      updatedAt: now,
    })
    .where(eq(subscriptions.id, sub.id))
    .returning();
  await db
    .insert(subscriptionPayments)
    .values({
      subscriptionId: sub.id,
      processor: processorName,
      processorTransactionId: e.data.transactionId,
      amountCents: e.data.amountCents,
      currency: e.data.currency,
      periodStart,
      periodEnd,
    })
    .onConflictDoNothing();
  await setSubscriptionAccess(db, updated, periodStart, periodEnd);
  await recordAudit(db, {
    actorUserId: sub.userId,
    action: "subscription.renewed",
    targetType: "subscription",
    targetId: sub.id,
    metadata: { amountCents: e.data.amountCents },
  });
  const u = await userEmail(db, sub.userId);
  if (u)
    await deps.mailer.send(
      receiptEmail(u.email, {
        kind: "renewal",
        amountCents: e.data.amountCents,
        currency: e.data.currency,
        descriptor: deps.config.billingDescriptor,
        periodEnd,
        appUrl: deps.config.appUrl,
      }),
    );
}

async function onRenewalFailed(
  db: AppDb,
  processorName: string,
  deps: PaymentDeps,
  e: Extract<NormalizedEvent, { type: "subscription.renewal_failed" }>,
  now: Date,
) {
  const sub = await subByProcessorId(db, processorName, e.data.processorSubscriptionId);
  const base = sub.currentPeriodEnd.getTime() > now.getTime() ? sub.currentPeriodEnd : now;
  const graceUntil = new Date(base.getTime() + deps.config.gracePeriodDays * 24 * 3600 * 1000);
  const [updated] = await db
    .update(subscriptions)
    .set({ status: "past_due", graceUntil, updatedAt: now })
    .where(eq(subscriptions.id, sub.id))
    .returning();
  await setSubscriptionAccess(db, updated, sub.currentPeriodStart, graceUntil);
  await recordAudit(db, {
    actorUserId: sub.userId,
    action: "subscription.renewal_failed",
    targetType: "subscription",
    targetId: sub.id,
    metadata: { graceUntil: graceUntil.toISOString() },
  });
  const u = await userEmail(db, sub.userId);
  if (u)
    await deps.mailer.send(renewalFailedEmail(u.email, { graceUntil, appUrl: deps.config.appUrl }));
}

async function onCanceled(
  db: AppDb,
  processorName: string,
  e: Extract<NormalizedEvent, { type: "subscription.canceled" }>,
  now: Date,
) {
  const sub = await subByProcessorId(db, processorName, e.data.processorSubscriptionId);
  if (sub.status === "expired" || sub.status === "chargeback") return;
  const [updated] = await db
    .update(subscriptions)
    .set({ status: "canceled", canceledAt: now, updatedAt: now })
    .where(eq(subscriptions.id, sub.id))
    .returning();
  // Access runs to the end of what was paid for (or the grace window if a renewal had failed).
  const endsAt = updated.graceUntil ?? updated.currentPeriodEnd;
  if (endsAt.getTime() <= now.getTime())
    await revokeSubscriptionAccess(db, updated, "canceled", now);
  else await setSubscriptionAccess(db, updated, updated.currentPeriodStart, endsAt);
  await recordAudit(db, {
    actorUserId: sub.userId,
    action: "subscription.canceled",
    targetType: "subscription",
    targetId: sub.id,
  });
}

async function onExpired(
  db: AppDb,
  processorName: string,
  e: Extract<NormalizedEvent, { type: "subscription.expired" }>,
  now: Date,
) {
  const sub = await subByProcessorId(db, processorName, e.data.processorSubscriptionId);
  await db
    .update(subscriptions)
    .set({ status: "expired", updatedAt: now })
    .where(eq(subscriptions.id, sub.id));
  await revokeSubscriptionAccess(db, sub, "expired", now);
  await recordAudit(db, {
    actorUserId: sub.userId,
    action: "subscription.expired",
    targetType: "subscription",
    targetId: sub.id,
  });
}

async function onPurchaseCompleted(
  db: AppDb,
  processorName: string,
  deps: PaymentDeps,
  e: Extract<NormalizedEvent, { type: "purchase.completed" }>,
  now: Date,
) {
  const checkout = await db.query.checkoutSessions.findFirst({
    where: eq(checkoutSessions.id, e.data.checkoutId),
  });
  if (!checkout || checkout.kind === "subscription")
    throw new Error("checkout not found or wrong kind");
  const u = await userEmail(db, checkout.userId);

  if (checkout.kind === "ppv") {
    if (!checkout.postId) throw new Error("ppv checkout without post");
    const [purchase] = await db
      .insert(purchases)
      .values({
        userId: checkout.userId,
        postId: checkout.postId,
        processor: processorName,
        processorTransactionId: e.data.transactionId,
        amountCents: e.data.amountCents,
        currency: e.data.currency,
      })
      .onConflictDoNothing()
      .returning();
    if (purchase) {
      await db.insert(entitlements).values({
        userId: checkout.userId,
        kind: "post",
        postId: checkout.postId,
        source: "purchase",
        sourceId: purchase.id,
        startsAt: now,
        endsAt: null,
      });
      await recordAudit(db, {
        actorUserId: checkout.userId,
        action: "purchase.completed",
        targetType: "purchase",
        targetId: purchase.id,
        metadata: { postId: checkout.postId, amountCents: e.data.amountCents },
      });
      if (u)
        await deps.mailer.send(
          receiptEmail(u.email, {
            kind: "ppv",
            amountCents: e.data.amountCents,
            currency: e.data.currency,
            descriptor: deps.config.billingDescriptor,
            appUrl: deps.config.appUrl,
          }),
        );
    }
  } else {
    const [tip] = await db
      .insert(tips)
      .values({
        userId: checkout.userId,
        postId: checkout.postId,
        processor: processorName,
        processorTransactionId: e.data.transactionId,
        amountCents: e.data.amountCents,
        currency: e.data.currency,
      })
      .onConflictDoNothing()
      .returning();
    if (tip) {
      await recordAudit(db, {
        actorUserId: checkout.userId,
        action: "tip.completed",
        targetType: "tip",
        targetId: tip.id,
        metadata: { amountCents: e.data.amountCents },
      });
      if (u)
        await deps.mailer.send(
          receiptEmail(u.email, {
            kind: "tip",
            amountCents: e.data.amountCents,
            currency: e.data.currency,
            descriptor: deps.config.billingDescriptor,
            appUrl: deps.config.appUrl,
          }),
        );
    }
  }
  await db
    .update(checkoutSessions)
    .set({ status: "completed", completedAt: now })
    .where(eq(checkoutSessions.id, checkout.id));
}

/** Finds which ledger a transaction id belongs to. */
async function locateTransaction(db: AppDb, processorName: string, transactionId: string) {
  const sp = await db.query.subscriptionPayments.findFirst({
    where: and(
      eq(subscriptionPayments.processor, processorName),
      eq(subscriptionPayments.processorTransactionId, transactionId),
    ),
  });
  if (sp) return { kind: "subscription" as const, row: sp };
  const p = await db.query.purchases.findFirst({
    where: and(
      eq(purchases.processor, processorName),
      eq(purchases.processorTransactionId, transactionId),
    ),
  });
  if (p) return { kind: "ppv" as const, row: p };
  const t = await db.query.tips.findFirst({
    where: and(eq(tips.processor, processorName), eq(tips.processorTransactionId, transactionId)),
  });
  if (t) return { kind: "tip" as const, row: t };
  throw new Error(`unknown transaction ${transactionId}`);
}

async function reverseTransaction(
  db: AppDb,
  processorName: string,
  deps: PaymentDeps,
  transactionId: string,
  mode: "refunded" | "chargeback",
  now: Date,
) {
  const found = await locateTransaction(db, processorName, transactionId);
  let userId: string;
  if (found.kind === "subscription") {
    await db
      .update(subscriptionPayments)
      .set({ status: mode })
      .where(eq(subscriptionPayments.id, found.row.id));
    const sub = (await db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, found.row.subscriptionId),
    }))!;
    userId = sub.userId;
    // Money back means no access for the period that was reversed, and the membership ends.
    // A real adapter must also stop rebilling at the processor (most do so on refund).
    await db
      .update(subscriptions)
      .set({
        status: mode === "chargeback" ? "chargeback" : "expired",
        canceledAt: sub.canceledAt ?? now,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, sub.id));
    await revokeSubscriptionAccess(db, sub, mode, now);
  } else if (found.kind === "ppv") {
    await db
      .update(purchases)
      .set({ status: mode, updatedAt: now })
      .where(eq(purchases.id, found.row.id));
    userId = found.row.userId;
    await db
      .update(entitlements)
      .set({ revokedAt: now, revokeReason: mode, updatedAt: now })
      .where(
        and(
          eq(entitlements.source, "purchase"),
          eq(entitlements.sourceId, found.row.id),
          isNull(entitlements.revokedAt),
        ),
      );
  } else {
    await db.update(tips).set({ status: mode, updatedAt: now }).where(eq(tips.id, found.row.id));
    userId = found.row.userId;
  }
  return { userId, kind: found.kind };
}

async function onRefunded(
  db: AppDb,
  processorName: string,
  deps: PaymentDeps,
  e: Extract<NormalizedEvent, { type: "payment.refunded" }>,
  now: Date,
) {
  const r = await reverseTransaction(
    db,
    processorName,
    deps,
    e.data.transactionId,
    "refunded",
    now,
  );
  await recordAudit(db, {
    actorUserId: r.userId,
    action: "payment.refunded",
    targetType: "transaction",
    targetId: e.data.transactionId,
    metadata: { kind: r.kind },
  });
}

/**
 * Chargeback: reverse the transaction, revoke EVERY live entitlement for the account and
 * flag it for admin review. Processors terminate merchants over chargeback ratios, so the
 * account stays flagged until an admin clears it.
 */
async function onChargeback(
  db: AppDb,
  processorName: string,
  deps: PaymentDeps,
  e: Extract<NormalizedEvent, { type: "payment.chargeback" }>,
  now: Date,
) {
  const r = await reverseTransaction(
    db,
    processorName,
    deps,
    e.data.transactionId,
    "chargeback",
    now,
  );
  await db
    .update(entitlements)
    .set({ revokedAt: now, revokeReason: "chargeback", updatedAt: now })
    .where(and(eq(entitlements.userId, r.userId), isNull(entitlements.revokedAt)));
  await db.update(users).set({ flagged: true, updatedAt: now }).where(eq(users.id, r.userId));
  await recordAudit(db, {
    actorUserId: null,
    action: "payment.chargeback",
    targetType: "user",
    targetId: r.userId,
    metadata: { transactionId: e.data.transactionId, reasonCode: e.data.reasonCode },
  });
  const u = await userEmail(db, r.userId);
  if (u) await deps.mailer.send(accessRevokedEmail(u.email, { appUrl: deps.config.appUrl }));
}

// ---------- fan-facing ----------
export async function cancelOwnSubscription(
  db: AppDb,
  processor: PaymentProcessor,
  userId: string,
  now = new Date(),
): Promise<"ok" | "none"> {
  const sub = await findActiveSubscription(db, userId, now);
  if (!sub || sub.status === "canceled") return "none";
  await processor.cancelSubscription(sub.processorSubscriptionId);
  await recordAudit(db, {
    actorUserId: userId,
    action: "subscription.cancel_requested",
    targetType: "subscription",
    targetId: sub.id,
  });
  return "ok";
}

export async function billingHistory(db: AppDb, userId: string) {
  const subs = await db.query.subscriptions.findMany({ where: eq(subscriptions.userId, userId) });
  const subIds = subs.map((s) => s.id);
  const [subPays, ppv, tipRows] = await Promise.all([
    subIds.length
      ? db.query.subscriptionPayments.findMany({
          where: sql`${subscriptionPayments.subscriptionId} in ${subIds}`,
          orderBy: [desc(subscriptionPayments.createdAt)],
        })
      : Promise.resolve([]),
    db.query.purchases.findMany({
      where: eq(purchases.userId, userId),
      orderBy: [desc(purchases.createdAt)],
    }),
    db.query.tips.findMany({ where: eq(tips.userId, userId), orderBy: [desc(tips.createdAt)] }),
  ]);
  const rows = [
    ...subPays.map((p) => ({
      at: p.createdAt,
      kind: "Membership" as const,
      amountCents: p.amountCents,
      currency: p.currency,
      status: p.status,
      txn: p.processorTransactionId,
    })),
    ...ppv.map((p) => ({
      at: p.createdAt,
      kind: "Unlock" as const,
      amountCents: p.amountCents,
      currency: p.currency,
      status: p.status,
      txn: p.processorTransactionId,
    })),
    ...tipRows.map((p) => ({
      at: p.createdAt,
      kind: "Tip" as const,
      amountCents: p.amountCents,
      currency: p.currency,
      status: p.status,
      txn: p.processorTransactionId,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  return rows;
}

// ---------- admin revenue ----------
export interface RevenueStats {
  activeSubscribers: number;
  pastDue: number;
  mrrCents: number;
  month: {
    subscriptionCents: number;
    ppvCents: number;
    tipCents: number;
    refundedCents: number;
    chargebacks: number;
  };
  last90: { paidCount: number; chargebackCount: number; chargebackRate: number };
  recent: { at: Date; kind: string; amountCents: number; status: string; handle: string }[];
}

export async function revenueStats(db: AppDb, now = new Date()): Promise<RevenueStats> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const d90 = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
  const subs = await db.query.subscriptions.findMany({
    where: or(
      eq(subscriptions.status, "active"),
      eq(subscriptions.status, "past_due"),
      and(eq(subscriptions.status, "canceled"), gt(subscriptions.currentPeriodEnd, now)),
    ),
  });
  const activeSubscribers = subs.filter(
    (s) => s.status === "active" || s.status === "canceled",
  ).length;
  const pastDue = subs.filter((s) => s.status === "past_due").length;
  const mrrCents = subs.filter((s) => s.status === "active").reduce((a, s) => a + s.priceCents, 0);

  const [sp, pp, tp] = await Promise.all([
    db
      .select({ p: subscriptionPayments, handle: users.handle })
      .from(subscriptionPayments)
      .innerJoin(subscriptions, eq(subscriptions.id, subscriptionPayments.subscriptionId))
      .innerJoin(users, eq(users.id, subscriptions.userId))
      .where(gt(subscriptionPayments.createdAt, d90)),
    db
      .select({ p: purchases, handle: users.handle })
      .from(purchases)
      .innerJoin(users, eq(users.id, purchases.userId))
      .where(gt(purchases.createdAt, d90)),
    db
      .select({ p: tips, handle: users.handle })
      .from(tips)
      .innerJoin(users, eq(users.id, tips.userId))
      .where(gt(tips.createdAt, d90)),
  ]);
  const all = [
    ...sp.map((r) => ({
      at: r.p.createdAt,
      kind: "Membership",
      amountCents: r.p.amountCents,
      status: r.p.status,
      handle: r.handle,
    })),
    ...pp.map((r) => ({
      at: r.p.createdAt,
      kind: "Unlock",
      amountCents: r.p.amountCents,
      status: r.p.status,
      handle: r.handle,
    })),
    ...tp.map((r) => ({
      at: r.p.createdAt,
      kind: "Tip",
      amountCents: r.p.amountCents,
      status: r.p.status,
      handle: r.handle,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const inMonth = all.filter((r) => r.at >= monthStart);
  const sum = (rows: typeof all, kind: string) =>
    rows
      .filter((r) => r.kind === kind && r.status === "paid")
      .reduce((a, r) => a + r.amountCents, 0);
  const chargebackCount = all.filter((r) => r.status === "chargeback").length;
  return {
    activeSubscribers,
    pastDue,
    mrrCents,
    month: {
      subscriptionCents: sum(inMonth, "Membership"),
      ppvCents: sum(inMonth, "Unlock"),
      tipCents: sum(inMonth, "Tip"),
      refundedCents: inMonth
        .filter((r) => r.status === "refunded")
        .reduce((a, r) => a + r.amountCents, 0),
      chargebacks: inMonth.filter((r) => r.status === "chargeback").length,
    },
    last90: {
      paidCount: all.length,
      chargebackCount,
      chargebackRate: all.length ? chargebackCount / all.length : 0,
    },
    recent: all.slice(0, 50),
  };
}
