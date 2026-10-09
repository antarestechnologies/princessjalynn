"use server";

import { requestMeta } from "@/auth/session";
import { botCheck } from "@/auth/bot-check";
import { submitTakedown, takedownInputSchema } from "@/compliance/takedowns";
import { getDb } from "@/db/client";
import { getEnv } from "@/env";
import { logger } from "@/lib/logger";
import { getMailer } from "@/lib/mailer";
import { consumeRateLimit, RATE_RULES } from "@/lib/rate-limit";

export interface TakedownState {
  ok?: boolean;
  reference?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Public (pre-gate) report form. Rate limited and bot-checked. Sends no email to the reporter
 * (that would make the form an open relay); admins are notified if ADMIN_NOTIFY_EMAIL is set.
 */
export async function submitTakedownAction(
  _prev: TakedownState,
  form: FormData,
): Promise<TakedownState> {
  const bot = botCheck(form);
  if (!bot.ok)
    return bot.reason === "honeypot"
      ? { ok: true, reference: "received" }
      : { error: "Please try again." };

  const parsed = takedownInputSchema.safeParse({
    reporterName: form.get("reporterName"),
    reporterEmail: form.get("reporterEmail"),
    reporterRelationship: form.get("reporterRelationship"),
    contentUrls: form.get("contentUrls") ?? "",
    description: form.get("description"),
    goodFaithAttested: form.get("goodFaithAttested") === "on",
  });
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0] ?? "form")] ??= i.message;
    return { fieldErrors: fe };
  }

  const meta = await requestMeta();
  const db = getDb();
  const rl = await consumeRateLimit(
    db,
    `takedown:ip:${meta.ipPrefix ?? "unknown"}`,
    RATE_RULES.takedownPerIp,
  );
  if (!rl.allowed) return { error: "Too many reports from your network. Please try again later." };

  try {
    const id = await submitTakedown(db, parsed.data, meta);
    const notify = getEnv().ADMIN_NOTIFY_EMAIL;
    if (notify) {
      await getMailer()
        .send({
          to: notify,
          subject: "New content report",
          text: `A new content report was submitted.\nReview it: ${getEnv().APP_URL}/admin/takedowns/${id}`,
        })
        .catch((err) => logger.error({ err }, "takedown notify failed"));
    }
    return { ok: true, reference: id.slice(0, 8) };
  } catch (err) {
    logger.error({ err }, "takedown submit failed");
    return { error: "Something went wrong. Please try again." };
  }
}
