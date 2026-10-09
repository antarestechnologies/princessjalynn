# princessjalynn

Single-creator subscription site. See [PLAN.md](PLAN.md) for the phased build plan and
`docs/phase0/` for the vendor, DRM, age-verification and payment-processor research.

## Stack

Next.js (App Router, TypeScript, Tailwind) on Vercel · Postgres on Neon via Drizzle ORM ·
Bunny Stream for video · SendGrid for transactional email. Payments and video sit behind
`PaymentProcessor` and `VideoProvider` interfaces so vendors can be swapped.

## Local development

```bash
cp .env.example .env.local      # then set DATABASE_URL to a Postgres 16 instance
npm install
npm run db:migrate              # applies ./drizzle/*.sql, safe to re-run
npm run dev                     # http://localhost:3000, health at /api/health
```

Tests use an in-memory Postgres (PGlite) and need no database:

```bash
npm test
npm run check                   # lint + typecheck + format + test, same as CI
```

## Phase 2: age gate, accounts, age verification

- Every request passes `src/proxy.ts`. Without a valid signed 18+ cookie, pages redirect to
  `/gate` and API routes get a 403. Exempt paths are listed in `src/lib/age-gate.ts`. Every
  response carries `X-Robots-Tag: noindex`, and `/robots.txt` disallows everything.
- Accounts: signup, email confirmation, login, logout, password reset. Sessions are rows in
  `sessions` keyed by a hashed random token in the `sid` cookie. Passwords use scrypt.
- Bot protection on auth forms: honeypot + minimum fill time (`src/auth/bot-check.ts`) and
  Postgres-backed rate limits (`src/lib/rate-limit.ts`).
- Email goes through the `Mailer` interface. `EMAIL_PROVIDER=console` prints the links to the
  dev server log; `sendgrid` sends real mail. Production refuses `console`.
- Age verification goes through the `AgeVerifier` interface (`src/age-verification/`). The
  `stub` adapter shows a Pass/Fail page at `/verify-age/stub` and is refused in production
  unless `ALLOW_STUB_AGE_VERIFIER=true`. The real vendor adapter implements `start()` and a
  callback route that calls `completeAgeVerification()`.
- `requireVerifiedUser()` (email confirmed + age verified) is the bar for any paid or
  explicit content route in Phase 3.

Try the flow locally: `npm run dev`, open `/`, pass the gate, sign up, copy the confirmation
link from the terminal, sign in, go to `/verify-age` and pick an outcome on the stub page.

## Phase 3: content and video

- Vendors sit behind `VideoProvider` and `ImageStorage` (`src/media/`). `MEDIA_PROVIDER=fake`
  stores files under `.data/media` and serves them through `/api/media/local/...` with an
  HMAC token and expiry. `bunny` uses Bunny Stream (video, tus upload straight from the
  browser, token-authenticated embed) and Bunny Storage + CDN (images, token-authenticated
  URLs). The Bunny header names and hash recipes were written from the Phase 0 research and
  must be confirmed against Bunny's docs before the first real upload.
- Access is decided in one place, `resolveAccess` in `src/access/entitlements.ts`. Free
  posts still need a signed-in, age-verified viewer. Subscriber posts need a live
  `entitlements` row of kind `subscription`; pay-per-view posts need a `post` entitlement.
  Payments (Phase 4) write those rows. No media URL is produced before that check passes.
- Every URL expires (15 minutes for playback, 1 hour for posters) and each issue is recorded
  in `playback_grants` with the viewer, media, IP prefix and a nonce.
- The viewer draws a moving watermark (`@handle · nonce · time`) over every item. The nonce
  maps a leaked frame to one grant row. Deterrents (no context menu, no download control, no
  picture-in-picture, blur on tab blur) raise the effort for casual saving. They do not stop
  screen recording or a phone camera. Bunny's DRM add-on can be enabled later for iOS/Safari
  and Android L1 recording protection; nothing stops desktop capture.
- Images are re-encoded on upload (camera metadata removed) into an original, a poster and
  a tiny blurred preview used for locked posts. Video posters come from the provider and are
  blurred the same way.
- Admin (`/admin/posts`, requires role `admin`): create posts, set tier and price, upload
  media, publish now or schedule. Promote an account with `npm run make-admin -- <email>`.
  Scheduled posts go live at `publishAt` with no cron.
- Vercel caps request bodies near 4.5 MB, so images larger than that must be resized first;
  videos never pass through Vercel with the Bunny provider.

## Phase 4: payments

- Processors sit behind `PaymentProcessor` (`src/payments/types.ts`): `createCheckout`,
  `parseWebhook`, `cancelSubscription`, `refund`. Card data never touches this site; every
  checkout is the processor's hosted page, and we store only processor ids.
- Each adapter turns its vendor's webhooks into a small set of normalized events. One state
  machine (`src/payments/service.ts`) applies them and is the only code that writes
  `subscriptions`, `purchases`, `tips` and `entitlements`.
- Webhooks arrive at `/api/webhooks/<processor>`, which is exempt from the age gate and
  protected by the adapter's signature check. A bad signature is a 400 and nothing is stored.
  Every event id is recorded in `webhook_events`, so a replay is a no-op.
- What each event does:
  - **created / renewed**: subscription active, access until the period end, receipt emailed.
  - **renewal_failed**: status `past_due`, access continues for `GRACE_PERIOD_DAYS` (default 3).
  - **canceled**: no further renewals; access runs to the end of what was paid.
  - **expired**: access revoked.
  - **refunded**: that payment's access revoked; a refunded membership ends.
  - **chargeback**: every entitlement on the account revoked and the account flagged.
- `PAYMENT_PROCESSOR=fake` is a simulator for development. Checkout goes to `/pay/fake/<id>`
  with approve/decline buttons, and `/admin/fake-payments` can renew, fail, cancel, expire,
  refund or charge back any payment. Each button sends a signed webhook through the real
  ingest path. Production refuses the fake processor unless `ALLOW_FAKE_PAYMENTS=true`.
- Fans: `/subscribe`, unlock buttons on PPV posts, tips on unlocked posts, and
  `/account/billing` with cancel-anytime and payment history. The billing descriptor
  (`BILLING_DESCRIPTOR`) is shown before checkout and on every receipt.
- Admin: `/admin/revenue` shows subscribers, MRR, past-due count, this month's memberships,
  unlocks, tips and refunds, and the 90-day chargeback rate, which turns amber at 0.5%.
- Adding a real processor means one new adapter file plus an entry in `src/payments/index.ts`.
  The state machine and tests do not change.

## Phase 5: compliance

- Legal pages live under `/legal/*`: terms, privacy, refunds, DMCA, 2257 statement, contact
  and the content report form. They are reachable before the age gate and contain no adult
  content. Each one is a placeholder marked `[ATTORNEY COPY NEEDED]` that lists what counsel
  must supply. No legal text was written. Every page links to them from the footer.
- `/legal/takedown` is a public report form with a honeypot, timing check and a per-IP rate
  limit. It emails nobody but `ADMIN_NOTIFY_EMAIL`, if set, so it cannot be used as a relay.
  Admins work the queue at `/admin/takedowns`. Every status change is audited.
- The 2257 vault (`/admin/vault`) is admin-only and also needs a password re-entry every 10
  minutes. Performer identity data (legal name, aliases, date of birth, ID details) is stored
  only as AES-256-GCM ciphertext. ID scans, releases and consent forms are encrypted the same
  way and stored in Postgres, never in the media bucket. Each ciphertext is bound to its own
  row, so copying it elsewhere makes it unreadable.
- Every vault read writes an audit row first: list, view, download, export, unlock and
  failed unlock. Audit metadata and logs carry ids only, never identity data.
- A performer is "verified" only with an uploaded ID front and a date of birth at least 18
  years ago. The post editor links each media item to a verified performer with a production
  date, and refuses a link if the performer was under 18 on that date.
- A post cannot be published unless every media item on it is linked to a verified record.
  Fan-facing pages and the playback API also drop any media item that lacks a link, so media
  added after publishing stays hidden until it is linked.
- Links keep the original media id and post title even if the media is deleted, because the
  records must outlive the content. `/api/admin/vault/export` downloads the full index as CSV
  with identity fields decrypted and spreadsheet-formula injection neutralised.
- `VAULT_ENCRYPTION_KEY` (32 bytes, base64) is required in production. Losing it makes every
  record unreadable. Keep an offline copy with the custodian of records. The attorney must
  approve this structure before real documents go in.

## Phase 6: hardening and launch

- Security review, with the route-by-route auth table, IDOR, CSRF, SSRF and upload findings:
  `docs/security/phase6-review.md`. `src/security/auth-guards.test.ts` fails the build if a
  server action or route handler is added without an authorization check.
- CSP with per-request nonces, HSTS and other headers are set in the proxy
  (`src/lib/security-headers.ts`). State-changing cookie route handlers reject cross-site
  requests. Playback refresh is rate limited per user.
- CI audits production dependencies on every push. `.github/workflows/uptime.yml` checks
  `/api/health` every 15 minutes once the `APP_URL` repository variable is set.
- Backups, the tested restore, monitoring and load-test results: `docs/runbooks/operations.md`.
  `scripts/backup.sh`, `scripts/restore-check.sh`, `scripts/load-seed.ts`, `scripts/load-test.ts`.
- Fans can download all their data and delete their account at `/account/privacy`. Deletion
  cancels billing first and does nothing if the processor cannot be reached.
- The feed is paged (24 per page) after the load test showed the unpaged feed collapsing with
  a large back catalogue.
- OnlyFans migration plan and announcement draft: `docs/launch/onlyfans-migration.md`.
  Launch checklist for sign-off: `docs/launch/launch-checklist.md`.

## Deploying on Vercel

`vercel.json` pins the framework to Next.js. Production and preview deployments both run with
`NODE_ENV=production`, so the environment checks in `src/env.ts` apply to previews too. A
deployment needs these variables:

- **Always:** `APP_URL`, `DATABASE_URL` (Neon pooled URL), `SESSION_SECRET`, `VAULT_ENCRYPTION_KEY`.
- **Email:** `EMAIL_PROVIDER=sendgrid`, `SENDGRID_API_KEY`, `EMAIL_FROM`.
- **Media:** `MEDIA_PROVIDER=bunny` and the eight `BUNNY_*` variables.
- **Staging only:** `ALLOW_FAKE_PAYMENTS=true`, `ALLOW_STUB_AGE_VERIFIER=true`. Never set these on the live site.
- **Optional:** `CHECKOUT_ORIGIN` (the processor's hosted-checkout origin, added to the CSP), `ADMIN_NOTIFY_EMAIL`.

Run `npm run db:migrate` against the Neon database before the first deploy and after any
deploy that adds a migration.

## Database changes

1. Edit `src/db/schema.ts`.
2. `npm run db:generate` writes a new SQL file to `drizzle/`. Commit it. CI fails if the
   schema and migrations disagree.
3. For hand-written SQL (triggers, constraints), run `npx drizzle-kit generate --custom --name=<what>`
   and fill in the generated file.

## Rules that are not negotiable

Card data never touches these servers. Media is only ever served through short-lived
signed tokens. ID documents and 2257 records never go in the public bucket or in logs.
Secrets live in environment variables. See PLAN.md for the full list.
