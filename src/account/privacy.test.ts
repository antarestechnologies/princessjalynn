import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveAccessFor } from "@/access/entitlements";
import { createSession, getSessionUser, signIn, signUp } from "@/auth/service";
import { auditLog, posts, users } from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import type { Mailer } from "@/lib/mailer";
import { FakePaymentProcessor } from "@/payments/fake";
import {
  ingestWebhook,
  latestSubscription,
  type PaymentDeps,
  startCheckout,
} from "@/payments/service";
import type { PaymentProcessor } from "@/payments/types";
import { deleteAccount, exportAccountData } from "./privacy";

let t: Awaited<ReturnType<typeof createTestDb>>;
let fake: FakePaymentProcessor;
let deps: PaymentDeps;
let fanId: string;
let subPost: typeof posts.$inferSelect;
const PW = "a-long-enough-password";
const mailer: Mailer = { name: "noop", send: async () => {} };

beforeAll(async () => {
  t = await createTestDb();
  deps = {
    mailer,
    config: {
      subscriptionPriceCents: 1500,
      currency: "USD",
      billingDescriptor: "MBRS*ONLINE",
      gracePeriodDays: 3,
      appUrl: "https://m.example",
    },
  };
  fake = new FakePaymentProcessor(
    "test-secret-that-is-at-least-32-characters-long",
    "https://m.example",
    (i) => ingestWebhook(t.db, fake, deps, i).then(() => undefined),
  );
  const r = await signUp(t.db, { email: "Fan@Example.com", password: PW, handle: "fan" });
  if (!r.ok || r.existing) throw new Error("setup");
  fanId = r.userId;
  await t.db
    .update(users)
    .set({ emailVerifiedAt: new Date(), ageVerifiedAt: new Date() })
    .where(eq(users.id, fanId));
  [subPost] = await t.db
    .insert(posts)
    .values({ title: "s", tier: "subscriber", status: "published", publishedAt: new Date() })
    .returning();
  const fan = (await t.db.query.users.findFirst({ where: eq(users.id, fanId) }))!;
  const co = await startCheckout(t.db, fake, deps, { user: fan, kind: "subscription" });
  if (!co.ok) throw new Error("checkout");
  await fake.simulateCheckoutPaid((await t.db.query.checkoutSessions.findFirst())!);
});
afterAll(async () => {
  await t.close();
});

describe("data export", () => {
  it("includes the account, billing and sessions but no secrets, and is audited", async () => {
    await createSession(t.db, fanId, { ipPrefix: "203.0.113.0/24", userAgent: "UA" });
    const data = (await exportAccountData(t.db, fanId))!;
    expect(data.account.email).toBe("Fan@Example.com");
    expect(data.subscriptions).toHaveLength(1);
    expect(data.subscriptionPayments).toHaveLength(1);
    expect(data.sessions[0]).toMatchObject({ ipPrefix: "203.0.113.0/24", userAgent: "UA" });
    const json = JSON.stringify(data);
    for (const secret of [
      "passwordHash",
      "password_hash",
      "tokenHash",
      "scrypt$",
      "processorCustomerId",
    ])
      expect(json).not.toContain(secret);
    const actions = (await t.db.select().from(auditLog)).map((a) => a.action);
    expect(actions).toContain("account.export");
  });
});

describe("account deletion", () => {
  it("refuses a wrong password and changes nothing", async () => {
    expect(
      await deleteAccount(t.db, fake, { userId: fanId, password: "wrong-password!!" }),
    ).toEqual({ ok: false, error: "bad_password" });
    expect((await t.db.query.users.findFirst({ where: eq(users.id, fanId) }))!.status).toBe(
      "active",
    );
  });

  it("aborts without deleting if the processor cannot cancel billing", async () => {
    const broken: PaymentProcessor = {
      name: "fake",
      createCheckout: (x) => fake.createCheckout(x),
      parseWebhook: (x) => fake.parseWebhook(x),
      refund: (x) => fake.refund(x),
      cancelSubscription: async () => {
        throw new Error("down");
      },
    };
    expect(await deleteAccount(t.db, broken, { userId: fanId, password: PW })).toEqual({
      ok: false,
      error: "processor_error",
    });
    expect(
      (await t.db.query.users.findFirst({ where: eq(users.id, fanId) }))!.deletedAt,
    ).toBeNull();
  });

  it("cancels billing, revokes access, ends sessions, anonymises identity and keeps payment records", async () => {
    const s = await createSession(t.db, fanId);
    const fanBefore = (await t.db.query.users.findFirst({ where: eq(users.id, fanId) }))!;
    expect((await resolveAccessFor(t.db, fanBefore, subPost)).allowed).toBe(true);

    expect(await deleteAccount(t.db, fake, { userId: fanId, password: PW })).toEqual({ ok: true });

    const u = (await t.db.query.users.findFirst({ where: eq(users.id, fanId) }))!;
    expect(u.status).toBe("deleted");
    expect(u.email).not.toContain("Example.com");
    expect(u.handle).toMatch(/^deleted_/);
    expect(await getSessionUser(t.db, s.token)).toBeNull();
    expect((await resolveAccessFor(t.db, u, subPost)).allowed).toBe(false);
    expect((await latestSubscription(t.db, fanId))!.status).toBe("canceled");
    expect((await signIn(t.db, { email: "fan@example.com", password: PW })).ok).toBe(false);
    // The email can be used again for a brand-new account.
    expect(
      (await signUp(t.db, { email: "fan@example.com", password: PW, handle: "fan_again" })).ok,
    ).toBe(true);
    expect(JSON.stringify(await t.db.select().from(auditLog))).not.toMatch(/example\.com/i);
  });

  it("will not delete an admin account", async () => {
    const r = await signUp(t.db, { email: "adm@example.com", password: PW, handle: "adm" });
    if (!r.ok || r.existing) throw new Error("setup");
    await t.db.update(users).set({ role: "admin" }).where(eq(users.id, r.userId));
    expect(await deleteAccount(t.db, fake, { userId: r.userId, password: PW })).toEqual({
      ok: false,
      error: "admin_account",
    });
  });
});
