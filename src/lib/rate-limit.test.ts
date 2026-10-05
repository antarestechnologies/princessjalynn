import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "@/db/test-db";
import { consumeRateLimit } from "./rate-limit";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

describe("consumeRateLimit", () => {
  const rule = { limit: 3, windowSeconds: 60 };

  it("allows up to the limit then blocks within the window", async () => {
    const now = new Date("2026-01-01T00:00:10Z");
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await consumeRateLimit(t.db, "k1", rule, now));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false, false]);
    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0, 0]);
    expect(results[3].retryAfterSeconds).toBe(50);
  });

  it("resets in the next window and keeps keys independent", async () => {
    const later = new Date("2026-01-01T00:01:05Z");
    expect((await consumeRateLimit(t.db, "k1", rule, later)).allowed).toBe(true);
    expect(
      (await consumeRateLimit(t.db, "k2", rule, new Date("2026-01-01T00:00:10Z"))).allowed,
    ).toBe(true);
  });

  it("is atomic under concurrent increments", async () => {
    const now = new Date("2026-01-01T00:00:10Z");
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        consumeRateLimit(t.db, "concurrent", { limit: 4, windowSeconds: 60 }, now),
      ),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(4);
    const row = await t.db.execute<{ count: number }>(
      sql`select count from rate_limits where key = 'concurrent'`,
    );
    expect(Number(row.rows[0].count)).toBe(10);
  });
});
