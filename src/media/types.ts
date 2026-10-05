/**
 * Media vendor boundary. Everything that talks to Bunny (or any replacement) lives behind
 * these two interfaces so the vendor can be swapped (PLAN.md stack note). Rules enforced by
 * callers, not providers: a URL is only ever produced by signPlayback/signUrl with an expiry,
 * never stored, and only after an entitlement check (non-negotiable #2).
 */

export type UploadInstructions =
  /** Browser PUTs raw bytes to this URL (our own route; used by the fake provider). */
  | { method: "put"; url: string; headers?: Record<string, string> }
  /** Browser uploads with the tus resumable protocol straight to the vendor (no bytes through Vercel). */
  | {
      method: "tus";
      endpoint: string;
      headers: Record<string, string>;
      metadata: Record<string, string>;
    };

export type PlaybackSource =
  /** Vendor-hosted player in an iframe (Bunny). The URL carries the viewer's expiring token. */
  | { kind: "iframe"; url: string }
  /** A progressive or HLS URL for an HTML5 <video>. */
  | { kind: "video"; url: string; contentType?: string }
  /** A signed URL for a full-size image. */
  | { kind: "image"; url: string };

export type VideoStatus = "processing" | "ready" | "failed";

export interface VideoProvider {
  readonly name: string;
  createUpload(input: {
    title: string;
    mediaId: string;
  }): Promise<{ assetId: string; upload: UploadInstructions }>;
  getStatus(
    assetId: string,
  ): Promise<{ status: VideoStatus; durationSeconds?: number; width?: number; height?: number }>;
  signPlayback(assetId: string, opts: { expiresAt: Date }): Promise<PlaybackSource>;
  /** Poster frame bytes, or null if the vendor has none (yet). We blur and store it ourselves. */
  fetchThumbnail(assetId: string): Promise<Buffer | null>;
  delete(assetId: string): Promise<void>;
}

export interface ImageStorage {
  readonly name: string;
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  /** Signed, expiring URL for a stored object. Synchronous: it is pure HMAC math. */
  signUrl(key: string, opts: { expiresAt: Date }): string;
  delete(key: string): Promise<void>;
}

/** Keys are generated server-side only; this rejects anything that could escape the prefix. */
export function assertSafeKey(key: string): void {
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9/_.-]{0,200}$/.test(key) ||
    key.includes("..") ||
    key.includes("//")
  ) {
    throw new Error("unsafe storage key");
  }
}
