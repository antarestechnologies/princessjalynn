import { createHash } from "node:crypto";
import {
  assertSafeKey,
  type ImageStorage,
  type PlaybackSource,
  type UploadInstructions,
  type VideoProvider,
} from "./types";

/**
 * Bunny.net adapters. API shapes follow Bunny's public docs as of the Phase 0 research:
 *   Stream API      https://docs.bunny.net/reference/video_createvideo etc. (video.bunnycdn.com)
 *   TUS upload      https://docs.bunny.net/reference/tus-resumable-uploads
 *   Embed token     https://docs.bunny.net/stream/embed-token-authentication
 *   Storage API     https://docs.bunny.net/reference/storage-api
 *   CDN token auth  https://docs.bunny.net/cdn/security/token-authentication/advanced
 * The research sandbox could not open those pages, so the exact header names and hash
 * recipes below must be confirmed against the live docs before the first real upload.
 * Every request here is server-side; the API key and storage password never reach a browser.
 */

export interface BunnyStreamConfig {
  libraryId: string;
  apiKey: string;
  /** e.g. vz-abc123.b-cdn.net */
  cdnHost: string;
  /** Embed view token authentication key (also used for the library CDN token auth). */
  tokenKey: string;
  fetchImpl?: typeof fetch;
}

const STREAM_API = "https://video.bunnycdn.com";

function sha256Hex(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

/** Bunny CDN "advanced" token: base64url(sha256_raw(key + path + expires)). */
export function bunnyCdnToken(
  tokenKey: string,
  pathWithLeadingSlash: string,
  expires: number,
): string {
  return createHash("sha256")
    .update(`${tokenKey}${pathWithLeadingSlash}${expires}`)
    .digest("base64url");
}

/** Bunny Stream embed token: sha256_hex(key + videoId + expires). */
export function bunnyEmbedToken(tokenKey: string, videoId: string, expires: number): string {
  return sha256Hex(`${tokenKey}${videoId}${expires}`);
}

/** Bunny TUS presigned signature: sha256_hex(libraryId + apiKey + expire + videoId). */
export function bunnyTusSignature(
  libraryId: string,
  apiKey: string,
  expire: number,
  videoId: string,
): string {
  return sha256Hex(`${libraryId}${apiKey}${expire}${videoId}`);
}

export class BunnyVideoProvider implements VideoProvider {
  readonly name = "bunny";
  private readonly f: typeof fetch;
  constructor(private readonly cfg: BunnyStreamConfig) {
    this.f = cfg.fetchImpl ?? fetch;
  }

  private async api(pathname: string, init: RequestInit = {}) {
    const res = await this.f(`${STREAM_API}/library/${this.cfg.libraryId}${pathname}`, {
      ...init,
      headers: { AccessKey: this.cfg.apiKey, accept: "application/json", ...(init.headers ?? {}) },
    });
    if (!res.ok)
      throw new Error(`Bunny Stream ${init.method ?? "GET"} ${pathname} -> ${res.status}`);
    return res;
  }

  async createUpload(input: {
    title: string;
    mediaId: string;
  }): Promise<{ assetId: string; upload: UploadInstructions }> {
    const res = await this.api("/videos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: input.title }),
    });
    const body = (await res.json()) as { guid: string };
    const expire = Math.floor(Date.now() / 1000) + 60 * 60; // presigned upload valid 1 hour
    return {
      assetId: body.guid,
      upload: {
        method: "tus",
        endpoint: `${STREAM_API}/tusupload`,
        headers: {
          AuthorizationSignature: bunnyTusSignature(
            this.cfg.libraryId,
            this.cfg.apiKey,
            expire,
            body.guid,
          ),
          AuthorizationExpire: String(expire),
          VideoId: body.guid,
          LibraryId: this.cfg.libraryId,
        },
        metadata: { title: input.title },
      },
    };
  }

  async getStatus(assetId: string) {
    const res = await this.api(`/videos/${encodeURIComponent(assetId)}`);
    const v = (await res.json()) as {
      status: number;
      length?: number;
      width?: number;
      height?: number;
    };
    // 0 created, 1 uploaded, 2 processing, 3 transcoding, 4 finished, 5 error, 6 upload failed
    const status = v.status === 4 ? "ready" : v.status >= 5 ? "failed" : "processing";
    return { status, durationSeconds: v.length, width: v.width, height: v.height } as const;
  }

  async signPlayback(assetId: string, opts: { expiresAt: Date }): Promise<PlaybackSource> {
    const expires = Math.floor(opts.expiresAt.getTime() / 1000);
    const url = new URL(`https://iframe.mediadelivery.net/embed/${this.cfg.libraryId}/${assetId}`);
    url.searchParams.set("token", bunnyEmbedToken(this.cfg.tokenKey, assetId, expires));
    url.searchParams.set("expires", String(expires));
    url.searchParams.set("autoplay", "false");
    url.searchParams.set("preload", "true");
    return { kind: "iframe", url: url.toString() };
  }

  async fetchThumbnail(assetId: string): Promise<Buffer | null> {
    const expires = Math.floor(Date.now() / 1000) + 300;
    const p = `/${assetId}/thumbnail.jpg`;
    const url = `https://${this.cfg.cdnHost}${p}?token=${bunnyCdnToken(this.cfg.tokenKey, p, expires)}&expires=${expires}`;
    const res = await this.f(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(assetId: string): Promise<void> {
    await this.api(`/videos/${encodeURIComponent(assetId)}`, { method: "DELETE" });
  }
}

export interface BunnyStorageConfig {
  zone: string;
  password: string;
  storageHost: string;
  cdnHost: string;
  tokenKey: string;
  fetchImpl?: typeof fetch;
}

export class BunnyImageStorage implements ImageStorage {
  readonly name = "bunny";
  private readonly f: typeof fetch;
  constructor(private readonly cfg: BunnyStorageConfig) {
    this.f = cfg.fetchImpl ?? fetch;
  }

  private objectUrl(key: string) {
    assertSafeKey(key);
    return `https://${this.cfg.storageHost}/${this.cfg.zone}/${key}`;
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    const res = await this.f(this.objectUrl(key), {
      method: "PUT",
      headers: { AccessKey: this.cfg.password, "content-type": contentType },
      body: new Uint8Array(data),
    });
    if (!res.ok) throw new Error(`Bunny Storage PUT ${key} -> ${res.status}`);
  }

  signUrl(key: string, opts: { expiresAt: Date }): string {
    assertSafeKey(key);
    const expires = Math.floor(opts.expiresAt.getTime() / 1000);
    const p = `/${key}`;
    return `https://${this.cfg.cdnHost}${p}?token=${bunnyCdnToken(this.cfg.tokenKey, p, expires)}&expires=${expires}`;
  }

  async delete(key: string): Promise<void> {
    const res = await this.f(this.objectUrl(key), {
      method: "DELETE",
      headers: { AccessKey: this.cfg.password },
    });
    if (!res.ok && res.status !== 404)
      throw new Error(`Bunny Storage DELETE ${key} -> ${res.status}`);
  }
}
