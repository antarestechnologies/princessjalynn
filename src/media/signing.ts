import { deriveKey, hmac, safeEqual } from "@/lib/crypto";

/**
 * Signing for the fake provider's local delivery route. Token = HMAC(key, `${path}.${expires}`),
 * keyed from SESSION_SECRET via HKDF so it shares no key with sessions or the age gate.
 */
export function localMediaKey(secret: string): Buffer {
  return deriveKey(secret, "media-local-v1");
}

export function signLocalPath(
  path: string,
  expiresAt: Date,
  secret: string,
): { token: string; expires: number } {
  const expires = Math.floor(expiresAt.getTime() / 1000);
  return { token: hmac(localMediaKey(secret), `${path}.${expires}`), expires };
}

export function verifyLocalPath(
  path: string,
  expires: string | number | null | undefined,
  token: string | null | undefined,
  secret: string,
  now = new Date(),
): "ok" | "expired" | "invalid" {
  if (!token || expires == null) return "invalid";
  const exp = Number(expires);
  if (!Number.isInteger(exp)) return "invalid";
  const expected = hmac(localMediaKey(secret), `${path}.${exp}`);
  if (!safeEqual(token, expected)) return "invalid";
  if (exp * 1000 <= now.getTime()) return "expired";
  return "ok";
}
