import {
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/** 256 bits of randomness, base64url. Used for session and one-time tokens. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("base64url");
}

/** Derive a purpose-specific key from the single SESSION_SECRET so cookies never share keys. */
export function deriveKey(secret: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "", purpose, 32));
}

export function hmac(key: Buffer, data: string): string {
  return createHmac("sha256", key).update(data).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// ---------- passwords ----------
// scrypt from node:crypto: no native dependency, works on Vercel. N=2^15 is ~50-80ms on a
// serverless CPU, in line with OWASP's scrypt guidance (N=2^15, r=8, p=1 or stronger).
const SCRYPT = { N: 1 << 15, r: 8, p: 1, keylen: 32 } as const;
const SCRYPT_MAXMEM = 128 * SCRYPT.N * SCRYPT.r * 2;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: SCRYPT_MAXMEM,
  });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4], "base64url");
  const expected = Buffer.from(parts[5], "base64url");
  if (
    !Number.isInteger(N) ||
    !Number.isInteger(r) ||
    !Number.isInteger(p) ||
    expected.length === 0
  ) {
    return false;
  }
  const actual = await scrypt(password.normalize("NFKC"), salt, expected.length, {
    N,
    r,
    p,
    maxmem: 128 * N * r * 2,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * A hash to compare against when the user does not exist, so a login attempt for an unknown
 * email takes as long as one for a known email. Computed once per process.
 */
let dummyHashPromise: Promise<string> | undefined;
export function dummyPasswordHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(randomToken());
  return dummyHashPromise;
}
