import type { MailMessage } from "./mailer";

/**
 * Transactional email copy. Discreet by design: no site name beyond "Members", no imagery,
 * no explicit language, because the fan's inbox may be shared. SendGrid permits an adult
 * business to send non-explicit mail; keep it that way.
 */

export function verificationEmail(to: string, link: string): MailMessage {
  return {
    to,
    subject: "Confirm your email",
    text: [
      "Confirm your email address to finish creating your account:",
      "",
      link,
      "",
      "This link expires in 24 hours. If you did not create an account, ignore this message.",
    ].join("\n"),
  };
}

export function passwordResetEmail(to: string, link: string): MailMessage {
  return {
    to,
    subject: "Reset your password",
    text: [
      "Someone requested a password reset for this email address. To choose a new password:",
      "",
      link,
      "",
      "This link expires in 1 hour and can be used once. If you did not request this, you can",
      "ignore this message; your password has not changed.",
    ].join("\n"),
  };
}

export function passwordChangedEmail(to: string): MailMessage {
  return {
    to,
    subject: "Your password was changed",
    text: [
      "The password for your account was just changed and all other sessions were signed out.",
      "",
      "If this was not you, reply to this email right away.",
    ].join("\n"),
  };
}
