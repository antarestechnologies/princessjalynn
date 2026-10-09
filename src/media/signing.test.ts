import { describe, expect, it } from "vitest";
import { signLocalPath, verifyLocalPath } from "./signing";

const S = "test-secret-that-is-at-least-32-characters-long";

describe("local media signing", () => {
  it("verifies a fresh token and rejects it once expired", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const { token, expires } = signLocalPath(
      "images/a/original.jpg",
      new Date(now.getTime() + 60_000),
      S,
    );
    expect(verifyLocalPath("images/a/original.jpg", expires, token, S, now)).toBe("ok");
    expect(
      verifyLocalPath("images/a/original.jpg", expires, token, S, new Date(now.getTime() + 61_000)),
    ).toBe("expired");
  });

  it("rejects a token reused for another path, a tampered expiry, or a different key", () => {
    const now = new Date();
    const { token, expires } = signLocalPath(
      "images/a/original.jpg",
      new Date(now.getTime() + 60_000),
      S,
    );
    expect(verifyLocalPath("images/b/original.jpg", expires, token, S, now)).toBe("invalid");
    expect(verifyLocalPath("images/a/original.jpg", expires + 100000, token, S, now)).toBe(
      "invalid",
    );
    expect(verifyLocalPath("images/a/original.jpg", expires, token, S + "x", now)).toBe("invalid");
    expect(verifyLocalPath("images/a/original.jpg", "soon", token, S, now)).toBe("invalid");
    expect(verifyLocalPath("images/a/original.jpg", expires, undefined, S, now)).toBe("invalid");
  });
});
