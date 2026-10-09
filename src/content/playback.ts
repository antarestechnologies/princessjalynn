import { randomBytes } from "node:crypto";
import { playbackGrants, type media, type users } from "@/db/schema";
import type { AppDb } from "@/db/types";
import type { ImageStorage, PlaybackSource, VideoProvider } from "@/media/types";

type Media = typeof media.$inferSelect;
type User = typeof users.$inferSelect;

/** How long a signed playback URL lives. The viewer refreshes before expiry. */
export const PLAYBACK_TTL_SECONDS = 15 * 60;
/** Blurred previews and posters: still gated and signed, just longer-lived. */
export const PREVIEW_TTL_SECONDS = 60 * 60;

export interface ViewItem {
  mediaId: string;
  kind: "image" | "video";
  source: PlaybackSource | null;
  posterUrl: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  expiresAt: string;
  /** Drawn into the watermark with the handle so a leaked frame maps to one grant row. */
  nonce: string;
}

export interface Watermark {
  handle: string;
  nonce: string;
}

/**
 * Issues expiring URLs for media the caller has ALREADY authorised (resolveAccess said
 * allowed) and records a playback_grants row per item. Never call this before the check.
 */
export async function issueViewGrants(
  db: AppDb,
  deps: { video: VideoProvider; storage: ImageStorage },
  input: { user: User; items: Media[]; ipPrefix?: string | null },
  now = new Date(),
): Promise<{ items: ViewItem[]; watermark: Watermark }> {
  const expiresAt = new Date(now.getTime() + PLAYBACK_TTL_SECONDS * 1000);
  const posterExpiry = new Date(now.getTime() + PREVIEW_TTL_SECONDS * 1000);
  const nonce = randomBytes(4).toString("hex");
  const ready = input.items.filter((m) => m.status === "ready");

  const items: ViewItem[] = [];
  for (const m of ready) {
    let source: PlaybackSource | null = null;
    if (m.kind === "image" && m.storageKey) {
      source = { kind: "image", url: deps.storage.signUrl(m.storageKey, { expiresAt }) };
    } else if (m.kind === "video") {
      source = await deps.video.signPlayback(m.providerAssetId, { expiresAt });
    }
    items.push({
      mediaId: m.id,
      kind: m.kind,
      source,
      posterUrl: m.thumbnailKey
        ? deps.storage.signUrl(m.thumbnailKey, { expiresAt: posterExpiry })
        : null,
      width: m.width,
      height: m.height,
      durationSeconds: m.durationSeconds,
      expiresAt: expiresAt.toISOString(),
      nonce,
    });
  }
  if (items.length) {
    await db.insert(playbackGrants).values(
      items.map((i) => ({
        mediaId: i.mediaId,
        userId: input.user.id,
        expiresAt,
        ipPrefix: input.ipPrefix ?? null,
        watermarkNonce: nonce,
      })),
    );
  }
  return { items, watermark: { handle: input.user.handle, nonce } };
}

/** Locked-state artwork: blurred preview if we have one, else nothing. */
export function previewUrl(storage: ImageStorage, m: Media, now = new Date()): string | null {
  if (!m.blurredPreviewKey) return null;
  return storage.signUrl(m.blurredPreviewKey, {
    expiresAt: new Date(now.getTime() + PREVIEW_TTL_SECONDS * 1000),
  });
}

export function posterUrl(storage: ImageStorage, m: Media, now = new Date()): string | null {
  if (!m.thumbnailKey) return null;
  return storage.signUrl(m.thumbnailKey, {
    expiresAt: new Date(now.getTime() + PREVIEW_TTL_SECONDS * 1000),
  });
}
