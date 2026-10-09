import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { parseEnv } from "../src/env";
import { recordAudit } from "../src/auth/audit";

/**
 * Promote an existing account to admin: `npm run make-admin -- someone@example.com`.
 * There is deliberately no self-serve path to admin. Run this once for the creator and Carson.
 */
async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("usage: npm run make-admin -- <email>");
    process.exit(2);
  }
  const env = parseEnv();
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });
  const db = drizzle({ client: pool, schema, casing: "snake_case" });
  const user = await db.query.users.findFirst({
    where: sql`lower(${schema.users.email}) = ${email}`,
  });
  if (!user) {
    console.error("no account with that email; sign up first");
    process.exit(1);
  }
  await db
    .update(schema.users)
    .set({ role: "admin", updatedAt: new Date() })
    .where(eq(schema.users.id, user.id));
  await recordAudit(db, {
    action: "user.role.admin",
    targetType: "user",
    targetId: user.id,
    metadata: { via: "make-admin script" },
  });
  console.log(`@${user.handle} is now an admin`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
