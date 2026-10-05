import { describe, expect, it } from "vitest";
import {
  createGateCookieValue,
  GATE_MAX_AGE_SECONDS,
  getSessionSecret,
  isGateExempt,
  safeNextPath,
  verifyGateCookieValue,
} from "./age-gate";

const SECRET = "test-secret-that-is-at-least-32-characters-long";

describe("age gate cookie", () => {
  it("round-trips a freshly issued cookie", () => {
    const v = createGateCookieValue(SECRET);
    expect(verifyGateCookieValue(v, SECRET)).toBe(true);
  });

  it("rejects missing, malformed, tampered and wrong-key cookies", () => {
    const v = createGateCookieValue(SECRET);
    expect(verifyGateCookieValue(undefined, SECRET)).toBe(false);
    expect(verifyGateCookieValue("", SECRET)).toBe(false);
    expect(verifyGateCookieValue("1", SECRET)).toBe(false);
    expect(verifyGateCookieValue("v1.notanumber.sig", SECRET)).toBe(false);
    expect(verifyGateCookieValue(v.slice(0, -1) + (v.endsWith("A") ? "B" : "A"), SECRET)).toBe(
      false,
    );
    expect(verifyGateCookieValue(v, SECRET + "x")).toBe(false);
    const [ver, ts, sig] = v.split(".");
    expect(verifyGateCookieValue(`${ver}.${Number(ts) + 1}.${sig}`, SECRET)).toBe(false);
    expect(verifyGateCookieValue(`v2.${ts}.${sig}`, SECRET)).toBe(false);
  });

  it("expires after the max age and rejects future-dated cookies", () => {
    const issued = new Date("2026-01-01T00:00:00Z");
    const v = createGateCookieValue(SECRET, issued);
    const justBefore = new Date(issued.getTime() + (GATE_MAX_AGE_SECONDS - 1) * 1000);
    const justAfter = new Date(issued.getTime() + (GATE_MAX_AGE_SECONDS + 1) * 1000);
    expect(verifyGateCookieValue(v, SECRET, justBefore)).toBe(true);
    expect(verifyGateCookieValue(v, SECRET, justAfter)).toBe(false);
    expect(verifyGateCookieValue(v, SECRET, new Date(issued.getTime() - 5 * 60 * 1000))).toBe(
      false,
    );
  });
});

describe("isGateExempt", () => {
  it("allows only the gate, health, robots, legal and webhook paths", () => {
    for (const p of [
      "/gate",
      "/robots.txt",
      "/favicon.ico",
      "/api/health",
      "/legal/terms",
      "/api/webhooks/ccbill",
    ]) {
      expect(isGateExempt(p), p).toBe(true);
    }
    for (const p of [
      "/",
      "/feed",
      "/gate/x",
      "/gateway",
      "/Gate",
      "/api/media/1",
      "/legal",
      "/account",
      "/api/webhooksx",
    ]) {
      expect(isGateExempt(p), p).toBe(false);
    }
  });
});

describe("safeNextPath", () => {
  it("accepts same-origin relative paths only", () => {
    expect(safeNextPath("/feed?x=1")).toBe("/feed?x=1");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("/gate")).toBe("/");
    expect(safeNextPath("/x\r\nSet-Cookie: a=b")).toBe("/");
  });
});

describe("getSessionSecret", () => {
  it("requires a real secret in production and falls back in development", () => {
    expect(() => getSessionSecret({ NODE_ENV: "production" })).toThrow(/SESSION_SECRET/);
    expect(() => getSessionSecret({ NODE_ENV: "production", SESSION_SECRET: "short" })).toThrow();
    expect(getSessionSecret({ NODE_ENV: "production", SESSION_SECRET: SECRET })).toBe(SECRET);
    expect(getSessionSecret({ NODE_ENV: "development" })).toMatch(/dev-only/);
  });
});
