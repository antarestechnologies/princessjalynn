import type { NextRequest } from "next/server";
import { getSessionSecret } from "@/lib/age-gate";
import { handleGate } from "@/lib/gate-proxy";

/**
 * Runs before every route (see matcher). Enforces the 18+ attestation cookie and stamps
 * noindex headers on every response. Authentication is NOT done here; pages and server
 * actions call requireUser() themselves (proxy is an optimistic layer, per Next docs).
 */
export function proxy(request: NextRequest) {
  return handleGate(request, { secret: getSessionSecret() });
}

export const config = {
  // Everything except Next's own static assets and image optimizer.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
