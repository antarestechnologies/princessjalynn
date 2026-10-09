import type { NextRequest } from "next/server";
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
  return handleGate(request, {
    secret: getSessionSecret(),
    csp: cspOriginsFromEnv(),
    isDev: process.env.NODE_ENV === "development",
  });
}

export const config = {
  // Everything except Next's own static assets and image optimizer.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
