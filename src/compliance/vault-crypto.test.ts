import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptBlob, encryptBlob, keyringFromEnv } from "./vault-crypto";

const kr = { current: "v1", keys: { v1: randomBytes(32) } };

describe("vault crypto", () => {
  it("round-trips and never contains the plaintext", () => {
    const plain = Buffer.from("Legal Name, 1995-04-12, D1234567");
    const { blob, keyVersion } = encryptBlob(kr, plain, "performer:a");
    expect(keyVersion).toBe("v1");
    expect(blob.includes(plain)).toBe(false);
    expect(decryptBlob(kr, blob, keyVersion, "performer:a").equals(plain)).toBe(true);
  });

  it("uses a fresh IV each time", () => {
    const a = encryptBlob(kr, Buffer.from("x"), "c").blob;
    const b = encryptBlob(kr, Buffer.from("x"), "c").blob;
    expect(a.equals(b)).toBe(false);
  });

  it("fails on tampering, a different row context, the wrong key or an unknown key version", () => {
    const { blob } = encryptBlob(kr, Buffer.from("secret"), "performer:a");
    const flipped = Buffer.from(blob);
    flipped[flipped.length - 1] ^= 1;
    expect(() => decryptBlob(kr, flipped, "v1", "performer:a")).toThrow();
    expect(() => decryptBlob(kr, blob, "v1", "performer:b")).toThrow();
    expect(() =>
      decryptBlob({ current: "v1", keys: { v1: randomBytes(32) } }, blob, "v1", "performer:a"),
    ).toThrow();
    expect(() => decryptBlob(kr, blob, "v9", "performer:a")).toThrow(/unavailable/);
    expect(() => decryptBlob(kr, Buffer.from([1, 2, 3]), "v1", "performer:a")).toThrow(/malformed/);
  });

  it("requires a real key in production and validates its length", () => {
    expect(() => keyringFromEnv({ NODE_ENV: "production" }, "s".repeat(40))).toThrow(/required/);
    expect(() =>
      keyringFromEnv({ VAULT_ENCRYPTION_KEY: Buffer.alloc(16).toString("base64") }, "s".repeat(40)),
    ).toThrow(/32 bytes/);
    const k = keyringFromEnv(
      { VAULT_ENCRYPTION_KEY: randomBytes(32).toString("base64"), NODE_ENV: "production" },
      "s".repeat(40),
    );
    expect(k.current).toBe("v1");
    expect(keyringFromEnv({ NODE_ENV: "development" }, "s".repeat(40)).current).toBe("dev");
  });
});
