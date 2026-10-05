import { describe, expect, it } from "vitest";
import {
  deriveKey,
  hashPassword,
  hmac,
  randomToken,
  safeEqual,
  sha256,
  verifyPassword,
} from "./crypto";

describe("crypto", () => {
  it("hashes and verifies passwords, rejecting wrong ones", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("scrypt$32768$8$1$")).toBe(true);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("correct horse batterx", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("produces a different hash for the same password (random salt)", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("rejects malformed stored hashes without throwing", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$whatever")).toBe(false);
    expect(await verifyPassword("x", "scrypt$abc$8$1$salt$hash")).toBe(false);
  });

  it("random tokens are long and unique; sha256 is stable", () => {
    const a = randomToken();
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(a).not.toBe(randomToken());
    expect(sha256("a")).toBe(sha256("a"));
    expect(sha256("a")).not.toBe(sha256("b"));
  });

  it("derives distinct keys per purpose and compares safely", () => {
    const k1 = deriveKey("s".repeat(32), "a");
    const k2 = deriveKey("s".repeat(32), "b");
    expect(k1.equals(k2)).toBe(false);
    expect(safeEqual(hmac(k1, "x"), hmac(k1, "x"))).toBe(true);
    expect(safeEqual(hmac(k1, "x"), hmac(k2, "x"))).toBe(false);
    expect(safeEqual("a", "ab")).toBe(false);
  });
});
