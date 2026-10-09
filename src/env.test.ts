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
    expect(problems).toContain("APP_URL");
    expect(JSON.stringify(problems)).not.toContain("short-secret-value");
  });

  it("is empty for a complete development environment", () => {
    expect(envProblems({ DATABASE_URL: "postgres://u:p@localhost:5432/db" })).toEqual([]);
  });
});

describe("APP_URL in production", () => {
  it("is accepted when public and rejected when left on localhost", () => {
    const base = { NODE_ENV: "production", DATABASE_URL: "postgres://u:p@h:5432/d" };
    expect(envProblems({ ...base, APP_URL: "https://members.example" })).not.toContain("APP_URL");
    expect(envProblems({ ...base, APP_URL: "http://localhost:3000" })).toContain("APP_URL");
    expect(envProblems({ ...base })).toContain("APP_URL");
  });
});
