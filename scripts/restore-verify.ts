import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { keyringFromEnv } from "../src/compliance/vault-crypto";
import { decryptBlob } from "../src/compliance/vault-crypto";
import { getSessionSecret } from "../src/lib/age-gate";

/** Called by restore-check.sh against the restored copy. Exits non-zero on any problem. */
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const db = drizzle({ client: pool, schema, casing: "snake_case" });
  const tables = [
    "users",
    "posts",
    "media",
    "subscriptions",
    "purchases",
    "tips",
    "entitlements",
    "audit_log",
    "performers",
    "vault_documents",
    "media_performers",
    "webhook_events",
  ];
  const counts: Record<string, number> = {};
  for (const t of tables) {
    const r = await db.execute(sql.raw(`select count(*)::int as n from ${t}`));
    counts[t] = Number((r.rows[0] as { n: number }).n);
  }
  const migrations = await db.execute(
    sql`select count(*)::int as n from drizzle.__drizzle_migrations`,
  );
  console.log("migrations recorded:", (migrations.rows[0] as { n: number }).n);
  console.log("row counts:", counts);

  const kr = keyringFromEnv(process.env, getSessionSecret());
  const perfs = await db.select().from(schema.performers);
  for (const p of perfs) decryptBlob(kr, p.piiCiphertext, p.keyVersion, `performer:${p.id}`);
  const docs = await db.select().from(schema.vaultDocuments);
  for (const d of docs)
    decryptBlob(kr, d.ciphertext, d.keyVersion, `document:${d.id}:performer:${d.performerId}`);
  console.log(
    `vault: ${perfs.length} performer records and ${docs.length} documents decrypt with the configured key`,
  );

  const auditTriggers = await db.execute(
    sql`select count(*)::int as n from pg_trigger where tgname like 'audit_log_no_%'`,
  );
  if (Number((auditTriggers.rows[0] as { n: number }).n) !== 2)
    throw new Error("audit_log immutability triggers missing after restore");
  console.log("audit_log append-only triggers present");
  await pool.end();
  console.log("RESTORE CHECK PASSED");
}

main().catch((e) => {
  console.error("RESTORE CHECK FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
