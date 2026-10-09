import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { envProblems } from "@/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Liveness, configuration and database reachability. On a misconfigured deployment it lists
 * the NAMES of missing or invalid environment variables (never their values), so the cause is
 * visible without access to the logs. Returns no version or other configuration details.
 */
export async function GET() {
  const problems = envProblems();
  if (problems.length) {
    logger.error({ problems }, "health check: environment incomplete");
    return NextResponse.json(
      { ok: false, config: "incomplete", missingOrInvalid: problems },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({ ok: true, db: "up" }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    logger.error({ err }, "health check: database unreachable");
    return NextResponse.json(
      { ok: false, db: "down" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
