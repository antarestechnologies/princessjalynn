import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { createGateCookieValue } from "./age-gate";
import { handleGate } from "./gate-proxy";
import { buildCsp } from "./security-headers";
import { crossSiteRejection } from "./same-origin";

const SECRET = "test-secret-that-is-at-least-32-characters-long";

describe("CSP", () => {
  it("uses a nonce with strict-dynamic, blocks framing and plugins, and allows only configured media hosts", () => {
    const csp = buildCsp(
      "abc",
      { cdnHost: "media-x.b-cdn.net", streamCdnHost: "vz-y.b-cdn.net" },
      false,
    );
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain(
      "img-src 'self' blob: data: https://media-x.b-cdn.net https://vz-y.b-cdn.net",
    );
    expect(csp).toContain("frame-src https://iframe.mediadelivery.net");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("ignores malformed host values instead of injecting them", () => {
    const csp = buildCsp(
      "n",
      { cdnHost: "evil.com; script-src *", checkoutOrigin: "not a url" },
      false,
    );
    expect(csp).not.toContain("evil.com");
    expect(csp).toContain("form-action 'self';");
  });

  it("is set on gated, passed and API responses with a fresh nonce each time", () => {
    const ok = createGateCookieValue(SECRET);
    const a = new NextRequest("https://m.example/feed");
    a.cookies.set("ag", ok);
    const r1 = handleGate(a, { secret: SECRET });
    const r2 = handleGate(a, { secret: SECRET });
    const n1 = r1.headers.get("content-security-policy")!.match(/nonce-([^']+)/)![1];
    const n2 = r2.headers.get("content-security-policy")!.match(/nonce-([^']+)/)![1];
    expect(n1).not.toBe(n2);
    expect(r1.headers.get("strict-transport-security")).toContain("max-age=");
    expect(r1.headers.get("permissions-policy")).toContain("camera=()");
    expect(
      handleGate(new NextRequest("https://m.example/feed"), { secret: SECRET }).headers.get(
        "content-security-policy",
      ),
    ).toBeTruthy();
    expect(
      handleGate(new NextRequest("https://m.example/api/x"), { secret: SECRET }).headers.get(
        "content-security-policy",
      ),
    ).toBeTruthy();
  });

  it("forwards the nonce to the app via the request headers", () => {
    const req = new NextRequest("https://m.example/gate");
    const res = handleGate(req, { secret: SECRET, nonce: "fixed" });
    expect(res.headers.get("x-middleware-request-x-nonce")).toBe("fixed");
  });
});

describe("crossSiteRejection", () => {
  const mk = (h: Record<string, string>) =>
    new NextRequest("https://m.example/api/admin/media/image", { method: "POST", headers: h });
  it("allows same-origin requests and requests without browser origin hints", () => {
    expect(crossSiteRejection(mk({ origin: "https://m.example", host: "m.example" }))).toBeNull();
    expect(
      crossSiteRejection(mk({ host: "m.example", "sec-fetch-site": "same-origin" })),
    ).toBeNull();
    expect(crossSiteRejection(mk({ host: "m.example" }))).toBeNull();
  });
  it("rejects cross-site origins, look-alike hosts and cross-site fetch metadata", () => {
    expect(
      crossSiteRejection(mk({ origin: "https://evil.example", host: "m.example" }))?.status,
    ).toBe(403);
    expect(
      crossSiteRejection(mk({ origin: "https://m.example.evil.com", host: "m.example" }))?.status,
    ).toBe(403);
    expect(crossSiteRejection(mk({ origin: "null", host: "m.example" }))?.status).toBe(403);
    expect(
      crossSiteRejection(mk({ host: "m.example", "sec-fetch-site": "cross-site" }))?.status,
    ).toBe(403);
  });
});
