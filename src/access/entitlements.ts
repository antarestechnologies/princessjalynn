import { and, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { entitlements, type posts, type users } from "@/db/schema";
import type { AppDb } from "@/db/types";

type Post = typeof posts.$inferSelect;
type User = typeof users.$inferSelect;

export type Access =
  | { allowed: true; reason: "free" | "subscription" | "purchase" | "admin" }
  | {
      allowed: false;
      reason:
        | "login_required"
        | "verification_required"
        | "not_published"
        | "subscription_required"
        | "purchase_required";
    };

/** Scheduled posts become visible at publishAt without a cron. */
export function isPublished(post: Pick<Post, "status" | "publishAt">, now = new Date()): boolean {
  if (post.status === "published") return true;
  if (post.status === "scheduled" && post.publishAt && post.publishAt.getTime() <= now.getTime())
    return true;
  return false;
}

function liveWhere(userId: string, now: Date) {
  return and(
    eq(entitlements.userId, userId),
    isNull(entitlements.revokedAt),
    lte(entitlements.startsAt, now),
    or(isNull(entitlements.endsAt), gt(entitlements.endsAt, now)),
  );
}

export async function hasActiveSubscription(
  db: AppDb,
  userId: string,
  now = new Date(),
): Promise<boolean> {
  const row = await db.query.entitlements.findFirst({
    where: and(liveWhere(userId, now), eq(entitlements.kind, "subscription")),
    columns: { id: true },
  });
  return !!row;
}

export async function hasPostEntitlement(
  db: AppDb,
  userId: string,
  postId: string,
  now = new Date(),
): Promise<boolean> {
  const row = await db.query.entitlements.findFirst({
    where: and(
      liveWhere(userId, now),
      eq(entitlements.kind, "post"),
      eq(entitlements.postId, postId),
    ),
    columns: { id: true },
  });
  return !!row;
}

/** Set of post ids the user has bought, for rendering a feed without N queries. */
export async function purchasedPostIds(
  db: AppDb,
  userId: string,
  now = new Date(),
): Promise<Set<string>> {
  const rows = await db
    .select({ postId: entitlements.postId })
    .from(entitlements)
    .where(
      and(
        liveWhere(userId, now),
        eq(entitlements.kind, "post"),
        sql`${entitlements.postId} is not null`,
      ),
    );
  return new Set(rows.map((r) => r.postId!).filter(Boolean));
}

export interface ViewerContext {
  user: User | null;
  subscribed: boolean;
  purchased: Set<string>;
}

export async function loadViewerContext(
  db: AppDb,
  user: User | null,
  now = new Date(),
): Promise<ViewerContext> {
  if (!user) return { user: null, subscribed: false, purchased: new Set() };
  const [subscribed, purchased] = await Promise.all([
    hasActiveSubscription(db, user.id, now),
    purchasedPostIds(db, user.id, now),
  ]);
  return { user, subscribed, purchased };
}

/**
 * The one access decision for a post. Every media URL is issued only after this says allowed.
 * Free posts still require a signed-in, age-verified viewer: "free" means unpaid, not public.
 */
export function resolveAccess(ctx: ViewerContext, post: Post, now = new Date()): Access {
  const { user } = ctx;
  if (!user) return { allowed: false, reason: "login_required" };
  if (user.role === "admin") return { allowed: true, reason: "admin" };
  if (!user.emailVerifiedAt || !user.ageVerifiedAt)
    return { allowed: false, reason: "verification_required" };
  if (!isPublished(post, now)) return { allowed: false, reason: "not_published" };
  switch (post.tier) {
    case "free":
      return { allowed: true, reason: "free" };
    case "subscriber":
      return ctx.subscribed
        ? { allowed: true, reason: "subscription" }
        : { allowed: false, reason: "subscription_required" };
    case "ppv":
      return ctx.purchased.has(post.id)
        ? { allowed: true, reason: "purchase" }
        : { allowed: false, reason: "purchase_required" };
  }
}

export async function resolveAccessFor(
  db: AppDb,
  user: User | null,
  post: Post,
  now = new Date(),
): Promise<Access> {
  // Cheap path first; only hit the entitlements table when the tier needs it.
  const base: ViewerContext = { user, subscribed: false, purchased: new Set() };
  const quick = resolveAccess(base, post, now);
  if (
    quick.allowed ||
    (quick.reason !== "subscription_required" && quick.reason !== "purchase_required")
  )
    return quick;
  if (post.tier === "subscriber") base.subscribed = await hasActiveSubscription(db, user!.id, now);
  if (post.tier === "ppv" && (await hasPostEntitlement(db, user!.id, post.id, now)))
    base.purchased.add(post.id);
  return resolveAccess(base, post, now);
}
