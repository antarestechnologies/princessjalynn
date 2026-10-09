import { deriveKey, hmac, safeEqual } from "@/lib/crypto";

/**
 * Vault access needs a password re-entry in the last VAULT_UNLOCK_SECONDS, on top of an admin
 * session. Cookie value: `v1.<userId>.<expiresUnix>.<hmac>`, keyed separately from sessions.
 */
export const VAULT_COOKIE = "vu";
export const VAULT_UNLOCK_SECONDS = 10 * 60;

const key = (secret: string) => deriveKey(secret, "vault-unlock-v1");

export function createVaultUnlockValue(secret: string, userId: string, now = new Date()): string {
  const exp = Math.floor(now.getTime() / 1000) + VAULT_UNLOCK_SECONDS;
  const payload = `v1.${userId}.${exp}`;
  return `${payload}.${hmac(key(secret), payload)}`;
}

export function verifyVaultUnlockValue(
  value: string | undefined,
  secret: string,
  userId: string,
  now = new Date(),
): boolean {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "v1" || parts[1] !== userId) return false;
  const exp = Number(parts[2]);
  if (!Number.isInteger(exp) || exp * 1000 <= now.getTime()) return false;
  return safeEqual(parts[3], hmac(key(secret), `${parts[0]}.${parts[1]}.${parts[2]}`));
}
