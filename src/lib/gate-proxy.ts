import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, isGateExempt, verifyGateCookieValue } from "./age-gate";

/** Applied to every response. Nothing on this site is ever indexed, gated or not. */
export const ROBOTS_HEADER = "noindex, nofollow, noarchive, noimageindex, nosnippet";

export interface GateProxyOptions {
  secret: string;
  now?: Date;
}

/**
 * Pure request handler behind proxy.ts. Exported separately so tests can hand it crafted
 * NextRequests (bypass attempts) without booting Next.
 */
export function handleGate(request: NextRequest, opts: GateProxyOptions): NextResponse {
  const { pathname, search } = request.nextUrl;

  if (isGateExempt(pathname)) {
    return withSecurityHeaders(NextResponse.next());
  }

  const cookie = request.cookies.get(GATE_COOKIE)?.value;
  if (verifyGateCookieValue(cookie, opts.secret, opts.now)) {
    return withSecurityHeaders(NextResponse.next());
  }

  // API callers get a plain 403, never a redirect to an HTML page.
  if (pathname.startsWith("/api/")) {
    return withSecurityHeaders(NextResponse.json({ error: "age_gate_required" }, { status: 403 }));
  }

  const url = request.nextUrl.clone();
  url.pathname = "/gate";
  url.search = "";
  const next = pathname + search;
  if (next !== "/") url.searchParams.set("next", next);
  const res = NextResponse.redirect(url, 302);
  // A failed cookie (expired, forged) is cleared so the browser stops sending junk.
  if (cookie) res.cookies.delete(GATE_COOKIE);
  return withSecurityHeaders(res);
}

export function withSecurityHeaders<T extends NextResponse>(res: T): T {
  res.headers.set("X-Robots-Tag", ROBOTS_HEADER);
  res.headers.set("Referrer-Policy", "same-origin");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  return res;
}
