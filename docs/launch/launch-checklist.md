# Launch checklist

Launch when every box is ticked and Carson has signed at the bottom. PLAN.md Phase 6 "done
when": Carson signs off on this checklist and the processor has approved the live site.

## Blockers (code)

- [ ] **Real payment processor adapter** for the approved processor (CCBill/Segpay/...),
      implementing `PaymentProcessor` with webhook signature verification. Production refuses
      the fake processor.
- [ ] **Real age-verification adapter** for the chosen vendor, implementing `AgeVerifier` plus a
      signed callback in `src/app/verify-age/callback/route.ts`. Production refuses the stub.
- [ ] **Bunny adapters confirmed** against Bunny's live docs (header names, token hashes), and
      one real upload and playback tested.
- [ ] **Admin 2FA** for the two admin accounts (recommended; not built).

## Legal (attorney)

- [ ] Final copy for Terms, Privacy, Refunds, DMCA (with registered agent), 2257 statement,
      and Contact replaces every `[ATTORNEY COPY NEEDED]`.
- [ ] Which state and foreign age-verification laws apply, and whether to geo-block any.
- [ ] 2257 custodian of records named; vault structure approved before real documents go in.
- [ ] Retention periods for payment records, playback grants, audit log and deleted accounts.
- [ ] OnlyFans terms reviewed for the announcement plan.

## Vendors

- [ ] Written confirmation from **Vercel** and **Neon** that lawful adult content is permitted
      (both unconfirmed in Phase 0; email template in `docs/phase0/01-vendor-policy-check.md`).
- [ ] Bunny, SendGrid and the age-verification vendor confirmed in writing.
- [ ] Domain registered with a registrar that allows adult content.
- [ ] Processor approved the live site (they review it live, with legal pages in place).

## Configuration (Vercel production environment)

- [ ] `APP_URL`, `DATABASE_URL` (Neon **pooled**), `SESSION_SECRET`, `VAULT_ENCRYPTION_KEY`
      (also stored offline with the custodian).
- [ ] `EMAIL_PROVIDER=sendgrid`, `SENDGRID_API_KEY`, `EMAIL_FROM` (verified sender), `ADMIN_NOTIFY_EMAIL`.
- [ ] `MEDIA_PROVIDER=bunny` and all `BUNNY_*` values; token authentication enabled on the
      Stream library and the pull zone.
- [ ] `PAYMENT_PROCESSOR=<real>`, `BILLING_DESCRIPTOR` matches the processor, `CHECKOUT_ORIGIN` set.
- [ ] `ALLOW_FAKE_PAYMENTS` and `ALLOW_STUB_AGE_VERIFIER` **unset** in production.
- [ ] `npm run db:migrate` run against production; `/api/health` returns ok.
- [ ] Creator and Carson accounts created, then promoted with `npm run make-admin -- <email>`.

## Operations

- [ ] Neon point-in-time restore window confirmed (7+ days).
- [ ] One offline backup taken and `scripts/restore-check.sh` passed on it.
- [ ] Repository variable `APP_URL` set so the uptime workflow runs; a second monitor configured.
- [ ] Load test re-run against a preview + Neon branch (`docs/runbooks/operations.md`).

## End-to-end test on the live site (real card, then refund)

- [ ] Age gate → signup → email confirmation → age verification → subscribe → view a
      subscriber post with the watermark visible.
- [ ] Unlock a PPV post; send a tip; receipts arrive and show the billing descriptor.
- [ ] Cancel; access continues to period end. Refund the test charges from the processor.
- [ ] Data download and account deletion work for a test fan.
- [ ] Content report form reaches `/admin/takedowns`.
- [ ] Publishing a post with an unlinked item is refused.

## Sign-off

- [ ] Every item above is ticked.

Signed: ______________________ (Carson) Date: ____________
