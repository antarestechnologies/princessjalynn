import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { signLocalPath } from "./signing";
import {
  assertSafeKey,
  type ImageStorage,
  type PlaybackSource,
  type UploadInstructions,
  type VideoProvider,
} from "./types";

/**
 * Development-only storage: files under MEDIA_LOCAL_DIR, served by /api/media/local/[...path]
 * which verifies an HMAC token and expiry. Mirrors the shape of the Bunny adapters so the
 * rest of the app cannot tell the difference. The env schema refuses it in production.
 */
export class FakeImageStorage implements ImageStorage {
  readonly name = "fake";
  constructor(
    private readonly dir: string,
    private readonly appUrl: string,
    private readonly secret: string,
  ) {}

  filePath(key: string): string {
    assertSafeKey(key);
    const abs = path.resolve(this.dir, key);
    if (!abs.startsWith(path.resolve(this.dir) + path.sep)) throw new Error("unsafe storage key");
    return abs;
  }

  async put(key: string, data: Buffer, _contentType?: string): Promise<void> {
    const file = this.filePath(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
  }

  async read(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.filePath(key));
    } catch {
      return null;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.filePath(key));
      return true;
    } catch {
      return false;
    }
  }

  signUrl(key: string, opts: { expiresAt: Date }): string {
    assertSafeKey(key);
    const { token, expires } = signLocalPath(key, opts.expiresAt, this.secret);
    const url = new URL(`/api/media/local/${key}`, this.appUrl);
    url.searchParams.set("expires", String(expires));
    url.searchParams.set("token", token);
    return url.toString();
  }

  async delete(key: string): Promise<void> {
    await rm(this.filePath(key), { force: true });
  }
}

export class FakeVideoProvider implements VideoProvider {
  readonly name = "fake";
  constructor(
    private readonly storage: FakeImageStorage,
    private readonly appUrl: string,
  ) {}

  static keyFor(assetId: string) {
    return `video/${assetId}.bin`;
  }

  async createUpload(input: {
    title: string;
    mediaId: string;
  }): Promise<{ assetId: string; upload: UploadInstructions }> {
    const assetId = input.mediaId;
    const url = new URL("/api/admin/media/upload", this.appUrl);
    url.searchParams.set("mediaId", input.mediaId);
    return { assetId, upload: { method: "put", url: url.toString() } };
  }

  async getStatus(assetId: string) {
    const ready = await this.storage.exists(FakeVideoProvider.keyFor(assetId));
    return { status: ready ? ("ready" as const) : ("processing" as const) };
  }

  async signPlayback(assetId: string, opts: { expiresAt: Date }): Promise<PlaybackSource> {
    return {
      kind: "video",
      url: this.storage.signUrl(FakeVideoProvider.keyFor(assetId), opts),
      contentType: "video/mp4",
    };
  }

  /** No ffmpeg locally; the UI shows a generic poster for fake videos. */
  async fetchThumbnail(): Promise<Buffer | null> {
    return null;
  }

  async delete(assetId: string): Promise<void> {
    await this.storage.delete(FakeVideoProvider.keyFor(assetId));
  }
}
