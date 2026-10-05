import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Liveness + database reachability. Returns no configuration or version details. */
export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({ ok: true, db: "up" });
  } catch (err) {
    logger.error({ err }, "health check: database unreachable");
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
