"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/auth/session";
import {
  createPost,
  createVideoMedia,
  deleteMedia,
  postInputSchema,
  publishPost,
  syncVideoStatus,
  unpublishPost,
  updatePost,
} from "@/content/service";
import { getDb } from "@/db/client";
import { getImageStorage, getVideoProvider } from "@/media";
import type { UploadInstructions } from "@/media/types";
import { logger } from "@/lib/logger";
import { requestMeta } from "@/auth/session";
import { linkMedia, unlinkMedia } from "@/compliance/vault";
import { getVaultKeyring } from "@/compliance/vault-session";

export interface AdminActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

function parsePost(form: FormData) {
  return postInputSchema.safeParse({
    title: form.get("title"),
    caption: form.get("caption"),
    tier: form.get("tier"),
    price: form.get("price"),
  });
}

export async function createPostAction(
  _prev: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const parsed = parsePost(form);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const post = await createPost(getDb(), admin.id, parsed.data);
  redirect(`/admin/posts/${post.id}`);
}

export async function updatePostAction(
  _prev: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const parsed = parsePost(form);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const row = await updatePost(getDb(), admin.id, id, parsed.data);
  if (!row) return { error: "Post not found" };
  revalidatePath(`/admin/posts/${id}`);
  return { ok: true };
}

export async function publishPostAction(
  _prev: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const when = String(form.get("publishAt") ?? "").trim();
  const publishAt = when ? new Date(when) : null;
  const result = await publishPost(getDb(), admin.id, id, publishAt);
  if (!result.ok) {
    return {
      error:
        result.error === "no_ready_media"
          ? "Add at least one finished photo or video before publishing."
          : result.error === "bad_schedule"
            ? "That schedule time is not valid."
            : result.error === "missing_2257"
              ? `${result.mediaIds?.length ?? 0} media item(s) are not linked to a verified 2257 record. Link every item below before publishing.`
              : "Post not found.",
    };
  }
  revalidatePath(`/admin/posts/${id}`);
  revalidatePath("/feed");
  return { ok: true };
}

export async function unpublishPostAction(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const to = form.get("to") === "archived" ? "archived" : "draft";
  await unpublishPost(getDb(), admin.id, id, to);
  revalidatePath(`/admin/posts/${id}`);
  revalidatePath("/feed");
}

export async function startVideoUploadAction(
  postId: string,
  title: string,
): Promise<{ mediaId: string; upload: UploadInstructions } | { error: string }> {
  const admin = await requireAdmin();
  if (!/^[0-9a-f-]{36}$/.test(postId)) return { error: "bad post" };
  try {
    const { media, upload } = await createVideoMedia(
      getDb(),
      getVideoProvider(),
      admin.id,
      postId,
      title.slice(0, 140) || "video",
    );
    return { mediaId: media.id, upload };
  } catch (err) {
    logger.error({ err, postId }, "start video upload failed");
    return { error: "Could not start the upload. Check the video provider configuration." };
  }
}

export async function syncVideoAction(
  mediaId: string,
): Promise<{ status: string } | { error: string }> {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/.test(mediaId)) return { error: "bad media" };
  try {
    const row = await syncVideoStatus(getDb(), getVideoProvider(), getImageStorage(), mediaId);
    if (row) revalidatePath(`/admin/posts/${row.postId}`);
    return { status: row?.status ?? "unknown" };
  } catch (err) {
    logger.error({ err, mediaId }, "sync video failed");
    return { error: "Could not check the video status." };
  }
}

export async function deleteMediaAction(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const mediaId = String(form.get("mediaId") ?? "");
  const postId = String(form.get("postId") ?? "");
  if (/^[0-9a-f-]{36}$/.test(mediaId))
    await deleteMedia(getDb(), getVideoProvider(), getImageStorage(), admin.id, mediaId);
  revalidatePath(`/admin/posts/${postId}`);
}

const LINK_ERRORS: Record<string, string> = {
  media_not_found: "Media not found.",
  performer_not_verified: "That record is not verified.",
  underage_at_production:
    "The performer was under 18 on that production date. This cannot be linked.",
  future_date: "The production date cannot be in the future.",
  bad_date: "Enter the date the content was produced.",
  duplicate: "Already linked.",
};

/** Links media to a verified 2257 record (stage names only on this page; no vault unlock). Audited. */
export async function linkPerformerAction(
  _prev: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const meta = await requestMeta();
  const mediaId = String(form.get("mediaId") ?? "");
  const postId = String(form.get("postId") ?? "");
  const performerId = String(form.get("performerId") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(mediaId) || !/^[0-9a-f-]{36}$/.test(performerId))
    return { error: "Bad request." };
  const r = await linkMedia(
    getDb(),
    getVaultKeyring(),
    { userId: admin.id, ipPrefix: meta.ipPrefix },
    {
      mediaId,
      performerId,
      productionDate: String(form.get("productionDate") ?? ""),
    },
  );
  if (!r.ok) return { error: LINK_ERRORS[r.error] };
  revalidatePath(`/admin/posts/${postId}`);
  return { ok: true };
}

export async function unlinkPerformerAction(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const linkId = String(form.get("linkId") ?? "");
  const postId = String(form.get("postId") ?? "");
  if (/^[0-9a-f-]{36}$/.test(linkId)) await unlinkMedia(getDb(), { userId: admin.id }, linkId);
  revalidatePath(`/admin/posts/${postId}`);
}
