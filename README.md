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
