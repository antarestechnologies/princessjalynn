import { getEnv } from "@/env";
import { logger } from "./logger";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  readonly name: string;
  send(message: MailMessage): Promise<void>;
}

/**
 * Development mailer. Prints the message body (which contains the verification or reset
 * link) to the server log so the flow can be exercised without an email provider.
 * The env schema refuses it in production.
 */
export class ConsoleMailer implements Mailer {
  readonly name = "console";
  async send(message: MailMessage): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ConsoleMailer must not be used in production");
    }
    // Deliberately bypasses PII scrubbing for the body: this is a local-dev convenience and
    // the recipient is the developer's own test address.
    console.log(
      `\n[dev mail] to=${message.to}\n[dev mail] subject=${message.subject}\n${message.text}\n`,
    );
  }
}

/** SendGrid v3 Mail Send. https://docs.sendgrid.com/api-reference/mail-send/mail-send */
export class SendGridMailer implements Mailer {
  readonly name = "sendgrid";
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: MailMessage): Promise<void> {
    const from = parseAddress(this.from);
    const res = await this.fetchImpl("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: message.to }] }],
        from,
        subject: message.subject,
        content: [
          { type: "text/plain", value: message.text },
          ...(message.html ? [{ type: "text/html", value: message.html }] : []),
        ],
        // Transactional only: no open/click tracking, nothing explicit in any email.
        tracking_settings: { click_tracking: { enable: false }, open_tracking: { enable: false } },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error({ status: res.status, body: body.slice(0, 500) }, "sendgrid send failed");
      throw new Error(`SendGrid responded ${res.status}`);
    }
  }
}

export function parseAddress(value: string): { email: string; name?: string } {
  const m = value.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/);
  if (m) return { email: m[2].trim(), name: m[1]?.trim() || undefined };
  return { email: value.trim() };
}

let cached: Mailer | undefined;

export function getMailer(): Mailer {
  if (cached) return cached;
  const env = getEnv();
  cached =
    env.EMAIL_PROVIDER === "sendgrid"
      ? new SendGridMailer(env.SENDGRID_API_KEY!, env.EMAIL_FROM)
      : new ConsoleMailer();
  return cached;
}

/** Test seam. */
export function setMailerForTests(m: Mailer | undefined) {
  cached = m;
}
