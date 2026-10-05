import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signUp } from "@/auth/service";
import { entitlements, posts, users } from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import { eq } from "drizzle-orm";
import { isPublished, loadViewerContext, resolveAccess, resolveAccessFor } from "./entitlements";

let t: Awaited<ReturnType<typeof createTestDb>>;
type U = typeof users.$inferSelect;
let fan: U;
let unverified: U;
let admin: U;
let freePost: typeof posts.$inferSelect;
let subPost: typeof posts.$inferSelect;
let ppvPost: typeof posts.$inferSelect;
let draft: typeof posts.$inferSelect;
let scheduled: typeof posts.$inferSelect;
const now = new Date("2026-06-01T12:00:00Z");

async function mkUser(
  email: string,
  handle: string,
  verified: boolean,
  role: "fan" | "admin" = "fan",
) {
  const r = await signUp(t.db, { email, password: "a-long-enough-password", handle });
  if (!r.ok || r.existing) throw new Error("setup");
  await t.db
    .update(users)
    .set(verified ? { emailVerifiedAt: now, ageVerifiedAt: now, role } : { role })
    .where(eq(users.id, r.userId));
  return (await t.db.query.users.findFirst({ where: eq(users.id, r.userId) }))!;
}

beforeAll(async () => {
  t = await createTestDb();
  fan = await mkUser("fan@example.com", "fan", true);
  unverified = await mkUser("u@example.com", "unv", false);
  admin = await mkUser("adm@example.com", "adm", true, "admin");
  [freePost] = await t.db
    .insert(posts)
    .values({ title: "free", tier: "free", status: "published", publishedAt: now })
    .returning();
  [subPost] = await t.db
    .insert(posts)
    .values({ title: "sub", tier: "subscriber", status: "published", publishedAt: now })
    .returning();
  [ppvPost] = await t.db
    .insert(posts)
    .values({ title: "ppv", tier: "ppv", priceCents: 999, status: "published", publishedAt: now })
    .returning();
  [draft] = await t.db
    .insert(posts)
    .values({ title: "draft", tier: "free", status: "draft" })
    .returning();
  [scheduled] = await t.db
    .insert(posts)
    .values({
      title: "sched",
      tier: "free",
      status: "scheduled",
      publishAt: new Date("2026-06-02T00:00:00Z"),
    })
    .returning();
});
afterAll(async () => {
  await t.close();
});

describe("isPublished", () => {
  it("treats scheduled posts as live only once publishAt passes", () => {
    expect(isPublished(freePost, now)).toBe(true);
    expect(isPublished(draft, now)).toBe(false);
    expect(isPublished(scheduled, now)).toBe(false);
    expect(isPublished(scheduled, new Date("2026-06-02T00:00:01Z"))).toBe(true);
  });
});

describe("resolveAccess", () => {
  it("denies anonymous and unverified viewers everything, even free posts", async () => {
    expect(
      resolveAccess({ user: null, subscribed: false, purchased: new Set() }, freePost, now),
    ).toEqual({ allowed: false, reason: "login_required" });
    expect(await resolveAccessFor(t.db, unverified, freePost, now)).toEqual({
      allowed: false,
      reason: "verification_required",
    });
  });

  it("lets a verified fan see free posts but not subscriber or PPV posts without entitlements", async () => {
    expect(await resolveAccessFor(t.db, fan, freePost, now)).toEqual({
      allowed: true,
      reason: "free",
    });
    expect(await resolveAccessFor(t.db, fan, subPost, now)).toEqual({
      allowed: false,
      reason: "subscription_required",
    });
    expect(await resolveAccessFor(t.db, fan, ppvPost, now)).toEqual({
      allowed: false,
      reason: "purchase_required",
    });
    expect(await resolveAccessFor(t.db, fan, draft, now)).toEqual({
      allowed: false,
      reason: "not_published",
    });
    expect(await resolveAccessFor(t.db, fan, scheduled, now)).toEqual({
      allowed: false,
      reason: "not_published",
    });
  });

  it("honours live entitlements and ignores expired or revoked ones", async () => {
    // expired subscription
    await t.db.insert(entitlements).values({
      userId: fan.id,
      kind: "subscription",
      source: "subscription",
      sourceId: fan.id,
      startsAt: new Date("2026-01-01T00:00:00Z"),
      endsAt: new Date("2026-02-01T00:00:00Z"),
    });
    expect(await resolveAccessFor(t.db, fan, subPost, now)).toEqual({
      allowed: false,
      reason: "subscription_required",
    });
    // revoked PPV
    const [rev] = await t.db
      .insert(entitlements)
      .values({
        userId: fan.id,
        kind: "post",
        postId: ppvPost.id,
        source: "purchase",
        sourceId: fan.id,
        startsAt: now,
        revokedAt: now,
        revokeReason: "chargeback",
      })
      .returning();
    expect(rev.revokedAt).not.toBeNull();
    expect(await resolveAccessFor(t.db, fan, ppvPost, now)).toEqual({
      allowed: false,
      reason: "purchase_required",
    });
    // live subscription
    await t.db.insert(entitlements).values({
      userId: fan.id,
      kind: "subscription",
      source: "subscription",
      sourceId: fan.id,
      startsAt: new Date("2026-05-01T00:00:00Z"),
      endsAt: new Date("2026-07-01T00:00:00Z"),
    });
    expect(await resolveAccessFor(t.db, fan, subPost, now)).toEqual({
      allowed: true,
      reason: "subscription",
    });
    // subscription does not unlock PPV
    expect(await resolveAccessFor(t.db, fan, ppvPost, now)).toEqual({
      allowed: false,
      reason: "purchase_required",
    });
    // live PPV purchase
    await t.db.insert(entitlements).values({
      userId: fan.id,
      kind: "post",
      postId: ppvPost.id,
      source: "purchase",
      sourceId: fan.id,
      startsAt: now,
    });
    expect(await resolveAccessFor(t.db, fan, ppvPost, now)).toEqual({
      allowed: true,
      reason: "purchase",
    });
    // the batched context agrees with the per-post path
    const ctx = await loadViewerContext(t.db, fan, now);
    expect(ctx.subscribed).toBe(true);
    expect(ctx.purchased.has(ppvPost.id)).toBe(true);
    expect(resolveAccess(ctx, subPost, now).allowed).toBe(true);
  });

  it("admins see everything including drafts", async () => {
    expect(await resolveAccessFor(t.db, admin, draft, now)).toEqual({
      allowed: true,
      reason: "admin",
    });
    expect(await resolveAccessFor(t.db, admin, ppvPost, now)).toEqual({
      allowed: true,
      reason: "admin",
    });
  });
});
