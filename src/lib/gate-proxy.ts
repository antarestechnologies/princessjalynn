import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, isGateExempt, verifyGateCookieValue } from "./age-gate";
import { buildCsp, type CspOrigins, newNonce, STATIC_SECURITY_HEADERS } from "./security-headers";

/** Applied to every response. Nothing on this site is ever indexed, gated or not. */
export const ROBOTS_HEADER = STATIC_SECURITY_HEADERS["X-Robots-Tag"];

export interface GateProxyOptions {
  secret: string;
  now?: Date;
  csp?: CspOrigins;
  isDev?: boolean;
  /** Test seam for a deterministic nonce. */
  nonce?: string;
}

/**
 * Pure request handler behind proxy.ts. Exported separately so tests can hand it crafted
 * NextRequests (bypass attempts) without booting Next.
 */
export function handleGate(request: NextRequest, opts: GateProxyOptions): NextResponse {
  const { pathname, search } = request.nextUrl;
  const nonce = opts.nonce ?? newNonce();
  const csp = buildCsp(nonce, opts.csp ?? {}, opts.isDev ?? false);

  const pass = () => {
    // Next reads the nonce from the request's CSP header and stamps it on its own scripts.
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    return withSecurityHeaders(NextResponse.next({ request: { headers } }), csp);
  };

  if (isGateExempt(pathname)) return pass();

  const cookie = request.cookies.get(GATE_COOKIE)?.value;
  if (verifyGateCookieValue(cookie, opts.secret, opts.now)) return pass();

  // API callers get a plain 403, never a redirect to an HTML page.
  if (pathname.startsWith("/api/")) {
    return withSecurityHeaders(
      NextResponse.json({ error: "age_gate_required" }, { status: 403 }),
      csp,
    );
  }

  const url = request.nextUrl.clone();
  url.pathname = "/gate";
  url.search = "";
  const next = pathname + search;
  if (next !== "/") url.searchParams.set("next", next);
  const res = NextResponse.redirect(url, 302);
  // A failed cookie (expired, forged) is cleared so the browser stops sending junk.
  if (cookie) res.cookies.delete(GATE_COOKIE);
  return withSecurityHeaders(res, csp);
}

export function withSecurityHeaders<T extends NextResponse>(res: T, csp?: string): T {
  for (const [k, v] of Object.entries(STATIC_SECURITY_HEADERS)) res.headers.set(k, v);
  if (csp) res.headers.set("Content-Security-Policy", csp);
  return res;
}
