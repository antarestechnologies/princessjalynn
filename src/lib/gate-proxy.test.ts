import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { createGateCookieValue, GATE_COOKIE } from "./age-gate";
import { handleGate, ROBOTS_HEADER } from "./gate-proxy";

const SECRET = "test-secret-that-is-at-least-32-characters-long";
const ORIGIN = "https://members.example";

function req(path: string, cookie?: string, headers: Record<string, string> = {}) {
  const r = new NextRequest(new URL(path, ORIGIN), { headers });
  if (cookie !== undefined) r.cookies.set(GATE_COOKIE, cookie);
  return r;
}

function redirectTarget(res: Response) {
  return res.headers.get("location");
}

describe("gate proxy: bypass attempts", () => {
  it("redirects a visitor without the cookie to the gate, preserving the destination", () => {
    const res = handleGate(req("/feed?tab=new"), { secret: SECRET });
    expect(res.status).toBe(302);
    expect(redirectTarget(res)).toBe(`${ORIGIN}/gate?next=${encodeURIComponent("/feed?tab=new")}`);
  });

  it("does not add a next param for the home page", () => {
    const res = handleGate(req("/"), { secret: SECRET });
    expect(redirectTarget(res)).toBe(`${ORIGIN}/gate`);
  });

  it("rejects forged, truncated and foreign-key cookies and clears them", () => {
    const good = createGateCookieValue(SECRET);
    for (const bad of [
      "1",
      "true",
      "v1.0.x",
      good.slice(0, -2),
      createGateCookieValue("another-secret-of-sufficient-length-1234"),
    ]) {
      const res = handleGate(req("/feed", bad), { secret: SECRET });
      expect(res.status, bad).toBe(302);
      expect(res.headers.get("set-cookie") ?? "", bad).toMatch(/ag=;|ag=; /);
    }
  });

  it("rejects an expired cookie", () => {
    const old = createGateCookieValue(SECRET, new Date(Date.now() - 31 * 24 * 3600 * 1000));
    expect(handleGate(req("/feed", old), { secret: SECRET }).status).toBe(302);
  });

  it("lets a valid cookie through", () => {
    const res = handleGate(req("/feed", createGateCookieValue(SECRET)), { secret: SECRET });
    expect(res.status).toBe(200);
    expect(redirectTarget(res)).toBeNull();
  });

  it("ignores query-string and header tricks", () => {
    expect(handleGate(req("/feed?ag=1&age=18&adult=true"), { secret: SECRET }).status).toBe(302);
    expect(
      handleGate(req("/feed", undefined, { cookie: "ag=1; sid=abc" }), { secret: SECRET }).status,
    ).toBe(302);
    expect(
      handleGate(req("/feed", undefined, { "x-age-verified": "1" }), { secret: SECRET }).status,
    ).toBe(302);
  });

  it("normalizes path traversal so /gate/../feed is treated as /feed", () => {
    const res = handleGate(req("/gate/../feed"), { secret: SECRET });
    expect(res.status).toBe(302);
    expect(redirectTarget(res)).toContain("next=%2Ffeed");
  });

  it("treats look-alike paths as gated", () => {
    for (const p of ["/Gate", "/gate/", "/gate/anything", "/gateway", "/GATE", "/legal"]) {
      expect(handleGate(req(p), { secret: SECRET }).status, p).toBe(302);
    }
    for (const p of ["/api/healthz", "/api/webhooks", "/api/Health"]) {
      expect(handleGate(req(p), { secret: SECRET }).status, p).toBe(403);
    }
  });

  it("returns 403 JSON for gated API routes instead of redirecting", async () => {
    const res = handleGate(req("/api/media/abc/token"), { secret: SECRET });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "age_gate_required" });
  });

  it("lets exempt paths through without a cookie", () => {
    for (const p of [
      "/gate",
      "/gate?next=%2Ffeed",
      "/robots.txt",
      "/api/health",
      "/legal/terms",
      "/api/webhooks/ccbill",
    ]) {
      expect(handleGate(req(p), { secret: SECRET }).status, p).toBe(200);
    }
  });

  it("stamps noindex and hardening headers on every response", () => {
    for (const r of [
      req("/gate"),
      req("/feed"),
      req("/feed", createGateCookieValue(SECRET)),
      req("/api/media/x"),
    ]) {
      const res = handleGate(r, { secret: SECRET });
      expect(res.headers.get("x-robots-tag")).toBe(ROBOTS_HEADER);
      expect(res.headers.get("x-frame-options")).toBe("DENY");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    }
  });
});
