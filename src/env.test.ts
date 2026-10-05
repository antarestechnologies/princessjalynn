import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const base = { DATABASE_URL: "postgres://u:p@localhost:5432/db" };

describe("parseEnv", () => {
  it("applies defaults", () => {
    const env = parseEnv(base);
    expect(env.NODE_ENV).toBe("development");
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.APP_URL).toBe("http://localhost:3000");
  });

  it("rejects a missing DATABASE_URL with a readable message", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it("rejects a non-postgres DATABASE_URL", () => {
    expect(() => parseEnv({ DATABASE_URL: "mysql://x" })).toThrow(/postgres:\/\//);
  });

  it("rejects an unknown LOG_LEVEL", () => {
    expect(() => parseEnv({ ...base, LOG_LEVEL: "loud" })).toThrow(/LOG_LEVEL/);
  });
});
