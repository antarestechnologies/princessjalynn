# Creator Site Build Plan

Drop this file in the repo root. Tell Claude Code: "Read PLAN.md. Start with Phase 0, then work one phase at a time. Stop at the end of each phase and show me what to check."

## Context

- Single-creator subscription site for one adult performer. No multi-tenant, no other creators, ever.
- Scale: ~120 subscribers at $15/mo, plus pay-per-view (PPV) and tips. Peak concurrency ~20. Build simple, not clever.
- Goal: replace OnlyFans (20% fee). Fans pay through a high-risk processor (CCBill, Segpay or Vendo, undecided).
- Owner/operator: Carson. Creator is the sole performer and the content owner.

## Non-negotiables

1. No card data ever touches our servers. Use the processor's hosted checkout. Store only processor customer/subscription IDs.
2. Every video plays through short-lived signed tokens. No public media URLs.
3. Every video stream carries a per-viewer watermark (user ID/handle) so leaks are traceable.
4. Nothing is visible before the age gate. Nothing paid is visible without an active entitlement.
5. 2257 records and any ID documents live only in an admin-only, encrypted store. Never in the public bucket, never in logs.
6. Secrets in env vars only. Nothing committed.
7. Do not invent legal text. Legal pages are placeholders until the attorney supplies final copy.

## Stack (default, change only with a stated reason)

- Next.js (App Router) + TypeScript, Tailwind
- Postgres (Neon) with migrations checked in (Drizzle ORM + drizzle-kit SQL migrations)
- Auth: email + password with email verification; admin role for the creator and Carson
- Video: behind a `VideoProvider` interface so the vendor can be swapped (see Phase 0)
- Payments: behind a `PaymentProcessor` interface, with a fake provider for local dev
- Hosting: Vercel (decided 2026-10-05; AUP confirmation pending)

## Phase 0 — Gates (do before writing app code)

Claude Code should research and report; Carson decides.

- [ ] **Vendor policy check.** For each of hosting (app), database, video, email, and CDN: confirm in writing that the acceptable use policy permits legal adult content. Known so far: Vercel's AUP bans "obscene, graphic... sexually exploitative" content and does not address legal adult content explicitly, so treat it as unconfirmed and ask support. Mux and Cloudflare Stream policies are unconfirmed. Output: a table of vendor / policy link / verdict / who to email.
- [ ] **DRM reality check.** Cloudflare Stream documents signed-URL/token protection, not Widevine/FairPlay DRM. Confirm which candidate video vendors offer true DRM and what they cost. Signed URLs plus watermarking is the fallback, and the creator must be told it does not stop screen recording.
- [ ] **State age-verification law.** Many US states (Alabama among them) require age verification for adult sites. Attorney to confirm which apply to our audience. Pick an ID-verification vendor (e.g. Persona, Veriff, Yoti) that permits adult clients.
- [ ] **Processor application pack.** Draft the checklist processors will want: creator ID, 2257 documentation, business entity info, site URL, terms/privacy/refund pages, billing descriptor. Output a checklist, not a submission.
- Done when: Carson has a vendor shortlist where every vendor is confirmed adult-friendly, and picks hosting, DB and video.
- **Decisions (2026-10-05):** research reports are in `docs/phase0/`. Carson picked **Vercel** (hosting), **Neon** (Postgres), **Bunny Stream** (video), **SendGrid** (transactional email). Vercel's and Neon's AUPs are UNCONFIRMED for lawful adult content per report 01; email both with the report 01 §4 template before launch. Age-verification vendor and processor are still open; neither blocks Phase 1.

## Phase 1 — Foundation

- Repo, TypeScript, lint, formatting, CI running typecheck + tests
- DB schema + migrations: `users`, `subscriptions`, `purchases` (PPV), `tips`, `posts`, `media`, `entitlements`, `audit_log`, `takedown_requests`
- Env handling, `.env.example`, error logging that scrubs PII
- Done when: `npm run dev` boots, migrations apply cleanly, CI is green.

## Phase 2 — Age gate and accounts

- Entry interstitial (18+ attestation) with a cookie; blocks all routes and all search-engine indexing of media
- Signup, email verification, login, password reset, session handling
- Third-party ID/age verification at signup or first purchase (vendor from Phase 0)
- Rate limiting and bot protection on auth routes
- Done when: an unverified visitor can see only the gate; a verified user can log in and out; tests cover the gate bypass attempts.

## Phase 3 — Content and video

- Admin: upload photo/video, title, caption, tier (free preview / subscriber / PPV with price), schedule publish
- Video ingest through `VideoProvider`; thumbnails and blurred previews for locked posts
- Playback: server issues a short-lived signed token only after checking entitlement
- Watermark: visible per-viewer overlay (handle + timestamp), randomized position; forensic watermark if the vendor supports it
- Deterrents (honest ones only): block right-click save, hide download controls, blur on tab blur. Document that these are deterrents.
- Feed, post page, locked/unlocked states, free-preview teaser
- Done when: a non-subscriber cannot fetch media by guessing URLs, tokens expire, and a test proves an expired token fails.

## Phase 4 — Payments

- `PaymentProcessor` interface: createCheckout, handleWebhook, cancelSubscription, refund
- Fake provider first so the whole flow works locally; real adapter added once the processor is approved
- Webhooks: verify signature, idempotent by event ID, update `subscriptions`/`purchases`/`entitlements`
- Handle renewals, failed renewals (grace period), cancellations, refunds, chargebacks (revoke access, flag account)
- Discreet billing descriptor, cancel-anytime page, receipts by email
- Admin revenue view: subscribers, MRR, PPV, tips, refunds, chargeback rate (processors watch this number)
- Done when: every subscription state change in the fake provider is reflected correctly in access, with tests.
- **Defaults used (2026-10-09):** $15/month subscription, 3-day grace period after a failed renewal, a subscription does not unlock PPV posts, tips $1 to $500. All are env settings except the PPV rule.

## Phase 5 — Compliance

- Pages with placeholder text clearly marked `[ATTORNEY COPY NEEDED]`: Terms, Privacy, DMCA/takedown with registered agent, Refund/Cancellation, 2257 compliance statement, Contact
- Takedown intake form and admin queue
- 2257 vault (admin-only): performer record, ID document uploads (encrypted at rest), and an index linking each piece of media to its record, exportable on request. Attorney reviews the structure before real documents go in.
- Audit log for admin actions and for any access to the vault
- Done when: a media item cannot be published without a linked 2257 record, and a vault access appears in the audit log.

## Phase 6 — Hardening and launch

- Security pass: dependency audit, headers/CSP, auth review, upload validation, SSRF/IDOR checks on every media and admin route
- Load test to ~10x expected peak
- Backups and a tested restore; uptime monitoring
- Data export for fans (privacy) and account deletion
- Migration plan from OnlyFans: announcement copy, promo window, how fans re-subscribe. No scraping or automated import from OnlyFans; her own content comes from her own files.
- Done when: Carson signs off on a launch checklist and the processor has approved the live site.

## Open questions for Carson

1. Which tiers does she actually sell today (subscription only, PPV, tips, custom requests, DMs)? DMs and custom requests are a big scope jump; default is out of scope for v1.
2. Does she need messaging with fans at launch? Default: no.
3. Domain name and brand? The domain needs to be registered with a registrar that allows adult content.
4. Who holds the 2257 custodian role: Carson, the creator, or the attorney?
