import { and, asc, desc, eq, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { recordAudit } from "@/auth/audit";
import { media, posts } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { blurForPreview, posterFromBuffer, processImage } from "@/media/images";
import type { ImageStorage, UploadInstructions, VideoProvider } from "@/media/types";

export type Post = typeof posts.$inferSelect;
export type Media = typeof media.$inferSelect;
export type PostWithMedia = Post & { media: Media[] };

export const postInputSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(140),
    caption: z.string().trim().max(5000).optional().or(z.literal("")),
    tier: z.enum(["free", "subscriber", "ppv"]),
    /** Dollars as typed in the form; converted to cents. */
    price: z.string().trim().optional().or(z.literal("")),
  })
  .transform((v) => ({
    title: v.title,
    caption: v.caption ? v.caption : null,
    tier: v.tier,
    priceCents: v.price ? Math.round(Number(v.price) * 100) : null,
  }))
  .refine(
    (v) =>
      v.tier !== "ppv" ||
      (v.priceCents != null && Number.isFinite(v.priceCents) && v.priceCents >= 100),
    {
      path: ["price"],
      message: "Pay-per-view posts need a price of at least $1.00",
    },
  );

export type PostInput = z.infer<typeof postInputSchema>;

// ---------- reads ----------
export const publishedWhere = (now: Date) =>
  or(eq(posts.status, "published"), and(eq(posts.status, "scheduled"), lte(posts.publishAt, now)));

export async function listPublishedPosts(db: AppDb, now = new Date()): Promise<PostWithMedia[]> {
  const rows = await db.query.posts.findMany({
    where: publishedWhere(now),
    orderBy: [desc(sql`coalesce(${posts.publishedAt}, ${posts.publishAt}, ${posts.createdAt})`)],
    with: { media: { orderBy: [asc(media.sortOrder), asc(media.createdAt)] } },
  });
  return rows;
}

export async function listAllPosts(db: AppDb): Promise<PostWithMedia[]> {
  return db.query.posts.findMany({
    orderBy: [desc(posts.createdAt)],
    with: { media: { orderBy: [asc(media.sortOrder), asc(media.createdAt)] } },
  });
}

export async function getPost(db: AppDb, id: string): Promise<PostWithMedia | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const row = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    with: { media: { orderBy: [asc(media.sortOrder), asc(media.createdAt)] } },
  });
  return row ?? null;
}

export async function getMedia(db: AppDb, id: string): Promise<(Media & { post: Post }) | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const row = await db.query.media.findFirst({ where: eq(media.id, id), with: { post: true } });
  return row ?? null;
}

// ---------- admin writes ----------
export async function createPost(db: AppDb, adminId: string, input: PostInput): Promise<Post> {
  const [row] = await db
    .insert(posts)
    .values({
      title: input.title,
      caption: input.caption,
      tier: input.tier,
      priceCents: input.priceCents,
    })
    .returning();
  await recordAudit(db, {
    actorUserId: adminId,
    action: "post.create",
    targetType: "post",
    targetId: row.id,
  });
  return row;
}

export async function updatePost(
  db: AppDb,
  adminId: string,
  id: string,
  input: PostInput,
): Promise<Post | null> {
  const [row] = await db
    .update(posts)
    .set({
      title: input.title,
      caption: input.caption,
      tier: input.tier,
      priceCents: input.priceCents,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, id))
    .returning();
  if (row)
    await recordAudit(db, {
      actorUserId: adminId,
      action: "post.update",
      targetType: "post",
      targetId: id,
    });
  return row ?? null;
}

export type PublishResult =
  { ok: true; post: Post } | { ok: false; error: "not_found" | "no_ready_media" | "bad_schedule" };

/**
 * Publishing requires at least one ready media item. (Phase 5 adds: and a linked 2257 record.)
 * publishAt in the future => scheduled; otherwise published now.
 */
export async function publishPost(
  db: AppDb,
  adminId: string,
  id: string,
  publishAt: Date | null,
  now = new Date(),
): Promise<PublishResult> {
  const post = await getPost(db, id);
  if (!post) return { ok: false, error: "not_found" };
  if (!post.media.some((m) => m.status === "ready")) return { ok: false, error: "no_ready_media" };
  if (publishAt && Number.isNaN(publishAt.getTime())) return { ok: false, error: "bad_schedule" };

  const scheduled = !!publishAt && publishAt.getTime() > now.getTime();
  const [row] = await db
    .update(posts)
    .set(
      scheduled
        ? { status: "scheduled", publishAt, publishedAt: null, updatedAt: now }
        : { status: "published", publishAt: null, publishedAt: now, updatedAt: now },
    )
    .where(eq(posts.id, id))
    .returning();
  await recordAudit(db, {
    actorUserId: adminId,
    action: scheduled ? "post.schedule" : "post.publish",
    targetType: "post",
    targetId: id,
    metadata: scheduled ? { publishAt: publishAt!.toISOString() } : undefined,
  });
  return { ok: true, post: row };
}

export async function unpublishPost(
  db: AppDb,
  adminId: string,
  id: string,
  to: "draft" | "archived",
): Promise<Post | null> {
  const [row] = await db
    .update(posts)
    .set({ status: to, publishAt: null, updatedAt: new Date() })
    .where(eq(posts.id, id))
    .returning();
  if (row)
    await recordAudit(db, {
      actorUserId: adminId,
      action: `post.${to}`,
      targetType: "post",
      targetId: id,
    });
  return row ?? null;
}

// ---------- media ----------
export function imageKeys(mediaId: string) {
  return {
    original: `images/${mediaId}/original.jpg`,
    thumbnail: `images/${mediaId}/thumb.jpg`,
    blurred: `images/${mediaId}/blur.jpg`,
  };
}

export function videoPosterKeys(mediaId: string) {
  return { thumbnail: `videos/${mediaId}/poster.jpg`, blurred: `videos/${mediaId}/blur.jpg` };
}

export async function createImageMedia(
  db: AppDb,
  storage: ImageStorage,
  adminId: string,
  postId: string,
  file: Buffer,
): Promise<Media> {
  const processed = await processImage(file);
  const [row] = await db
    .insert(media)
    .values({
      postId,
      kind: "image",
      provider: storage.name,
      providerAssetId: `pending`,
      status: "processing",
      contentType: processed.original.contentType,
      sizeBytes: processed.original.data.length,
      width: processed.original.width,
      height: processed.original.height,
    })
    .returning();
  const keys = imageKeys(row.id);
  await Promise.all([
    storage.put(keys.original, processed.original.data, "image/jpeg"),
    storage.put(keys.thumbnail, processed.thumbnail.data, "image/jpeg"),
    storage.put(keys.blurred, processed.blurred.data, "image/jpeg"),
  ]);
  const [done] = await db
    .update(media)
    .set({
      providerAssetId: keys.original,
      storageKey: keys.original,
      thumbnailKey: keys.thumbnail,
      blurredPreviewKey: keys.blurred,
      status: "ready",
      updatedAt: new Date(),
    })
    .where(eq(media.id, row.id))
    .returning();
  await recordAudit(db, {
    actorUserId: adminId,
    action: "media.image.upload",
    targetType: "media",
    targetId: row.id,
    metadata: { postId },
  });
  return done;
}

export async function createVideoMedia(
  db: AppDb,
  provider: VideoProvider,
  adminId: string,
  postId: string,
  title: string,
): Promise<{ media: Media; upload: UploadInstructions }> {
  const [row] = await db
    .insert(media)
    .values({
      postId,
      kind: "video",
      provider: provider.name,
      providerAssetId: "pending",
      status: "uploading",
    })
    .returning();
  const created = await provider.createUpload({ title, mediaId: row.id });
  const [updated] = await db
    .update(media)
    .set({ providerAssetId: created.assetId, updatedAt: new Date() })
    .where(eq(media.id, row.id))
    .returning();
  await recordAudit(db, {
    actorUserId: adminId,
    action: "media.video.create",
    targetType: "media",
    targetId: row.id,
    metadata: { postId },
  });
  return { media: updated, upload: created.upload };
}

/** Called after the browser finishes uploading and on later admin page loads until ready. */
export async function syncVideoStatus(
  db: AppDb,
  provider: VideoProvider,
  storage: ImageStorage,
  mediaId: string,
): Promise<Media | null> {
  const row = await db.query.media.findFirst({ where: eq(media.id, mediaId) });
  if (!row || row.kind !== "video" || row.providerAssetId === "pending") return row ?? null;
  if (row.status === "ready" && row.thumbnailKey) return row;

  const st = await provider.getStatus(row.providerAssetId);
  const patch: Partial<typeof media.$inferInsert> = {
    status: st.status === "ready" ? "ready" : st.status === "failed" ? "failed" : "processing",
    durationSeconds: st.durationSeconds ?? row.durationSeconds,
    width: st.width ?? row.width,
    height: st.height ?? row.height,
    updatedAt: new Date(),
  };
  if (st.status === "ready" && !row.thumbnailKey) {
    const poster = await provider.fetchThumbnail(row.providerAssetId);
    if (poster) {
      const keys = videoPosterKeys(row.id);
      await Promise.all([
        storage.put(keys.thumbnail, await posterFromBuffer(poster), "image/jpeg"),
        storage.put(keys.blurred, await blurForPreview(poster), "image/jpeg"),
      ]);
      patch.thumbnailKey = keys.thumbnail;
      patch.blurredPreviewKey = keys.blurred;
    }
  }
  const [updated] = await db.update(media).set(patch).where(eq(media.id, row.id)).returning();
  return updated;
}

export async function deleteMedia(
  db: AppDb,
  provider: VideoProvider,
  storage: ImageStorage,
  adminId: string,
  mediaId: string,
): Promise<boolean> {
  const row = await db.query.media.findFirst({ where: eq(media.id, mediaId) });
  if (!row) return false;
  if (row.kind === "video" && row.providerAssetId !== "pending")
    await provider.delete(row.providerAssetId).catch(() => {});
  for (const key of [row.storageKey, row.thumbnailKey, row.blurredPreviewKey]) {
    if (key) await storage.delete(key).catch(() => {});
  }
  await db.delete(media).where(eq(media.id, mediaId));
  await recordAudit(db, {
    actorUserId: adminId,
    action: "media.delete",
    targetType: "media",
    targetId: mediaId,
    metadata: { postId: row.postId },
  });
  return true;
}
