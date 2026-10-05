import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import * as schema from "./schema";

export const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "drizzle");

/**
 * In-memory Postgres (WASM) with all checked-in migrations applied. Used by tests so they
 * need no external database. Real Postgres 16 is exercised by the CI `migrate` job.
 */
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle({ client, schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db, client, close: () => client.close() };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>["db"];
