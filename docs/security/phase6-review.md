# Phase 6 security review

Date: 2026-10-09 · Scope: everything on branch `claude/new-session-cab4mx` through Phase 6.

## Summary

No high-risk issue is open in the code. The review added CSP with per-request nonces and
other hardening headers, cross-site request checks on cookie-authenticated route handlers,
a per-user rate limit on playback, and a test that fails the build if any server action or
route handler lacks an authorization check. Launch is still blocked on items outside the
code: real payment and age-verification adapters, attorney copy, and vendor confirmations
(see `docs/launch/launch-checklist.md`).

## Dependency audit

- **Production dependencies:** `npm audit --omit=dev` reports **0 vulnerabilities**. CI now
  runs this check with `--audit-level=high` on every push.
- **Dev tooling:** Vitest moved from 3 to 5, which removed the critical `tinypool` advisory.
  Remaining advisories sit in `eslint-config-next` (`braces` via `fast-glob`, used only to
  match this repo's own lint globs) and `drizzle-kit` (an old `esbuild` whose dev-server CORS
  issue does not apply because drizzle-kit never serves HTTP here). Neither ships to Vercel or
  handles untrusted input. Re-check when those packages release fixes.

## Headers

Set by `src/proxy.ts` on every response (`src/lib/security-headers.ts`):

- `Content-Security-Policy`: per-request nonce with `strict-dynamic` for scripts, no
  `unsafe-eval` in production, `object-src 'none'`, `frame-ancestors 'none'`,
  `base-uri 'self'`, `form-action 'self'` plus an optional `CHECKOUT_ORIGIN`. Images and media
  are limited to `'self'` and the two Bunny CDN hosts from env; frames are limited to Bunny's
  player. Styles allow `'unsafe-inline'` because React style attributes need it; scripts do not.
- `Strict-Transport-Security` (2 years, subdomains), `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`,
  `Cross-Origin-Opener-Policy: same-origin`, a restrictive `Permissions-Policy`, and
  `X-Robots-Tag: noindex…`.
- When the real processor is integrated, set `CHECKOUT_ORIGIN` to its hosted-checkout origin
  so no-JavaScript form posts can redirect there.

## Authentication and authorization

`src/security/auth-guards.test.ts` enumerates every server action and route handler and fails
if one lacks a guard (`requireAdmin`, `requireUser`, `requireVerifiedUser`,
`requireVaultAccess`, `vaultActorOrNull` or `getCurrentUser`) unless it is on a short,
justified public list. It also checks that every vault page and route requires a fresh vault
unlock, and that every state-changing cookie route handler calls the cross-site check.

| Entry point                            | Who            | Check                                                                    | Notes                                                                 |
| -------------------------------------- | -------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Proxy (all routes)                     | everyone       | signed 18+ cookie                                                        | Exempt: `/gate`, `/legal/*`, `/api/health`, `/api/webhooks/*`, robots |
| `/feed`, `/p/[id]`                     | verified fan   | `requireVerifiedUser` + `resolveAccess`                                  | Unlinked (non-2257) media dropped for non-admins                      |
| `POST /api/media/[id]/playback`        | verified fan   | session + `resolveAccessFor` + 2257 link + rate limit + cross-site check | Per-user 120/min                                                      |
| `GET /api/media/local/...`             | token holder   | HMAC bound to path + expiry                                              | Dev storage only; 404 with Bunny                                      |
| `/subscribe`, payment actions          | verified fan   | `requireVerifiedUser`                                                    | Amount set server-side, never from the client                         |
| `/pay/fake/[id]`                       | checkout owner | session + `checkout.userId === user.id`                                  | 404 unless fake processor allowed                                     |
| `/checkout/return`                     | checkout owner | session + ownership                                                      | Shows status only; webhooks grant access                              |
| `/api/webhooks/[processor]`            | processor      | adapter signature + timestamp                                            | 400 and nothing stored on mismatch; idempotent                        |
| `/account/*`, `/api/account/export`    | signed-in user | `requireUser` / `getCurrentUser`                                         | Export rate limited and audited; delete needs password                |
| `/admin/*` pages                       | admin          | `requireAdmin` in layout (404 for others)                                | Server actions re-check `requireAdmin` themselves                     |
| `/api/admin/media/*`                   | admin          | `getCurrentUser` + role + cross-site check                               |                                                                       |
| `/admin/vault/*`, `/api/admin/vault/*` | admin + unlock | `requireVaultAccess` / `vaultActorOrNull`                                | Password re-entry every 10 min; every read audited                    |
| `/legal/takedown`                      | anyone         | honeypot + timing + per-IP limit                                         | Emails only `ADMIN_NOTIFY_EMAIL`                                      |

### IDOR review

Every id that arrives from a browser is either checked against the session user or only
reachable by admins:

- **Media ids** (playback, post page): access is recomputed from entitlements on every request; knowing an id gives nothing.
- **Checkout ids** (fake pay page, return page, simulator): ownership compared with the session user.
- **Vault document and performer ids**: admin plus fresh unlock; every access audited.
- **Takedown ids**: admin only.
- **Webhook payload ids**: trusted only after the signature verifies; unknown ids are recorded as failed events, not applied.
- **Age-verification ids**: `completeAgeVerification` requires the attempt to belong to the session user.

### CSRF

Server actions get Next's built-in origin check. Session cookies are `SameSite=Lax`, the vault
cookie `Strict`. State-changing route handlers (`image`, `upload`, `vault documents`,
`playback`) additionally reject requests whose `Origin` or `Sec-Fetch-Site` shows another site.

### SSRF

The server never fetches a URL supplied by a user. Outbound calls go only to fixed hosts
(SendGrid, `video.bunnycdn.com`, `storage.bunnycdn.com`, the configured Bunny CDN host) with
ids taken from our own database. URLs in takedown reports are stored and displayed, never
fetched.

### Upload validation

- **Images:** type allow-list, 8 MB cap, decoded by sharp with a 50-megapixel limit, then re-encoded (strips metadata and anything that isn't image data).
- **Vault documents:** 4 MB cap; type decided by magic bytes (JPEG, PNG, PDF only), never by the browser's claim.
- **Dev video uploads:** 200 MB cap, admin only, refused outside the fake provider. With Bunny, video bytes go straight to Bunny and never reach the app.
- **Storage keys** are generated server-side and validated against a strict pattern; path traversal is rejected (tested).

## Residual risks and follow-ups

1. **Real adapters are not built.** The payment processor and age-verification vendor are
   still the fake/stub implementations, which production refuses. Each real adapter must
   verify its vendor's webhook/callback signature; `verify-age/callback` is a placeholder.
2. **Bunny token recipes are unverified.** Header names and hash constructions follow the
   Phase 0 research, which could not open Bunny's docs. Confirm before the first real upload.
3. **Watermark is client-side.** It traces casual leaks; a technical user can remove it. Bunny
   DRM is the next step if leaks become a problem (see Phase 0 report 02).
4. **Rate limits use IP prefixes.** Fans behind one carrier NAT share a bucket. Limits are
   generous for 120 fans; watch the audit log for false positives.
5. **Admin 2FA.** Admin accounts use password + vault re-entry. Adding TOTP for the two admin
   accounts is recommended before launch; it is not built.
