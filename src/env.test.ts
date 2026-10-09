import { describe, expect, it } from "vitest";
import { envProblems, parseEnv } from "./env";

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

describe("envProblems", () => {
  it("lists only variable names, never values", () => {
    const problems = envProblems({ NODE_ENV: "production", SESSION_SECRET: "short-secret-value" });
    expect(problems).toContain("SESSION_SECRET");
    expect(problems).toContain("DATABASE_URL");
    expect(problems).toContain("VAULT_ENCRYPTION_KEY");
    expect(JSON.stringify(problems)).not.toContain("short-secret-value");
  });

  it("is empty for a complete development environment", () => {
    expect(envProblems({ DATABASE_URL: "postgres://u:p@localhost:5432/db" })).toEqual([]);
  });
});
