import { NextResponse, type NextRequest } from "next/server";

/**
 * CSRF defence for cookie-authenticated route handlers that change state. Server actions
 * already get an origin check from Next; plain route handlers do not. Session cookies are
 * SameSite=Lax (and the vault cookie Strict), so this is a second layer: refuse any request
 * whose Origin (or, failing that, Sec-Fetch-Site) shows it came from another site.
 * Webhooks must NOT use this; they authenticate by signature.
 */
export function crossSiteRejection(request: NextRequest): NextResponse | null {
  const originHeader = request.headers.get("origin");
  const hostHeader = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (originHeader) {
    let originHost: string;
    try {
      originHost = new URL(originHeader).host;
    } catch {
      return NextResponse.json({ error: "bad_origin" }, { status: 403 });
    }
    if (!hostHeader || originHost !== hostHeader)
      return NextResponse.json({ error: "cross_site" }, { status: 403 });
    return null;
  }
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none")
    return NextResponse.json({ error: "cross_site" }, { status: 403 });
  return null;
}
