import { NextResponse, type NextRequest } from "next/server";
import { crossSiteRejection } from "@/lib/same-origin";
import { getCurrentUser } from "@/auth/session";
import { createImageMedia, getPost } from "@/content/service";
import { getDb } from "@/db/client";
import { getImageStorage } from "@/media";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/media/images";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Image upload (multipart: postId, file). Images pass through our server so they can be
 * re-encoded (metadata stripped) and blurred. Note: Vercel serverless functions cap request
 * bodies around 4.5 MB; larger photos must be resized before upload or routed via a direct
 * upload in a later phase.
 */
export async function POST(request: NextRequest) {
  const csrf = crossSiteRejection(request);
  if (csrf) return csrf;
  const user = await getCurrentUser();
  if (!user || user.role !== "admin")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "bad_form" }, { status: 400 });
  }
  const postId = String(form.get("postId") ?? "");
  const file = form.get("file");
  if (!/^[0-9a-f-]{36}$/.test(postId) || !(file instanceof File))
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (!ACCEPTED_IMAGE_TYPES.has(file.type))
    return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
  if (file.size > MAX_IMAGE_BYTES)
    return NextResponse.json({ error: "too_large" }, { status: 413 });

  const db = getDb();
  if (!(await getPost(db, postId)))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const row = await createImageMedia(
      db,
      getImageStorage(),
      user.id,
      postId,
      Buffer.from(await file.arrayBuffer()),
    );
    return NextResponse.json({ ok: true, mediaId: row.id });
  } catch (err) {
    logger.error({ err, postId }, "image upload failed");
    return NextResponse.json({ error: "processing_failed" }, { status: 422 });
  }
}
