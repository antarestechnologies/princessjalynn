import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
import {
  BunnyImageStorage,
  BunnyVideoProvider,
  bunnyCdnToken,
  bunnyEmbedToken,
  bunnyTusSignature,
} from "./bunny";

describe("bunny token recipes", () => {
  it("match the documented hash constructions", () => {
    expect(bunnyEmbedToken("k", "vid", 100)).toBe(
      createHash("sha256").update("kvid100").digest("hex"),
    );
    expect(bunnyTusSignature("lib", "api", 100, "vid")).toBe(
      createHash("sha256").update("libapi100vid").digest("hex"),
    );
    expect(bunnyCdnToken("k", "/images/a.jpg", 100)).toBe(
      createHash("sha256").update("k/images/a.jpg100").digest("base64url"),
    );
  });
});

describe("BunnyVideoProvider", () => {
  const cfg = {
    libraryId: "123",
    apiKey: "secret-api-key",
    cdnHost: "vz-x.b-cdn.net",
    tokenKey: "tok",
  };

  it("creates the video server-side and hands the browser a presigned tus upload without the API key", async () => {
    const fetchImpl = vi.fn<FetchLike>(
      async () => new Response(JSON.stringify({ guid: "abc-guid" }), { status: 200 }),
    );
    const p = new BunnyVideoProvider({ ...cfg, fetchImpl: fetchImpl as unknown as typeof fetch });
    const r = await p.createUpload({ title: "My clip", mediaId: "m1" });
    expect(fetchImpl.mock.calls[0]![0]).toBe("https://video.bunnycdn.com/library/123/videos");
    expect(
      ((fetchImpl.mock.calls[0]![1] as RequestInit).headers as Record<string, string>).AccessKey,
    ).toBe("secret-api-key");
    expect(r.assetId).toBe("abc-guid");
    expect(r.upload.method).toBe("tus");
    if (r.upload.method !== "tus") return;
    expect(r.upload.endpoint).toBe("https://video.bunnycdn.com/tusupload");
    expect(r.upload.headers.VideoId).toBe("abc-guid");
    expect(JSON.stringify(r.upload)).not.toContain("secret-api-key");
    const expire = Number(r.upload.headers.AuthorizationExpire);
    expect(r.upload.headers.AuthorizationSignature).toBe(
      bunnyTusSignature("123", "secret-api-key", expire, "abc-guid"),
    );
  });

  it("signs an embed URL whose token is bound to the video and expiry", async () => {
    const p = new BunnyVideoProvider(cfg);
    const exp = new Date("2026-01-01T00:10:00Z");
    const src = await p.signPlayback("abc-guid", { expiresAt: exp });
    const u = new URL(src.url);
    expect(src.kind).toBe("iframe");
    expect(u.origin + u.pathname).toBe("https://iframe.mediadelivery.net/embed/123/abc-guid");
    expect(u.searchParams.get("expires")).toBe(String(Math.floor(exp.getTime() / 1000)));
    expect(u.searchParams.get("token")).toBe(
      bunnyEmbedToken("tok", "abc-guid", Math.floor(exp.getTime() / 1000)),
    );
  });

  it("maps vendor status codes", async () => {
    for (const [code, expected] of [
      [4, "ready"],
      [3, "processing"],
      [5, "failed"],
    ] as const) {
      const fetchImpl = vi.fn(
        async () => new Response(JSON.stringify({ status: code, length: 12 }), { status: 200 }),
      );
      const p = new BunnyVideoProvider({ ...cfg, fetchImpl: fetchImpl as unknown as typeof fetch });
      expect((await p.getStatus("g")).status).toBe(expected);
    }
  });
});

describe("BunnyImageStorage", () => {
  const cfg = {
    zone: "zone",
    password: "pw",
    storageHost: "storage.bunnycdn.com",
    cdnHost: "cdn.example",
    tokenKey: "tok",
  };

  it("PUTs with the storage password and signs CDN URLs bound to path and expiry", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => new Response(null, { status: 201 }));
    const s = new BunnyImageStorage({ ...cfg, fetchImpl: fetchImpl as unknown as typeof fetch });
    await s.put("images/m/original.jpg", Buffer.from("x"), "image/jpeg");
    expect(fetchImpl.mock.calls[0]![0]).toBe(
      "https://storage.bunnycdn.com/zone/images/m/original.jpg",
    );
    const url = new URL(s.signUrl("images/m/original.jpg", { expiresAt: new Date(100_000) }));
    expect(url.host).toBe("cdn.example");
    expect(url.searchParams.get("expires")).toBe("100");
    expect(url.searchParams.get("token")).toBe(bunnyCdnToken("tok", "/images/m/original.jpg", 100));
    expect(() => s.signUrl("../x", { expiresAt: new Date() })).toThrow(/unsafe/);
  });
});
