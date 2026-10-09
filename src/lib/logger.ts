import pino, { type Logger } from "pino";

/**
 * Application logger. Every log line passes through `scrub`, which removes or masks
 * personally identifiable information before it reaches stdout (and therefore Vercel's
 * log drain). PLAN.md non-negotiable #5: ID documents and 2257 data never appear in logs.
 *
 * Rules:
 *  - Keys in SENSITIVE_KEYS are replaced with "[REDACTED]" wherever they appear, at any depth.
 *  - Keys in EMAIL_KEYS are masked to "a***@domain" so support can still correlate a user.
 *  - Keys in IP_KEYS are truncated to a /24 (IPv4) or /48 (IPv6).
 *  - Free-text string values are scanned for email addresses and card-number-like digit runs.
 */

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "password_hash",
  "newpassword",
  "currentpassword",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "sessiontoken",
  "session_token",
  "secret",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "set-cookie",
  "signature",
  "card",
  "cardnumber",
  "card_number",
  "pan",
  "cvv",
  "cvc",
  "ssn",
  "dob",
  "dateofbirth",
  "date_of_birth",
  "idnumber",
  "id_number",
  "documentnumber",
  "document_number",
  "iddocument",
  "id_document",
  "documentimage",
  "document_image",
  "selfie",
  "legalname",
  "legal_name",
  "fullname",
  "full_name",
  "address",
  "phone",
  "phonenumber",
  "phone_number",
]);

const EMAIL_KEYS = new Set(["email", "emailaddress", "email_address", "to", "from", "recipient"]);
const IP_KEYS = new Set([
  "ip",
  "ipaddress",
  "ip_address",
  "remoteaddress",
  "remote_address",
  "x-forwarded-for",
]);

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// 13–19 digits, optionally separated by spaces or dashes: anything that could be a card PAN.
const PAN_RE = /\b(?:\d[ -]?){13,19}\b/g;

export function maskEmail(value: string): string {
  const at = value.indexOf("@");
  if (at <= 0) return "[REDACTED]";
  return `${value[0]}***@${value.slice(at + 1)}`;
}

export function truncateIp(value: string): string {
  if (value.includes(":")) {
    const parts = value.split(":");
    return `${parts.slice(0, 3).join(":")}::/48`;
  }
  const parts = value.split(".");
  if (parts.length === 4) return `${parts.slice(0, 3).join(".")}.0/24`;
  return "[REDACTED]";
}

export function scrubString(value: string): string {
  return value.replace(EMAIL_RE, (m) => maskEmail(m)).replace(PAN_RE, "[REDACTED-NUMBER]");
}

const MAX_DEPTH = 8;

export function scrub(input: unknown, depth = 0): unknown {
  if (input == null) return input;
  if (typeof input === "string") return scrubString(input);
  if (typeof input !== "object") return input;
  if (depth > MAX_DEPTH) return "[TRUNCATED]";
  if (input instanceof Error) {
    return {
      type: input.name,
      message: scrubString(input.message),
      stack: input.stack ? scrubString(input.stack) : undefined,
    };
  }
  if (Array.isArray(input)) return input.map((v) => scrub(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const k = key.toLowerCase();
    if (SENSITIVE_KEYS.has(k)) {
      out[key] = "[REDACTED]";
    } else if (EMAIL_KEYS.has(k) && typeof value === "string") {
      out[key] = maskEmail(value);
    } else if (IP_KEYS.has(k) && typeof value === "string") {
      out[key] = truncateIp(value);
    } else {
      out[key] = scrub(value, depth + 1);
    }
  }
  return out;
}

export function createLogger(
  level: string = process.env.LOG_LEVEL ?? "info",
  destination?: pino.DestinationStream,
): Logger {
  const options: pino.LoggerOptions = {
    level,
    base: undefined, // no pid/hostname noise on Vercel
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
      log: (obj) => scrub(obj) as Record<string, unknown>,
    },
    hooks: {
      // Scrub the message string too, not just the bound object.
      logMethod(args, method) {
        const scrubbed = args.map((a) => (typeof a === "string" ? scrubString(a) : a));
        return method.apply(this, scrubbed as Parameters<typeof method>);
      },
    },
  };
  return destination ? pino(options, destination) : pino(options);
}

export const logger = createLogger();
