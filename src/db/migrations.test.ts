import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "./test-db";
import { auditLog, posts, users } from "./schema";

let t: Awaited<ReturnType<typeof createTestDb>>;

/** Drizzle wraps driver errors as "Failed query: ..." with the Postgres error in `cause`. */
async function expectDbError(p: Promise<unknown>, re: RegExp) {
  let caught: unknown;
  try {
    await p;
  } catch (e) {
    caught = e;
  }
  expect(caught, "expected the query to fail").toBeDefined();
  const err = caught as Error & { cause?: Error };
  const text = `${err.message}\n${err.cause?.message ?? ""}`;
  expect(text).toMatch(re);
}

beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const EXPECTED_TABLES = [
  "users",
  "subscriptions",
  "purchases",
  "tips",
  "posts",
  "media",
  "entitlements",
  "audit_log",
  "takedown_requests",
];

describe("migrations", () => {
  it("create every table named in PLAN.md Phase 1", async () => {
    const rows = await t.db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`,
    );
    const names = rows.rows.map((r) => r.table_name);
    for (const expected of EXPECTED_TABLES) expect(names).toContain(expected);
  });

  it("enforce case-insensitive unique email and handle", async () => {
    await t.db
      .insert(users)
      .values({ email: "Fan@Example.com", handle: "Fan1", passwordHash: "x" });
    await expectDbError(
      t.db.insert(users).values({ email: "fan@example.com", handle: "other", passwordHash: "x" }),
      /users_email_lower_idx/,
    );
    await expectDbError(
      t.db.insert(users).values({ email: "second@example.com", handle: "FAN1", passwordHash: "x" }),
      /users_handle_lower_idx/,
    );
  });

  it("make audit_log append-only", async () => {
    const [row] = await t.db
      .insert(auditLog)
      .values({ action: "test.insert", targetType: "test", targetId: "1" })
      .returning({ id: auditLog.id });
    await expectDbError(
      t.db.execute(sql`update audit_log set action = 'tampered' where id = ${row.id}`),
      /append-only/,
    );
    await expectDbError(
      t.db.execute(sql`delete from audit_log where id = ${row.id}`),
      /append-only/,
    );
    const after = await t.db.execute<{ action: string }>(
      sql`select action from audit_log where id = ${row.id}`,
    );
    expect(after.rows[0].action).toBe("test.insert");
  });

  it("require a price on pay-per-view posts", async () => {
    await expectDbError(
      t.db.insert(posts).values({ title: "locked", tier: "ppv", priceCents: null }),
      /posts_ppv_price_check/,
    );
    await expect(
      t.db.insert(posts).values({ title: "locked", tier: "ppv", priceCents: 999 }),
    ).resolves.toBeDefined();
  });

  it("are idempotent: running the migrator twice is a no-op", async () => {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const { MIGRATIONS_FOLDER } = await import("./test-db");
    await expect(migrate(t.db, { migrationsFolder: MIGRATIONS_FOLDER })).resolves.toBeUndefined();
  });
});
