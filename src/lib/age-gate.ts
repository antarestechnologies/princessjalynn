import { deriveKey, hmac, safeEqual } from "./crypto";

/**
 * The 18+ attestation cookie. Value: `v1.<issuedAtSeconds>.<hmac>`. The HMAC is keyed from
 * SESSION_SECRET via HKDF so a forged or edited cookie fails verification. The cookie proves
 * only that this browser clicked "I am 18+"; it is not age verification (see age-verification/).
 */
export const GATE_COOKIE = "ag";
export const GATE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const VERSION = "v1";

/**
 * Paths reachable without the attestation cookie. Exact matches or `prefix/` matches only.
 * Everything else, including every API route not listed, is blocked. Keep this list short
 * and keep every page on it free of adult content.
 */
const EXEMPT_EXACT = new Set(["/gate", "/robots.txt", "/favicon.ico", "/api/health"]);
const EXEMPT_PREFIXES = ["/legal/", "/api/webhooks/", "/_next/"];

export function isGateExempt(pathname: string): boolean {
  if (EXEMPT_EXACT.has(pathname)) return true;
  return EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));
}

export function gateKey(secret: string): Buffer {
  return deriveKey(secret, "age-gate-v1");
}

export function createGateCookieValue(secret: string, now = new Date()): string {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const payload = `${VERSION}.${issuedAt}`;
  return `${payload}.${hmac(gateKey(secret), payload)}`;
}

export function verifyGateCookieValue(
  value: string | undefined | null,
  secret: string,
  now = new Date(),
): boolean {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== VERSION) return false;
  const issuedAt = Number(parts[1]);
  if (!Number.isInteger(issuedAt)) return false;
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (issuedAt > nowSeconds + 60) return false; // issued in the future: forged clock
  if (nowSeconds - issuedAt > GATE_MAX_AGE_SECONDS) return false;
  const expected = hmac(gateKey(secret), `${parts[0]}.${parts[1]}`);
  return safeEqual(parts[2], expected);
}

/**
 * Only same-origin relative paths are allowed as a post-gate destination, so the gate can
 * never be used as an open redirect.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (next.includes("\n") || next.includes("\r")) return "/";
  if (next === "/gate" || next.startsWith("/gate?")) return "/";
  return next;
}

const DEV_FALLBACK_SECRET = "dev-only-insecure-secret-do-not-use-in-production-0123456789";
let warned = false;

/** Reads the secret without pulling in the full env schema (the proxy must stay light). */
export function getSessionSecret(env: Record<string, string | undefined> = process.env): string {
  const s = env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET (32+ chars) is required in production");
  }
  if (!warned) {
    warned = true;
    console.warn("[auth] SESSION_SECRET not set; using an insecure development fallback");
  }
  return DEV_FALLBACK_SECRET;
}
