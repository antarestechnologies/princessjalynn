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
