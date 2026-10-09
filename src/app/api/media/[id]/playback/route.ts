import { NextResponse, type NextRequest } from "next/server";
import { crossSiteRejection } from "@/lib/same-origin";
import { consumeRateLimit, RATE_RULES } from "@/lib/rate-limit";
import { resolveAccessFor } from "@/access/entitlements";
import { getCurrentUser, requestMeta } from "@/auth/session";
import { getMedia } from "@/content/service";
import { compliantMediaIds } from "@/compliance/vault";
import { issueViewGrants } from "@/content/playback";
import { getDb } from "@/db/client";
import { getImageStorage, getVideoProvider } from "@/media";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Refreshes signed playback for one media item. The viewer calls this before a token expires.
 * Same entitlement check as the page: no user, no verification or no entitlement => 403.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const csrf = crossSiteRejection(request);
  if (csrf) return csrf;
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const db = getDb();
  // Caps how fast one account can mint signed URLs (scraping / sharing a session).
  const rl = await consumeRateLimit(db, `playback:user:${user.id}`, RATE_RULES.playbackPerUser);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "retry-after": String(rl.retryAfterSeconds) } },
    );
  }
  const m = await getMedia(db, id);
  if (!m) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const access = await resolveAccessFor(db, user, m.post);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: 403 });
  if (user.role !== "admin" && !(await compliantMediaIds(db, [m.id])).has(m.id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  try {
    const meta = await requestMeta();
    const grants = await issueViewGrants(
      db,
      { video: getVideoProvider(), storage: getImageStorage() },
      { user, items: [m], ipPrefix: meta.ipPrefix },
    );
    return NextResponse.json(grants, { headers: { "cache-control": "private, no-store" } });
  } catch (err) {
    logger.error({ err, mediaId: id }, "playback grant failed");
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
