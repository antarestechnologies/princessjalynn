import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger, maskEmail, scrub, scrubString, truncateIp } from "./logger";

describe("scrub", () => {
  it("redacts sensitive keys at any depth, case-insensitively", () => {
    const out = scrub({
      user: { Password: "hunter2", profile: { ssn: "123-45-6789", nested: { API_KEY: "k" } } },
      authorization: "Bearer abc",
    }) as Record<string, Record<string, unknown>>;
    expect(out.user.Password).toBe("[REDACTED]");
    expect((out.user.profile as Record<string, unknown>).ssn).toBe("[REDACTED]");
    expect(JSON.stringify(out)).not.toContain("hunter2");
    expect(JSON.stringify(out)).not.toContain("Bearer abc");
  });

  it("masks email fields but keeps the domain", () => {
    expect(maskEmail("carson@example.com")).toBe("c***@example.com");
    const out = scrub({ email: "fan@example.com" }) as Record<string, unknown>;
    expect(out.email).toBe("f***@example.com");
  });

  it("truncates IP addresses", () => {
    expect(truncateIp("203.0.113.42")).toBe("203.0.113.0/24");
    expect(truncateIp("2001:db8:85a3::8a2e:370:7334")).toBe("2001:db8:85a3::/48");
  });

  it("finds emails and card-like numbers inside free text", () => {
    const s = scrubString("user fan@example.com paid with 4242 4242 4242 4242 today");
    expect(s).not.toContain("fan@example.com");
    expect(s).toContain("f***@example.com");
    expect(s).not.toContain("4242 4242");
    expect(s).toContain("[REDACTED-NUMBER]");
  });

  it("leaves ordinary ids and short numbers alone", () => {
    expect(scrubString("order 12345 for post 9f1c")).toBe("order 12345 for post 9f1c");
  });

  it("handles arrays and Error objects", () => {
    const err = new Error("login failed for fan@example.com");
    const out = scrub({ items: [{ token: "t" }], err }) as {
      items: unknown[];
      err: { message: string };
    };
    expect((out.items[0] as Record<string, unknown>).token).toBe("[REDACTED]");
    expect(out.err.message).toBe("login failed for f***@example.com");
  });

  it("stops at a depth limit instead of recursing forever", () => {
    const deep: Record<string, unknown> = {};
    let cur = deep;
    for (let i = 0; i < 20; i++) {
      cur.next = {};
      cur = cur.next as Record<string, unknown>;
    }
    expect(() => scrub(deep)).not.toThrow();
    expect(JSON.stringify(scrub(deep))).toContain("[TRUNCATED]");
  });
});

describe("createLogger", () => {
  it("never writes PII to the destination", () => {
    const lines: string[] = [];
    const dest = new Writable({
      write(chunk, _enc, cb) {
        lines.push(chunk.toString());
        cb();
      },
    });
    const log = createLogger("info", dest);
    log.info(
      { email: "fan@example.com", password: "pw", ip: "203.0.113.42", card: "4242424242424242" },
      "signup for fan@example.com from 4242 4242 4242 4242",
    );
    log.error({ err: new Error("boom for fan@example.com") }, "failed");
    log.flush();
    const out = lines.join("\n");
    expect(out).not.toContain("fan@example.com");
    expect(out).not.toContain('"pw"');
    expect(out).not.toContain("203.0.113.42");
    expect(out).not.toContain("4242");
    expect(out).toContain("f***@example.com");
    expect(out).toContain("203.0.113.0/24");
    expect(out).toContain('"level":"info"');
  });
});
