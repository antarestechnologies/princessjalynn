import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { deriveKey } from "@/lib/crypto";

/**
 * AES-256-GCM for the 2257 vault. Blob layout: [1 byte format=1][12 byte IV][16 byte tag][ciphertext].
 * The row's own id is bound in as additional authenticated data, so a ciphertext copied onto
 * another row (or another performer) fails to decrypt instead of silently reading as theirs.
 */
export interface VaultKeyring {
  current: string;
  keys: Record<string, Buffer>;
}

const FORMAT = 1;

export function encryptBlob(
  kr: VaultKeyring,
  plaintext: Buffer,
  context: string,
): { blob: Buffer; keyVersion: string } {
  const key = kr.keys[kr.current];
  if (!key || key.length !== 32) throw new Error("vault key unavailable");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    blob: Buffer.concat([Buffer.from([FORMAT]), iv, cipher.getAuthTag(), ct]),
    keyVersion: kr.current,
  };
}

export function decryptBlob(
  kr: VaultKeyring,
  blob: Buffer,
  keyVersion: string,
  context: string,
): Buffer {
  const key = kr.keys[keyVersion];
  if (!key) throw new Error(`vault key ${keyVersion} unavailable`);
  if (blob.length < 29 || blob[0] !== FORMAT) throw new Error("vault blob malformed");
  const iv = blob.subarray(1, 13);
  const tag = blob.subarray(13, 29);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(blob.subarray(29)), decipher.final()]);
}

export function sha256Hex(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

const DEV_WARNED = { v: false };

/**
 * Keyring from env. Production requires VAULT_ENCRYPTION_KEY (env.ts enforces it). In
 * development a key is derived from SESSION_SECRET so the flow works out of the box; records
 * made that way are throwaway.
 */
export function keyringFromEnv(
  env: { VAULT_ENCRYPTION_KEY?: string; NODE_ENV?: string },
  sessionSecret: string,
): VaultKeyring {
  if (env.VAULT_ENCRYPTION_KEY) {
    const key = Buffer.from(env.VAULT_ENCRYPTION_KEY, "base64");
    if (key.length !== 32) throw new Error("VAULT_ENCRYPTION_KEY must be 32 bytes, base64");
    return { current: "v1", keys: { v1: key } };
  }
  if (env.NODE_ENV === "production")
    throw new Error("VAULT_ENCRYPTION_KEY is required in production");
  if (!DEV_WARNED.v) {
    DEV_WARNED.v = true;
    console.warn(
      "[vault] VAULT_ENCRYPTION_KEY not set; using a development key derived from SESSION_SECRET",
    );
  }
  return { current: "dev", keys: { dev: deriveKey(sessionSecret, "vault-dev-v1") } };
}
