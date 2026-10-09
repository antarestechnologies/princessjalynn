# Operations runbook

## Backups

**Primary: Neon point-in-time restore.** Neon keeps a history window (length depends on the
plan) and can restore or branch the database to any moment inside it. Check the window in the
Neon console under the project's settings and make sure it is at least 7 days.

**Secondary: offline dump, monthly and before every risky change.**

```bash
DATABASE_URL="<neon direct (non-pooled) url>" scripts/backup.sh backups/
```

This writes `backups/db-<timestamp>.dump` and a `.sha256`. Store the dump somewhere the site
does not control (an encrypted drive the custodian keeps). Store `VAULT_ENCRYPTION_KEY`
separately; a dump plus the key is a complete copy of the 2257 records, so never keep them
together.

**Media.** Bunny Storage and Stream hold the photos and videos. Keep the creator's original
files as the real backup (they are needed anyway for re-uploads). Bunny Storage replication
regions can be enabled in the storage zone settings for redundancy.

## Tested restore

Run this after every backup you intend to rely on, and at least quarterly:

```bash
RESTORE_ADMIN_URL="postgres://user@localhost:5432/postgres" \
VAULT_ENCRYPTION_KEY="<the real key>" SESSION_SECRET="<any 32+ chars>" \
scripts/restore-check.sh backups/db-<timestamp>.dump
```

It verifies the checksum, restores into a throwaway database, prints row counts, checks the
audit-log triggers survived, and decrypts every vault record and document with the key. It
ends with `RESTORE CHECK PASSED` or exits non-zero. It drops the throwaway database afterwards.

Verified on 2026-10-09 against a local Postgres 16 copy of the dev database: passed, and with
the wrong key it failed as it should.

**Real restore.** Prefer Neon's point-in-time restore to a new branch, check it, then switch
`DATABASE_URL`. From a dump, restore into a new Neon database with `pg_restore --no-owner
--no-privileges`, run `scripts/restore-check.sh`-style checks, then switch.

## Uptime monitoring

- `GET /api/health` returns `{"ok":true,"db":"up"}` or HTTP 503. It is exempt from the age gate
  and returns no data.
- `.github/workflows/uptime.yml` checks it every 15 minutes once the repository variable
  `APP_URL` is set. GitHub emails the repo owner when a run fails. GitHub's scheduler can lag,
  so also add a dedicated monitor (for example Better Stack or UptimeRobot, after confirming
  their terms allow monitoring an adult site; the endpoint itself returns no content).
- Vercel's dashboard shows function errors; set up a log drain or alert on 5xx rates when
  traffic starts.

## Load test

`scripts/load-seed.ts` seeds fans with live subscriptions and sessions, and posts with
2257-linked media. `scripts/load-test.ts` runs four scenarios, one fan per connection.

Run 2026-10-09 on a 4-vCPU sandbox: a single `next start` process in production mode, with
Postgres 16 on the same machine, a pool of 5 connections and 327 published posts. This is a
worst case. Vercel runs many instances and Neon pools connections.

**Expected peak (20 concurrent connections, back-to-back requests)**

| Scenario                  | Req/s | p50 ms | p99 ms | Errors |
| ------------------------- | ----- | ------ | ------ | ------ |
| Health                    | 372   | 50     | 99     | 0      |
| Feed                      | 52    | 365    | 615    | 0      |
| Post page (writes grants) | 64    | 292    | 609    | 0      |
| Playback refresh          | 101   | 194    | 286    | 0      |

**10x peak (200 concurrent connections)**

| Scenario                  | Req/s | p50 ms | p99 ms | Errors |
| ------------------------- | ----- | ------ | ------ | ------ |
| Health                    | 248   | 763    | 2757   | 0      |
| Feed                      | 42    | 4064   | 8864   | 0      |
| Post page (writes grants) | 50    | 3147   | 7177   | 0      |
| Playback refresh          | 98    | 1882   | 4002   | 0      |

Findings:

- The load test found the feed loading every published post at once. With 327 posts that
  collapsed to 3 req/s and 668 timeouts at 200 connections. The feed is now paged (24 posts
  per page); the same test afterwards had zero errors.
- At 10x, one process stays correct (no errors, no 5xx, every grant recorded) but slows to
  seconds. On Vercel the same load spreads across instances. Each of the 200 test connections
  sends requests back to back, far more than 200 real people browsing.
- Postgres connections: each serverless instance opens at most 5. Use Neon's **pooled**
  connection string in `DATABASE_URL` so many instances share the pooler.

Re-run before launch against a Vercel preview with a Neon branch:

```bash
DATABASE_URL=<neon branch url> npx tsx scripts/load-seed.ts 200 load.json
npx tsx scripts/load-test.ts https://<preview-url> load.json 200 30
```

Never seed or load-test the production database.
