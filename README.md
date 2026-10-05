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
