import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";
import { serveLocal } from "@/app/api/media/local/[...path]/route";
import { FakeImageStorage, FakeVideoProvider } from "./fake";

const S = "test-secret-that-is-at-least-32-characters-long";
let storage: FakeImageStorage;

beforeAll(async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "media-test-"));
  storage = new FakeImageStorage(dir, "https://members.example", S);
  process.env.SESSION_SECRET = S;
  await storage.put("images/m1/original.jpg", Buffer.from("fake-jpeg-bytes"), "image/jpeg");
});

function reqFor(url: string) {
  return new NextRequest(url);
}

describe("fake storage delivery (guessing URLs must fail)", () => {
  it("serves a correctly signed, unexpired URL", async () => {
    const url = storage.signUrl("images/m1/original.jpg", {
      expiresAt: new Date(Date.now() + 60_000),
    });
    const res = await serveLocal(reqFor(url), ["images", "m1", "original.jpg"], storage);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("fake-jpeg-bytes");
  });

  it("rejects the bare path (no token), a wrong token, and a token for another key", async () => {
    const bare = await serveLocal(
      reqFor("https://members.example/api/media/local/images/m1/original.jpg"),
      ["images", "m1", "original.jpg"],
      storage,
    );
    expect(bare.status).toBe(403);
    const forged = await serveLocal(
      reqFor(
        "https://members.example/api/media/local/images/m1/original.jpg?expires=9999999999&token=abc",
      ),
      ["images", "m1", "original.jpg"],
      storage,
    );
    expect(forged.status).toBe(403);
    const other = storage.signUrl("images/m2/original.jpg", {
      expiresAt: new Date(Date.now() + 60_000),
    });
    const swapped = new URL(other);
    swapped.pathname = "/api/media/local/images/m1/original.jpg";
    const res = await serveLocal(
      reqFor(swapped.toString()),
      ["images", "m1", "original.jpg"],
      storage,
    );
    expect(res.status).toBe(403);
  });

  it("rejects an expired token (proves tokens expire)", async () => {
    const url = storage.signUrl("images/m1/original.jpg", {
      expiresAt: new Date(Date.now() + 60_000),
    });
    const later = new Date(Date.now() + 120_000);
    const res = await serveLocal(reqFor(url), ["images", "m1", "original.jpg"], storage, later);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "token_expired" });
  });

  it("rejects path traversal and never reads outside the media dir", async () => {
    const res = await serveLocal(
      reqFor("https://members.example/api/media/local/..%2F..%2Fetc%2Fpasswd"),
      ["..", "..", "etc", "passwd"],
      storage,
    );
    expect(res.status).toBe(400);
    expect(() => storage.filePath("../outside")).toThrow(/unsafe/);
    expect(() => storage.signUrl("images/../../x", { expiresAt: new Date() })).toThrow(/unsafe/);
  });

  it("404s for a signed path that does not exist", async () => {
    const url = storage.signUrl("images/nope/original.jpg", {
      expiresAt: new Date(Date.now() + 60_000),
    });
    const res = await serveLocal(reqFor(url), ["images", "nope", "original.jpg"], storage);
    expect(res.status).toBe(404);
  });
});

describe("FakeVideoProvider", () => {
  it("reports processing until bytes exist, then signs an expiring playback URL", async () => {
    const video = new FakeVideoProvider(storage, "https://members.example");
    const created = await video.createUpload({
      title: "t",
      mediaId: "11111111-1111-4111-8111-111111111111",
    });
    expect(created.upload.method).toBe("put");
    expect((await video.getStatus(created.assetId)).status).toBe("processing");
    await storage.put(FakeVideoProvider.keyFor(created.assetId), Buffer.from("mp4"), "video/mp4");
    expect((await video.getStatus(created.assetId)).status).toBe("ready");
    const src = await video.signPlayback(created.assetId, {
      expiresAt: new Date(Date.now() + 1000),
    });
    expect(src.kind).toBe("video");
    expect(src.url).toMatch(/token=/);
  });
});
