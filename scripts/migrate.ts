import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { Pool } from "pg";
import { parseEnv } from "../src/env";
import { logger } from "../src/lib/logger";

/**
 * Applies every migration in ./drizzle that has not yet been recorded in
 * drizzle.__drizzle_migrations. Safe to run repeatedly; it is what CI and deploys call.
 */
async function main() {
  const env = parseEnv();
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });
  const db = drizzle({ client: pool, casing: "snake_case" });
  const folder = path.resolve(process.cwd(), "drizzle");
  logger.info({ folder }, "applying migrations");
  const started = Date.now();
  await migrate(db, { migrationsFolder: folder });
  logger.info({ ms: Date.now() - started }, "migrations applied");
  await pool.end();
}

main().catch((err) => {
  logger.error({ err }, "migration failed");
  process.exit(1);
});
