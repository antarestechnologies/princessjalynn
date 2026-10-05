import { sql } from "drizzle-orm";
import type { AppDb } from "@/db/types";

export interface RateLimitResult {
  allowed: boolean;
  /** Attempts left in this window (0 when blocked). */
  remaining: number;
  /** Seconds until the window resets. */
  retryAfterSeconds: number;
}

export interface RateLimitRule {
  /** Max attempts per window. */
  limit: number;
  windowSeconds: number;
}

/**
 * Fixed-window counter in Postgres. One upsert per call, atomic under concurrency.
 * Returns the decision; the caller decides what to do (generic error, 429, delay).
 */
export async function consumeRateLimit(
  db: AppDb,
  key: string,
  rule: RateLimitRule,
  now = new Date(),
): Promise<RateLimitResult> {
  const windowMs = rule.windowSeconds * 1000;
  const windowStartMs = Math.floor(now.getTime() / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs);

  // Both node-postgres and PGlite return { rows }, but the shared drizzle base type does not say so.
  const res = (await db.execute(sql`
    insert into rate_limits (key, window_start, count)
    values (${key}, ${windowStart.toISOString()}::timestamptz, 1)
    on conflict (key, window_start) do update set count = rate_limits.count + 1
    returning count
  `)) as unknown as { rows: { count: number | string }[] };
  const count = Number(res.rows[0]?.count ?? 1);

  // Opportunistic cleanup of stale windows, roughly 1 in 25 calls.
  if (Math.random() < 0.04) {
    const cutoff = new Date(windowStartMs - 2 * windowMs).toISOString();
    await db.execute(sql`delete from rate_limits where window_start < ${cutoff}::timestamptz`);
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((windowStartMs + windowMs - now.getTime()) / 1000),
  );
  return {
    allowed: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSeconds,
  };
}

/** Rules for auth routes. Tuned for ~120 real users; tighten if abuse shows up in the audit log. */
export const RATE_RULES = {
  loginPerIp: { limit: 20, windowSeconds: 15 * 60 },
  loginPerEmail: { limit: 8, windowSeconds: 15 * 60 },
  signupPerIp: { limit: 5, windowSeconds: 60 * 60 },
  forgotPerIp: { limit: 10, windowSeconds: 60 * 60 },
  forgotPerEmail: { limit: 3, windowSeconds: 60 * 60 },
  resendVerifyPerUser: { limit: 3, windowSeconds: 60 * 60 },
  resetPerIp: { limit: 10, windowSeconds: 60 * 60 },
  ageVerifyPerUser: { limit: 5, windowSeconds: 24 * 60 * 60 },
} as const satisfies Record<string, RateLimitRule>;
