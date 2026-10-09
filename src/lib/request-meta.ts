import { truncateIp } from "./logger";

/**
 * Client metadata safe to store: an IP prefix (never the full address) and a short UA.
 * On Vercel the real client IP is in x-forwarded-for (first hop) / x-real-ip.
 */
export function clientIpPrefix(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  const raw = (xff ? xff.split(",")[0] : headers.get("x-real-ip"))?.trim();
  if (!raw) return null;
  const prefix = truncateIp(raw);
  return prefix === "[REDACTED]" ? null : prefix;
}

export function shortUserAgent(headers: Headers): string | null {
  const ua = headers.get("user-agent");
  return ua ? ua.slice(0, 200) : null;
}
