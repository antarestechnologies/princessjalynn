import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getEnv } from "@/env";
import * as schema from "./schema";

/**
 * Process-wide Postgres pool. Neon/Vercel: keep the pool small; serverless functions get
 * their own instance each. Use the Neon pooled connection string in DATABASE_URL.
 */
const globalForDb = globalThis as unknown as { __pgPool?: Pool };

export function getPool(): Pool {
  if (!globalForDb.__pgPool) {
    globalForDb.__pgPool = new Pool({
      connectionString: getEnv().DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 10_000,
    });
  }
  return globalForDb.__pgPool;
}

export function getDb() {
  return drizzle({ client: getPool(), schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof getDb>;
export { schema };
