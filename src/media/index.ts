import path from "node:path";
import { getEnv } from "@/env";
import { getSessionSecret } from "@/lib/age-gate";
import { BunnyImageStorage, BunnyVideoProvider } from "./bunny";
import { FakeImageStorage, FakeVideoProvider } from "./fake";
import type { ImageStorage, VideoProvider } from "./types";

let storage: ImageStorage | undefined;
let video: VideoProvider | undefined;

export function getImageStorage(): ImageStorage {
  if (storage) return storage;
  const env = getEnv();
  if (env.MEDIA_PROVIDER === "bunny") {
    storage = new BunnyImageStorage({
      zone: env.BUNNY_STORAGE_ZONE!,
      password: env.BUNNY_STORAGE_PASSWORD!,
      storageHost: env.BUNNY_STORAGE_HOST,
      cdnHost: env.BUNNY_CDN_HOST!,
      tokenKey: env.BUNNY_CDN_TOKEN_KEY!,
    });
  } else {
    storage = new FakeImageStorage(
      path.resolve(process.cwd(), env.MEDIA_LOCAL_DIR),
      env.APP_URL,
      getSessionSecret(),
    );
  }
  return storage;
}

export function getVideoProvider(): VideoProvider {
  if (video) return video;
  const env = getEnv();
  if (env.MEDIA_PROVIDER === "bunny") {
    video = new BunnyVideoProvider({
      libraryId: env.BUNNY_STREAM_LIBRARY_ID!,
      apiKey: env.BUNNY_STREAM_API_KEY!,
      cdnHost: env.BUNNY_STREAM_CDN_HOST!,
      tokenKey: env.BUNNY_STREAM_TOKEN_KEY!,
    });
  } else {
    video = new FakeVideoProvider(getImageStorage() as FakeImageStorage, env.APP_URL);
  }
  return video;
}

export function setMediaForTests(s: ImageStorage | undefined, v: VideoProvider | undefined) {
  storage = s;
  video = v;
}

export type { ImageStorage, PlaybackSource, UploadInstructions, VideoProvider } from "./types";
