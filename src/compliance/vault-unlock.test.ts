import { describe, expect, it } from "vitest";
import {
  createVaultUnlockValue,
  VAULT_UNLOCK_SECONDS,
  verifyVaultUnlockValue,
} from "./vault-unlock";

const S = "test-secret-that-is-at-least-32-characters-long";
const U = "11111111-1111-4111-8111-111111111111";

describe("vault unlock cookie", () => {
  it("is valid for its owner until it expires", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const v = createVaultUnlockValue(S, U, now);
    expect(verifyVaultUnlockValue(v, S, U, now)).toBe(true);
    expect(
      verifyVaultUnlockValue(v, S, U, new Date(now.getTime() + (VAULT_UNLOCK_SECONDS - 1) * 1000)),
    ).toBe(true);
    expect(
      verifyVaultUnlockValue(v, S, U, new Date(now.getTime() + VAULT_UNLOCK_SECONDS * 1000)),
    ).toBe(false);
  });

  it("cannot be used by another admin, extended, or forged", () => {
    const v = createVaultUnlockValue(S, U);
    expect(verifyVaultUnlockValue(v, S, "22222222-2222-4222-8222-222222222222")).toBe(false);
    const [ver, user, exp, sig] = v.split(".");
    expect(verifyVaultUnlockValue(`${ver}.${user}.${Number(exp) + 3600}.${sig}`, S, U)).toBe(false);
    expect(verifyVaultUnlockValue(v, S + "x", U)).toBe(false);
    expect(verifyVaultUnlockValue(undefined, S, U)).toBe(false);
    expect(verifyVaultUnlockValue("v1.x.y", S, U)).toBe(false);
  });
});
