# Phase 0 — Gates: research results and decisions needed

Status: research complete, **no decisions made**. Phase 0 is done when Carson picks hosting, database and video from vendors confirmed adult-friendly in writing. No app code has been written.

## Reports

| # | PLAN.md item | Report | Bottom line |
|---|---|---|---|
| 1 | Vendor policy check | [01-vendor-policy-check.md](01-vendor-policy-check.md) | Only **bunny.net**, **DigitalOcean** and **SendGrid** have policy text that affirmatively allows legal adult content. **Hetzner, Fly.io, Vimeo, Brevo** prohibit it. **Vercel** is unconfirmed and the riskiest mainstream choice. Everything else (AWS, Google Cloud, Cloudflare, Supabase, Neon, Mux, Backblaze, etc.) is silent and needs a one-line email. |
| 2 | DRM reality check | [02-drm-reality-check.md](02-drm-reality-check.md) | True DRM is available cheaply only from **Bunny Stream** (~$150/mo with DRM, ~$25 without) and **Mux** (whose terms likely ban adult content). Cloudflare Stream has signed tokens only, no DRM. Nobody affordable offers invisible forensic watermarking. DRM does not stop desktop Chrome screen recording or a phone camera. |
| 3 | State age-verification law | [03-age-verification.md](03-age-verification.md) | 27 US states have adult-site age-verification laws; the Supreme Court upheld the model in June 2025. A card charge is not a safe age check anywhere. Stripe Identity bars adult use. Shortlist: **FSC PrivateAV**, **VerifyMy**, **Veriff self-serve**, with Yoti as the premium option. Realistic cost $30–100/mo. |
| 4 | Processor application pack | [04-processor-application-pack.md](04-processor-application-pack.md) | Use a payment facilitator (CCBill, Segpay, Epoch, Verotel, Vendo), not a gateway. All-in processor cost at $1,800/mo gross is **18–25% of gross**, at or above OnlyFans' 20%. The case for leaving is ownership and platform risk, not fees. Processors will not approve a site with placeholder legal pages. |

## Research caveat that applies to all four reports

The cloud environment's network policy returned HTTP 403 for nearly every vendor, legislature and regulator domain, so the agents could not open the pages. Almost every quote and price is taken from a search-engine excerpt of the linked page and is tagged as such in each report. Each report lists the items marked UNCONFIRMED. Before any contract is signed or any statute is cited to the attorney, the linked page has to be opened and the figure confirmed. That is a few minutes per vendor.

To let a future session read those pages directly, change the environment's Network access setting (cloud environment menu in the session title bar, then Edit) to a broader level or add the vendor hosts under Allowed domains. Steps: https://code.claude.com/docs/en/cloud-environments#network-access

## Decisions for Carson

1. **Hosting + database.** Default recommendation from report 01: DigitalOcean (App Platform or a Droplet, Managed Postgres, Spaces), the one mainstream host whose terms address lawful adult content. Confirm the "sole discretion" clause with DigitalOcean support by email before building (template in report 01 §4). Alternative: email AWS or Google Cloud, whose policies are silent.
2. **Video.** Default recommendation from report 02: Bunny Stream, with DRM off at launch and switchable on later. Decide whether ~$125/mo extra for Widevine/FairPlay is worth it, knowing it does not stop desktop screen recording. Cloudflare Stream is the no-DRM fallback.
3. **Email.** SendGrid for transactional mail only, no explicit content in any email. Resend and Postmark are unconfirmed for an adult business.
4. **Age verification vendor.** Pick one to approach from the shortlist in report 03 §6 and decide whether to verify at signup or at first purchase (report 03 §4). Attorney input needed on which states' laws apply and whether to geo-block any.
5. **Processor.** Apply to two in parallel once the LLC, bank account and attorney-drafted legal pages exist (sequence in report 04 §5). Confirm CCBill's conflicting payout cadence and chargeback fee figures.
6. **Fee reality check.** Report 04 §6: at current scale the processor alone costs about what OnlyFans does. Confirm with the creator that the move is about ownership and platform risk, not a fee saving.

## What to check before signing off on Phase 0

- [ ] Open each PERMITTED vendor's policy link in report 01 and confirm the quoted sentence is on the live page.
- [ ] Send the report 01 §4 email to every UNCONFIRMED vendor still in consideration; file written replies.
- [ ] Confirm Bunny Stream pricing and DRM terms on bunny.net (report 02 §3).
- [ ] Hand report 03 to the attorney with the §7 question list.
- [ ] Resolve the two CCBill conflicts flagged in report 04 §2.
- [ ] Record the picks (hosting, DB, video, email, AV vendor, processor candidates) by ticking the boxes in PLAN.md Phase 0.

## Open questions from PLAN.md still unanswered

1. Which tiers does the creator sell today (subscription, PPV, tips, customs, DMs)? Default: DMs and customs out of scope for v1.
2. Messaging with fans at launch? Default: no.
3. Domain name and brand; the registrar must allow adult content.
4. Who is the 2257 custodian of records: Carson, the creator, or the attorney?
