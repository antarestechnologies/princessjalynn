import { z } from "zod";

const RESERVED_HANDLES = new Set([
  "admin",
  "administrator",
  "root",
  "support",
  "help",
  "owner",
  "staff",
  "moderator",
  "mod",
  "system",
  "api",
  "null",
  "undefined",
]);

export const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .email("Enter a valid email address")
  .transform((v) => v.toLowerCase());

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200, "Password is too long");

/** Shown in the watermark and to the creator. Lowercase letters, digits, underscore. */
export const handleSchema = z
  .string()
  .trim()
  .min(3, "Handle must be 3 to 20 characters")
  .max(20, "Handle must be 3 to 20 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers and underscore only")
  .refine((v) => !RESERVED_HANDLES.has(v.toLowerCase()), "That handle is reserved");

export const signUpSchema = z
  .object({ email: emailSchema, password: passwordSchema, handle: handleSchema })
  .refine((v) => v.password.toLowerCase() !== v.email.toLowerCase(), {
    path: ["password"],
    message: "Password must not be your email",
  });

export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1).max(200) });
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export type SignUpInput = z.infer<typeof signUpSchema>;
