import type { MailMessage } from "@/lib/mailer";

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

/** Receipts are deliberately plain: no site name beyond "Members", no content references. */
export function receiptEmail(
  to: string,
  input: {
    kind: "subscription" | "renewal" | "ppv" | "tip";
    amountCents: number;
    currency: string;
    descriptor: string;
    periodEnd?: Date;
    appUrl: string;
  },
): MailMessage {
  const what =
    input.kind === "subscription"
      ? "Monthly membership"
      : input.kind === "renewal"
        ? "Membership renewal"
        : input.kind === "ppv"
          ? "Single item"
          : "Tip";
  const lines = [
    `Receipt`,
    ``,
    `${what}: ${money(input.amountCents, input.currency)}`,
    `This charge appears on your statement as "${input.descriptor}".`,
  ];
  if (input.periodEnd)
    lines.push(`Your membership is paid through ${input.periodEnd.toISOString().slice(0, 10)}.`);
  lines.push(``, `Manage billing or cancel any time: ${input.appUrl}/account/billing`);
  return {
    to,
    subject: `Receipt: ${money(input.amountCents, input.currency)}`,
    text: lines.join("\n"),
  };
}

export function renewalFailedEmail(
  to: string,
  input: { graceUntil: Date; appUrl: string },
): MailMessage {
  return {
    to,
    subject: "Action needed: membership payment failed",
    text: [
      `We could not renew your membership. Your access continues until ${input.graceUntil.toISOString().slice(0, 10)}.`,
      `Update your payment method before then to keep access: ${input.appUrl}/account/billing`,
    ].join("\n"),
  };
}

export function accessRevokedEmail(to: string, input: { appUrl: string }): MailMessage {
  return {
    to,
    subject: "Your membership access has been paused",
    text: [
      "A payment on your account was disputed with your bank, so access has been paused while it is reviewed.",
      `If you think this is a mistake, reply to this email. Account: ${input.appUrl}/account/billing`,
    ].join("\n"),
  };
}
