/**
 * Cheap bot deterrents for auth forms, used alongside rate limits:
 *  - a honeypot field ("website") that humans never see and bots fill in;
 *  - a render timestamp: submissions faster than a human could type are rejected.
 * These are deterrents, not a CAPTCHA. If abuse appears in the audit log, add a challenge
 * (e.g. Turnstile) behind this same function.
 */
export const HONEYPOT_FIELD = "website";
export const TIMESTAMP_FIELD = "_t";
const MIN_FILL_MS = 1500;
const MAX_FORM_AGE_MS = 6 * 60 * 60 * 1000;

export type BotCheck = { ok: true } | { ok: false; reason: "honeypot" | "too_fast" | "stale" };

export function botCheck(form: FormData, now = Date.now()): BotCheck {
  const honeypot = form.get(HONEYPOT_FIELD);
  if (typeof honeypot === "string" && honeypot.trim() !== "")
    return { ok: false, reason: "honeypot" };
  const ts = Number(form.get(TIMESTAMP_FIELD));
  if (!Number.isFinite(ts) || now - ts > MAX_FORM_AGE_MS) return { ok: false, reason: "stale" };
  if (now - ts < MIN_FILL_MS) return { ok: false, reason: "too_fast" };
  return { ok: true };
}
