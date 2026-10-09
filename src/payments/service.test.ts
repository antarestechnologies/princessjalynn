import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resolveAccessFor } from "@/access/entitlements";
import { signUp } from "@/auth/service";
import { entitlements, posts, users, webhookEvents } from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import type { MailMessage, Mailer } from "@/lib/mailer";
import { FakePaymentProcessor } from "./fake";
import {
  billingHistory,
  cancelOwnSubscription,
  findActiveSubscription,
  ingestWebhook,
  latestSubscription,
  type PaymentDeps,
  processWebhookEvent,
  revenueStats,
  startCheckout,
} from "./service";
import { WebhookSignatureError } from "./types";

let t: Awaited<ReturnType<typeof createTestDb>>;
let fake: FakePaymentProcessor;
let deps: PaymentDeps;
let fan: typeof users.$inferSelect;
let subPost: typeof posts.$inferSelect;
let ppvPost: typeof posts.$inferSelect;
const sent: MailMessage[] = [];
const mailer: Mailer = { name: "spy", send: async (m) => void sent.push(m) };
const SECRET = "test-secret-that-is-at-least-32-characters-long";
let clock = new Date("2026-06-01T12:00:00Z");
const now = () => clock;

beforeAll(async () => {
  t = await createTestDb();
  deps = {
    mailer,
    config: {
      subscriptionPriceCents: 1500,
      currency: "USD",
      billingDescriptor: "MBRS*ONLINE",
      gracePeriodDays: 3,
      appUrl: "https://members.example",
    },
    now,
  };
  fake = new FakePaymentProcessor(
    SECRET,
    "https://members.example",
    (input) => ingestWebhook(t.db, fake, deps, input).then(() => undefined),
    now,
  );
  const r = await signUp(t.db, {
    email: "fan@example.com",
    password: "a-long-enough-password",
    handle: "fan",
  });
  if (!r.ok || r.existing) throw new Error("setup");
  await t.db
    .update(users)
    .set({ emailVerifiedAt: clock, ageVerifiedAt: clock })
    .where(eq(users.id, r.userId));
  fan = (await t.db.query.users.findFirst({ where: eq(users.id, r.userId) }))!;
  [subPost] = await t.db
    .insert(posts)
    .values({ title: "sub", tier: "subscriber", status: "published", publishedAt: clock })
    .returning();
  [ppvPost] = await t.db
    .insert(posts)
    .values({ title: "ppv", tier: "ppv", priceCents: 999, status: "published", publishedAt: clock })
    .returning();
});
afterAll(async () => {
  await t.close();
});
beforeEach(() => {
  sent.length = 0;
});

const access = (post: typeof posts.$inferSelect) =>
  resolveAccessFor(t.db, fan, post, clock).then((a) => a.allowed);

describe("subscription lifecycle through signed webhooks", () => {
  it("checkout → created grants access and emails a receipt", async () => {
    const r = await startCheckout(t.db, fake, deps, { user: fan, kind: "subscription" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.redirectUrl).toBe(`https://members.example/pay/fake/${r.checkoutId}`);
    expect(await access(subPost)).toBe(false);

    const checkout = (await t.db.query.checkoutSessions.findFirst())!;
    await fake.simulateCheckoutPaid(checkout);

    expect(await access(subPost)).toBe(true);
    const sub = (await findActiveSubscription(t.db, fan.id, clock))!;
    expect(sub.status).toBe("active");
    expect(sub.priceCents).toBe(1500);
    expect(sent.map((m) => m.subject)).toEqual(["Receipt: $15.00"]);
    expect(sent[0].text).toContain("MBRS*ONLINE");
    expect(await startCheckout(t.db, fake, deps, { user: fan, kind: "subscription" })).toEqual({
      ok: false,
      error: "already_subscribed",
    });
  });

  it("renewal extends access; the same event replayed is ignored", async () => {
    const sub = (await findActiveSubscription(t.db, fan.id, clock))!;
    clock = new Date(sub.currentPeriodEnd.getTime() + 1000);
    expect(await access(subPost)).toBe(false);
    const ev = await fake.simulateRenewal(sub);
    expect(await access(subPost)).toBe(true);
    const after = (await findActiveSubscription(t.db, fan.id, clock))!;
    expect(after.currentPeriodEnd.getTime()).toBe(
      sub.currentPeriodEnd.getTime() + 30 * 24 * 3600 * 1000,
    );

    expect(await processWebhookEvent(t.db, "fake", deps, ev, clock)).toBe("duplicate");
    const live = await t.db.query.entitlements.findMany({ where: eq(entitlements.userId, fan.id) });
    expect(live.filter((e) => e.kind === "subscription" && !e.revokedAt)).toHaveLength(1);
  });

  it("failed renewal keeps access through the grace period only", async () => {
    const sub = (await findActiveSubscription(t.db, fan.id, clock))!;
    clock = new Date(sub.currentPeriodEnd.getTime() + 60_000);
    await fake.simulateRenewalFailed(sub.processorSubscriptionId);
    const pd = (await latestSubscription(t.db, fan.id))!;
    expect(pd.status).toBe("past_due");
    expect(pd.graceUntil!.getTime()).toBe(clock.getTime() + 3 * 24 * 3600 * 1000);
    expect(await access(subPost)).toBe(true);
    expect(sent.at(-1)?.subject).toMatch(/payment failed/);
    clock = new Date(pd.graceUntil!.getTime() + 1000);
    expect(await access(subPost)).toBe(false);
  });

  it("a successful retry after past_due restores access", async () => {
    const sub = (await latestSubscription(t.db, fan.id))!;
    await fake.simulateRenewal({ ...sub, currentPeriodEnd: clock });
    const s2 = (await latestSubscription(t.db, fan.id))!;
    expect(s2.status).toBe("active");
    expect(s2.graceUntil).toBeNull();
    expect(await access(subPost)).toBe(true);
  });

  it("fan cancellation keeps access until period end, then nothing", async () => {
    expect(await cancelOwnSubscription(t.db, fake, fan.id, clock)).toBe("ok");
    const sub = (await latestSubscription(t.db, fan.id))!;
    expect(sub.status).toBe("canceled");
    expect(sub.canceledAt).not.toBeNull();
    expect(await access(subPost)).toBe(true);
    clock = new Date(sub.currentPeriodEnd.getTime() + 1000);
    expect(await access(subPost)).toBe(false);
    expect(await cancelOwnSubscription(t.db, fake, fan.id, clock)).toBe("none");
  });

  it("expired revokes the entitlement row explicitly", async () => {
    const sub = (await latestSubscription(t.db, fan.id))!;
    await fake.simulateExpired(sub.processorSubscriptionId);
    expect((await latestSubscription(t.db, fan.id))!.status).toBe("expired");
    const rows = await t.db.query.entitlements.findMany({
      where: eq(entitlements.sourceId, sub.id),
    });
    expect(rows.every((r) => r.revokedAt && r.revokeReason === "expired")).toBe(true);
  });

  it("re-subscribing after expiry works and a refund revokes access immediately", async () => {
    const r = await startCheckout(t.db, fake, deps, { user: fan, kind: "subscription" });
    if (!r.ok) throw new Error("checkout");
    const checkout = (await t.db.query.checkoutSessions.findMany()).find(
      (c) => c.id === r.checkoutId,
    )!;
    const created = await fake.simulateCheckoutPaid(checkout);
    expect(await access(subPost)).toBe(true);
    if (created.type !== "subscription.created") throw new Error("type");
    await fake.refund({ processorTransactionId: created.data.transactionId });
    expect(await access(subPost)).toBe(false);
    const sub = (await latestSubscription(t.db, fan.id))!;
    expect(sub.status).toBe("expired");
    expect(
      (await billingHistory(t.db, fan.id)).find((h) => h.txn === created.data.transactionId)
        ?.status,
    ).toBe("refunded");
  });
});

describe("pay-per-view, tips, chargebacks", () => {
  it("PPV purchase unlocks exactly that post; refund re-locks it", async () => {
    expect(await access(ppvPost)).toBe(false);
    const r = await startCheckout(t.db, fake, deps, { user: fan, kind: "ppv", postId: ppvPost.id });
    if (!r.ok) throw new Error("checkout " + JSON.stringify(r));
    const checkout = (await t.db.query.checkoutSessions.findMany()).find(
      (c) => c.id === r.checkoutId,
    )!;
    expect(checkout.amountCents).toBe(999);
    const ev = await fake.simulateCheckoutPaid(checkout);
    expect(await access(ppvPost)).toBe(true);
    expect(await access(subPost)).toBe(false);
    expect(sent.at(-1)?.subject).toBe("Receipt: $9.99");
    expect(
      await startCheckout(t.db, fake, deps, { user: fan, kind: "ppv", postId: ppvPost.id }),
    ).toEqual({ ok: false, error: "already_purchased" });
    if (ev.type !== "purchase.completed") throw new Error("type");
    await fake.refund({ processorTransactionId: ev.data.transactionId });
    expect(await access(ppvPost)).toBe(false);
  });

  it("rejects PPV checkout for non-PPV posts and bad tip amounts", async () => {
    expect(
      await startCheckout(t.db, fake, deps, { user: fan, kind: "ppv", postId: subPost.id }),
    ).toEqual({ ok: false, error: "post_not_ppv" });
    expect(
      await startCheckout(t.db, fake, deps, { user: fan, kind: "tip", amountCents: 50 }),
    ).toEqual({ ok: false, error: "bad_amount" });
    expect(
      await startCheckout(t.db, fake, deps, { user: fan, kind: "tip", amountCents: 1_000_000 }),
    ).toEqual({ ok: false, error: "bad_amount" });
  });

  it("tips are recorded and receipted", async () => {
    const r = await startCheckout(t.db, fake, deps, {
      user: fan,
      kind: "tip",
      postId: subPost.id,
      amountCents: 500,
    });
    if (!r.ok) throw new Error("checkout");
    const checkout = (await t.db.query.checkoutSessions.findMany()).find(
      (c) => c.id === r.checkoutId,
    )!;
    await fake.simulateCheckoutPaid(checkout);
    expect(
      (await billingHistory(t.db, fan.id)).some((h) => h.kind === "Tip" && h.amountCents === 500),
    ).toBe(true);
    expect(sent.at(-1)?.subject).toBe("Receipt: $5.00");
  });

  it("a chargeback revokes every entitlement, flags the account and emails the fan", async () => {
    // Buy the PPV again and subscribe again so there is something to revoke.
    const p = await startCheckout(t.db, fake, deps, { user: fan, kind: "ppv", postId: ppvPost.id });
    const s = await startCheckout(t.db, fake, deps, { user: fan, kind: "subscription" });
    if (!p.ok || !s.ok) throw new Error("checkout");
    const all = await t.db.query.checkoutSessions.findMany();
    await fake.simulateCheckoutPaid(all.find((c) => c.id === p.checkoutId)!);
    const subEv = await fake.simulateCheckoutPaid(all.find((c) => c.id === s.checkoutId)!);
    expect(await access(ppvPost)).toBe(true);
    expect(await access(subPost)).toBe(true);
    if (subEv.type !== "subscription.created") throw new Error("type");

    await fake.simulateChargeback(subEv.data.transactionId);
    expect(await access(subPost)).toBe(false);
    expect(await access(ppvPost)).toBe(false);
    const u = (await t.db.query.users.findFirst({ where: eq(users.id, fan.id) }))!;
    expect(u.flagged).toBe(true);
    expect((await latestSubscription(t.db, fan.id))!.status).toBe("chargeback");
    expect(sent.at(-1)?.subject).toMatch(/paused/);
  });
});

describe("webhook security and bookkeeping", () => {
  it("rejects bad signatures, stale timestamps and malformed bodies without storing anything", async () => {
    const before = (await t.db.query.webhookEvents.findMany()).length;
    const body = JSON.stringify({
      id: "x",
      occurredAt: clock.toISOString(),
      type: "subscription.expired",
      data: { processorSubscriptionId: "nope" },
    });
    const ts = String(Math.floor(clock.getTime() / 1000));
    const bad = new Headers({ "x-fake-timestamp": ts, "x-fake-signature": "deadbeef" });
    await expect(
      ingestWebhook(t.db, fake, deps, { headers: bad, rawBody: body }),
    ).rejects.toBeInstanceOf(WebhookSignatureError);
    const staleTs = String(Math.floor(clock.getTime() / 1000) - 3600);
    const stale = new Headers({
      "x-fake-timestamp": staleTs,
      "x-fake-signature": fake.sign(staleTs, body),
    });
    await expect(
      ingestWebhook(t.db, fake, deps, { headers: stale, rawBody: body }),
    ).rejects.toThrow(/stale/);
    const garbage = "not json";
    const g = new Headers({ "x-fake-timestamp": ts, "x-fake-signature": fake.sign(ts, garbage) });
    await expect(ingestWebhook(t.db, fake, deps, { headers: g, rawBody: garbage })).rejects.toThrow(
      /JSON/,
    );
    expect((await t.db.query.webhookEvents.findMany()).length).toBe(before);
  });

  it("records a handler failure on the event instead of crashing, and never stores PII", async () => {
    await fake.simulateExpired("fake_sub_does_not_exist");
    const row = (await t.db.query.webhookEvents.findMany()).find(
      (e) => e.type === "subscription.expired" && e.error,
    );
    expect(row?.error).toMatch(/unknown subscription/);
    const dump = JSON.stringify(
      await t.db.select({ p: webhookEvents.payload }).from(webhookEvents),
    );
    expect(dump).not.toContain("fan@example.com");
  });

  it("revenue stats reflect the ledger", async () => {
    const s = await revenueStats(t.db, clock);
    expect(s.last90.chargebackCount).toBe(1);
    expect(s.last90.paidCount).toBeGreaterThan(3);
    expect(s.month.tipCents).toBe(500);
    expect(s.recent[0]).toHaveProperty("handle", "fan");
  });
});
