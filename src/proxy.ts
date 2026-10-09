import { NextResponse, type NextRequest } from "next/server";
import { getSessionSecret } from "@/lib/age-gate";
import { handleGate } from "@/lib/gate-proxy";
import { cspOriginsFromEnv } from "@/lib/security-headers";

/**
 * Runs before every route (see matcher). Enforces the 18+ attestation cookie, sets a
 * per-request CSP nonce and stamps security/noindex headers on every response.
 * Authentication is NOT done here; pages, server actions and route handlers check it
 * themselves (proxy is an optimistic layer, per the Next docs).
 */
export function proxy(request: NextRequest) {
  let secret: string;
  try {
    secret = getSessionSecret();
  } catch {
    // A missing/short SESSION_SECRET would otherwise surface as a bare "Internal Server Error"
    // on every page. Say what is wrong (variable name only, never a value) and keep /api/health
    // reachable so the full list of problems can be read there.
    console.error(
      "[config] SESSION_SECRET is missing or shorter than 32 characters in this deployment's environment",
    );
    if (request.nextUrl.pathname === "/api/health") return NextResponse.next();
    return new NextResponse(
      "Service unavailable: this deployment is missing configuration (SESSION_SECRET). See /api/health and the deployment's function logs.",
      {
        status: 503,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
          "x-robots-tag": "noindex",
        },
      },
    );
  }
  return handleGate(request, {
    secret,
    csp: cspOriginsFromEnv(),
    isDev: process.env.NODE_ENV === "development",
  });
}

export const config = {
  // Everything except Next's own static assets and image optimizer.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
