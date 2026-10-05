"use server";

import { redirect } from "next/navigation";
import { getAgeVerifier } from "@/age-verification";
import { beginAgeVerification } from "@/age-verification/service";
import { getDb } from "@/db/client";
import { getEnv } from "@/env";
import { safeNextPath } from "@/lib/age-gate";
import { passwordChangedEmail, passwordResetEmail, verificationEmail } from "@/lib/emails";
import { logger } from "@/lib/logger";
import { getMailer } from "@/lib/mailer";
import { consumeRateLimit, RATE_RULES, type RateLimitRule } from "@/lib/rate-limit";
import { recordAudit } from "./audit";
import { botCheck } from "./bot-check";
import { forgotPasswordSchema, resetPasswordSchema, signInSchema, signUpSchema } from "./schemas";
import {
  createEmailVerificationToken,
  requestPasswordReset,
  resetPassword,
  signIn,
  signOut,
  signUp,
} from "./service";
import {
  clearSessionCookie,
  getCurrentUser,
  readSessionToken,
  requestMeta,
  setSessionCookie,
} from "./session";

export interface ActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
}

const GENERIC_ERROR = "Something went wrong. Please try again.";
const RATE_ERROR = "Too many attempts. Please wait a few minutes and try again.";

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = String(i.path[0] ?? "form");
    out[key] ??= i.message;
  }
  return out;
}

async function limited(key: string, rule: RateLimitRule): Promise<boolean> {
  const r = await consumeRateLimit(getDb(), key, rule);
  return !r.allowed;
}

function absoluteUrl(path: string): string {
  return new URL(path, getEnv().APP_URL).toString();
}

// ---------- sign up ----------
export async function signUpAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const bot = botCheck(form);
  if (!bot.ok) {
    // Bots get a convincing success; humans who were just quick get a retry prompt.
    return bot.reason === "honeypot" ? { ok: true } : { error: "Please try again." };
  }
  const parsed = signUpSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
    handle: form.get("handle"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };

  const meta = await requestMeta();
  if (await limited(`signup:ip:${meta.ipPrefix ?? "unknown"}`, RATE_RULES.signupPerIp)) {
    return { error: RATE_ERROR };
  }

  try {
    const result = await signUp(getDb(), parsed.data, meta);
    if (!result.ok) return { fieldErrors: { handle: "That handle is taken" } };
    const mailer = getMailer();
    if (result.existing) {
      // Same outward behaviour as a fresh signup, so the response does not reveal accounts.
      await mailer.send({
        to: parsed.data.email,
        subject: "You already have an account",
        text: [
          "Someone tried to sign up with this email address, but an account already exists.",
          "If that was you, sign in instead. If you forgot your password, use the reset link",
          `on the sign-in page: ${absoluteUrl("/login")}`,
        ].join("\n"),
      });
    } else {
      await mailer.send(
        verificationEmail(
          parsed.data.email,
          absoluteUrl(`/verify-email?token=${result.verifyToken}`),
        ),
      );
    }
  } catch (err) {
    logger.error({ err }, "signup failed");
    return { error: GENERIC_ERROR };
  }
  redirect("/verify-email/sent");
}

// ---------- sign in / out ----------
export async function signInAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const bot = botCheck(form);
  if (!bot.ok)
    return {
      error: bot.reason === "honeypot" ? "Invalid email or password." : "Please try again.",
    };
  const parsed = signInSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: "Invalid email or password." };
  const next = safeNextPath(String(form.get("next") ?? ""));

  const meta = await requestMeta();
  const db = getDb();
  if (
    (await limited(`login:ip:${meta.ipPrefix ?? "unknown"}`, RATE_RULES.loginPerIp)) ||
    (await limited(`login:email:${parsed.data.email}`, RATE_RULES.loginPerEmail))
  ) {
    return { error: RATE_ERROR };
  }

  let result: Awaited<ReturnType<typeof signIn>>;
  try {
    result = await signIn(db, parsed.data, meta);
  } catch (err) {
    logger.error({ err }, "login failed");
    return { error: GENERIC_ERROR };
  }
  if (!result.ok) {
    return {
      error:
        result.error === "suspended"
          ? "This account is suspended. Contact support."
          : "Invalid email or password.",
    };
  }
  await setSessionCookie(result.sessionToken, result.expiresAt);
  redirect(next);
}

export async function signOutAction(): Promise<void> {
  const token = await readSessionToken();
  const user = await getCurrentUser();
  await signOut(getDb(), token);
  await clearSessionCookie();
  if (user) {
    await recordAudit(getDb(), {
      actorUserId: user.id,
      action: "auth.logout",
      targetType: "user",
      targetId: user.id,
    });
  }
  redirect("/");
}

// ---------- email verification ----------
export async function resendVerificationAction(): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.emailVerifiedAt) redirect("/account");
  if (await limited(`resend:user:${user.id}`, RATE_RULES.resendVerifyPerUser))
    return { error: RATE_ERROR };
  try {
    const token = await createEmailVerificationToken(getDb(), user.id);
    await getMailer().send(
      verificationEmail(user.email, absoluteUrl(`/verify-email?token=${token}`)),
    );
  } catch (err) {
    logger.error({ err }, "resend verification failed");
    return { error: GENERIC_ERROR };
  }
  return { ok: true };
}

// ---------- password reset ----------
export async function forgotPasswordAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const bot = botCheck(form);
  if (!bot.ok) return bot.reason === "honeypot" ? { ok: true } : { error: "Please try again." };
  const parsed = forgotPasswordSchema.safeParse({ email: form.get("email") });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };

  const meta = await requestMeta();
  if (
    (await limited(`forgot:ip:${meta.ipPrefix ?? "unknown"}`, RATE_RULES.forgotPerIp)) ||
    (await limited(`forgot:email:${parsed.data.email}`, RATE_RULES.forgotPerEmail))
  ) {
    // Still "ok": the response must not vary by account existence or by limiter state.
    return { ok: true };
  }
  try {
    const result = await requestPasswordReset(getDb(), parsed.data.email, meta);
    if (result) {
      await getMailer().send(
        passwordResetEmail(result.email, absoluteUrl(`/reset-password?token=${result.token}`)),
      );
    }
  } catch (err) {
    logger.error({ err }, "forgot password failed");
    return { error: GENERIC_ERROR };
  }
  return { ok: true };
}

export async function resetPasswordAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const bot = botCheck(form);
  if (!bot.ok) return { error: "Please try again." };
  const parsed = resetPasswordSchema.safeParse({
    token: form.get("token"),
    password: form.get("password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };

  const meta = await requestMeta();
  if (await limited(`reset:ip:${meta.ipPrefix ?? "unknown"}`, RATE_RULES.resetPerIp))
    return { error: RATE_ERROR };

  let userEmail: string | undefined;
  try {
    const db = getDb();
    const result = await resetPassword(db, parsed.data.token, parsed.data.password, meta);
    if (!result.ok) {
      return {
        error:
          result.error === "expired"
            ? "This reset link has expired. Request a new one."
            : "This reset link is not valid. Request a new one.",
      };
    }
    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, result.userId),
      columns: { email: true },
    });
    userEmail = user?.email;
    if (userEmail) await getMailer().send(passwordChangedEmail(userEmail));
  } catch (err) {
    logger.error({ err }, "reset password failed");
    return { error: GENERIC_ERROR };
  }
  await clearSessionCookie();
  redirect("/login?reset=1");
}

// ---------- age verification ----------
export async function beginAgeVerificationAction(): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fverify-age");
  if (!user.emailVerifiedAt) redirect("/verify-email/sent");
  if (user.ageVerifiedAt) redirect("/account");
  if (await limited(`agev:user:${user.id}`, RATE_RULES.ageVerifyPerUser))
    return { error: RATE_ERROR };

  const meta = await requestMeta();
  let result: Awaited<ReturnType<typeof beginAgeVerification>>;
  try {
    result = await beginAgeVerification(
      getDb(),
      getAgeVerifier(),
      user.id,
      absoluteUrl("/verify-age/callback"),
      meta,
    );
  } catch (err) {
    logger.error({ err }, "begin age verification failed");
    return { error: GENERIC_ERROR };
  }
  if (!result.ok) {
    if (result.error === "already_verified") redirect("/account");
    return { error: "Age verification is temporarily unavailable. Please try again later." };
  }
  redirect(result.redirectUrl);
}
