/**
 * Content-Security-Policy and hardening headers, applied by proxy.ts to every response.
 * Scripts need a per-request nonce (Next applies it to its own scripts automatically when the
 * CSP request header carries one). Media origins come from env so the Bunny CDN hosts are the
 * only third parties allowed to serve images, video and the player iframe.
 */
export interface CspOrigins {
  /** Bunny pull zone for images/posters, e.g. media-abc.b-cdn.net */
  cdnHost?: string;
  /** Bunny Stream pull zone, e.g. vz-abc.b-cdn.net */
  streamCdnHost?: string;
  /** Extra origin the browser may be sent to after a form post (the processor's hosted checkout). */
  checkoutOrigin?: string;
}

export function cspOriginsFromEnv(
  env: Record<string, string | undefined> = process.env,
): CspOrigins {
  return {
    cdnHost: env.BUNNY_CDN_HOST,
    streamCdnHost: env.BUNNY_STREAM_CDN_HOST,
    checkoutOrigin: env.CHECKOUT_ORIGIN,
  };
}

const host = (h?: string) => (h && /^[a-z0-9.-]+$/i.test(h) ? `https://${h}` : "");
const origin = (o?: string) => {
  try {
    return o ? new URL(o).origin : "";
  } catch {
    return "";
  }
};

export function buildCsp(nonce: string, o: CspOrigins, isDev: boolean): string {
  const media = [host(o.cdnHost), host(o.streamCdnHost)].filter(Boolean).join(" ");
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes (React style={...}, the dev overlay) need unsafe-inline for styles only.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: ${media}`.trim(),
    `media-src 'self' blob: ${media}`.trim(),
    `font-src 'self'`,
    // Bunny's player iframe; tus uploads go to video.bunnycdn.com.
    `frame-src https://iframe.mediadelivery.net`,
    `connect-src 'self' https://video.bunnycdn.com${isDev ? " ws:" : ""}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self' ${origin(o.checkoutOrigin)}`.trim(),
    `frame-ancestors 'none'`,
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}

export function newNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

/** Static headers for every response (CSP is set separately because it needs the nonce). */
export const STATIC_SECURITY_HEADERS: Record<string, string> = {
  "X-Robots-Tag": "noindex, nofollow, noarchive, noimageindex, nosnippet",
  "Referrer-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-DNS-Prefetch-Control": "off",
};
