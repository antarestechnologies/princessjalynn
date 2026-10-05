import { z } from "zod";

/**
 * Validated environment. Import `env` instead of reading process.env directly so a
 * missing or malformed variable fails at boot with a clear message rather than deep
 * inside a request. Secrets are never logged: see logger.ts redaction.
 */
const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.url().default("http://localhost:3000"),
    DATABASE_URL: z
      .string()
      .min(1, "DATABASE_URL is required")
      .refine((v) => /^postgres(ql)?:\/\//.test(v), "DATABASE_URL must be a postgres:// URL"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    /** Keys sessions, the age-gate cookie and signed links. 32+ chars. Required in production. */
    SESSION_SECRET: z.string().min(32).optional(),
    EMAIL_PROVIDER: z.enum(["console", "sendgrid"]).default("console"),
    SENDGRID_API_KEY: z.string().min(1).optional(),
    /** e.g. "Members <no-reply@example.com>". Must be a sender verified at SendGrid. */
    EMAIL_FROM: z.string().min(3).default("Members <no-reply@localhost>"),
    AGE_VERIFIER: z.enum(["stub"]).default("stub"),
    /** fake = files on local disk served through our signed route (dev only). bunny = Bunny Stream + Storage. */
    MEDIA_PROVIDER: z.enum(["fake", "bunny"]).default("fake"),
    MEDIA_LOCAL_DIR: z.string().default(".data/media"),
    BUNNY_STREAM_LIBRARY_ID: z.string().min(1).optional(),
    BUNNY_STREAM_API_KEY: z.string().min(1).optional(),
    /** Pull-zone hostname for the Stream library, e.g. vz-abc123.b-cdn.net */
    BUNNY_STREAM_CDN_HOST: z.string().min(1).optional(),
    /** "Embed view token authentication key" from the library's security settings. */
    BUNNY_STREAM_TOKEN_KEY: z.string().min(1).optional(),
    BUNNY_STORAGE_ZONE: z.string().min(1).optional(),
    BUNNY_STORAGE_PASSWORD: z.string().min(1).optional(),
    /** storage.bunnycdn.com or a regional host like ny.storage.bunnycdn.com */
    BUNNY_STORAGE_HOST: z.string().default("storage.bunnycdn.com"),
    /** Pull-zone hostname in front of the storage zone, e.g. media-abc.b-cdn.net */
    BUNNY_CDN_HOST: z.string().min(1).optional(),
    /** "Token authentication key" from the pull zone's security settings. */
    BUNNY_CDN_TOKEN_KEY: z.string().min(1).optional(),
    /** The stub verifier passes anyone who clicks. It is refused in production unless this is set. */
    ALLOW_STUB_AGE_VERIFIER: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV === "production") {
      if (!v.SESSION_SECRET) {
        ctx.addIssue({
          code: "custom",
          path: ["SESSION_SECRET"],
          message: "required in production",
        });
      }
      if (v.EMAIL_PROVIDER === "console") {
        ctx.addIssue({
          code: "custom",
          path: ["EMAIL_PROVIDER"],
          message:
            "console mailer only prints links to the log; set EMAIL_PROVIDER=sendgrid in production",
        });
      }
    }
    if (v.NODE_ENV === "production" && v.MEDIA_PROVIDER === "fake") {
      ctx.addIssue({
        code: "custom",
        path: ["MEDIA_PROVIDER"],
        message: "fake media provider is dev-only",
      });
    }
    if (v.MEDIA_PROVIDER === "bunny") {
      for (const k of [
        "BUNNY_STREAM_LIBRARY_ID",
        "BUNNY_STREAM_API_KEY",
        "BUNNY_STREAM_CDN_HOST",
        "BUNNY_STREAM_TOKEN_KEY",
        "BUNNY_STORAGE_ZONE",
        "BUNNY_STORAGE_PASSWORD",
        "BUNNY_CDN_HOST",
        "BUNNY_CDN_TOKEN_KEY",
      ] as const) {
        if (!v[k])
          ctx.addIssue({
            code: "custom",
            path: [k],
            message: "required when MEDIA_PROVIDER=bunny",
          });
      }
    }
    if (v.EMAIL_PROVIDER === "sendgrid" && !v.SENDGRID_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["SENDGRID_API_KEY"],
        message: "required when EMAIL_PROVIDER=sendgrid",
      });
    }
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
