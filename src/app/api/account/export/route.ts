import { NextResponse } from "next/server";
import { exportAccountData } from "@/account/privacy";
import { getCurrentUser, requestMeta } from "@/auth/session";
import { getDb } from "@/db/client";
import { consumeRateLimit, RATE_RULES } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Download of everything held about the signed-in account (JSON). Rate limited, audited. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const db = getDb();
  const rl = await consumeRateLimit(db, `export:user:${user.id}`, RATE_RULES.accountExportPerUser);
  if (!rl.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const data = await exportAccountData(db, user.id, await requestMeta());
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
