import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { crossSiteRejection } from "@/lib/same-origin";
import { recordAudit } from "@/auth/audit";
import { getCurrentUser } from "@/auth/session";
import { getDb } from "@/db/client";
import { media } from "@/db/schema";
import { getImageStorage } from "@/media";
import { FakeImageStorage, FakeVideoProvider } from "@/media/fake";

export const dynamic = "force-dynamic";
const MAX_LOCAL_VIDEO_BYTES = 200 * 1024 * 1024;

/**
 * Fake-provider video upload target (dev only). Receives the raw file and stores it on disk.
 * With Bunny the browser uploads straight to the vendor via tus and this route answers 404.
 */
export async function PUT(request: NextRequest) {
  const csrf = crossSiteRejection(request);
  if (csrf) return csrf;
  const user = await getCurrentUser();
  if (!user || user.role !== "admin")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const storage = getImageStorage();
  if (!(storage instanceof FakeImageStorage)) return new NextResponse(null, { status: 404 });

  const mediaId = request.nextUrl.searchParams.get("mediaId") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(mediaId))
    return NextResponse.json({ error: "bad_media_id" }, { status: 400 });
  const db = getDb();
  const row = await db.query.media.findFirst({ where: eq(media.id, mediaId) });
  if (!row || row.kind !== "video" || row.provider !== "fake")
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  const data = Buffer.from(await request.arrayBuffer());
  if (data.length === 0 || data.length > MAX_LOCAL_VIDEO_BYTES)
    return NextResponse.json({ error: "bad_size" }, { status: 413 });
  await storage.put(
    FakeVideoProvider.keyFor(row.providerAssetId),
    data,
    request.headers.get("content-type") ?? "video/mp4",
  );
  await db
    .update(media)
    .set({
      status: "ready",
      sizeBytes: data.length,
      contentType: request.headers.get("content-type") ?? "video/mp4",
      updatedAt: new Date(),
    })
    .where(eq(media.id, mediaId));
  await recordAudit(db, {
    actorUserId: user.id,
    action: "media.video.uploaded",
    targetType: "media",
    targetId: mediaId,
  });
  return NextResponse.json({ ok: true });
}
