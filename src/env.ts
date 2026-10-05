import { z } from "zod";

/**
 * Validated environment. Import `env` instead of reading process.env directly so a
 * missing or malformed variable fails at boot with a clear message rather than deep
 * inside a request. Secrets are never logged: see logger.ts redaction.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine((v) => /^postgres(ql)?:\/\//.test(v), "DATABASE_URL must be a postgres:// URL"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type Env = z.infer<typeof schema>;

export type EnvSource = Record<string, string | undefined>;

export function parseEnv(source: EnvSource = process.env): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment:\n${issues}\nSee .env.example.`);
  }
  return result.data;
}

let cached: Env | undefined;

/** Lazily parsed so unit tests and `next build` can import modules without a full env. */
export function getEnv(): Env {
  cached ??= parseEnv();
  return cached;
}
