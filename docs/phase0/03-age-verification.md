# Phase 0 — Age Verification: Law Landscape and Vendor Options

Research date: 2026-10-05. Prepared for Carson's attorney conversation. This is a factual briefing, not legal advice. Nothing here is statutory text unless marked as a quotation from a cited source; the attorney makes every legal call.

Research-method caveat (read first): the sandbox's network policy blocked direct page fetches to nearly every site (legislatures, Ofcom, vendors, FSC, Wikipedia), so every fact below comes from search-engine excerpts of the cited pages, not from reading the full pages. Treat every figure as "reported by [source]" and have the attorney (or a later session with network access) confirm against the statute or the vendor's own page before relying on it. Items with no excerpt support at all are marked **UNCONFIRMED**.

---

## 1. Summary

- **27 US states now have enacted age-verification (AV) laws aimed at adult websites** (list in §2). The last two to take effect were West Virginia (HB 4412, June 12, 2026) and Iowa (HF 864, July 1, 2026). Most use a "substantial portion" trigger defined as one-third (33⅓%) of a site's content being "material harmful to minors"; Wyoming has no threshold; Kansas is reported to use 25% (**UNCONFIRMED**).
- **The constitutional fight is over for now.** *Free Speech Coalition v. Paxton* (U.S. Supreme Court, June 27, 2025, 6–3, Thomas, J.) upheld Texas HB 1181 under intermediate scrutiny. Injunctions that had paused Tennessee and Indiana were dissolved afterward, and states are now legislating faster (Utah even tried to regulate VPN use; that provision was preliminarily enjoined Sept 24, 2026).
- **A single-creator subscription site is squarely the kind of site these laws target** if ≥⅓ of its content is explicit. The laws apply to the *site*, including any explicit free previews shown before purchase; a paywall is not an age gate.
- **A card transaction is weak evidence of age under US state law and is rejected outright in the UK (debit cards) and France (all cards after April 11, 2025).** Several US statutes allow a "commercially reasonable method that relies on public or private transactional data," but no source found shows a state accepting a bare card charge as compliance, and debit/prepaid cards are available to minors. Do not plan on the payment processor being the age check.
- **Aylo (Pornhub) geo-blocks 25 of the 27 states** rather than verify; it stays live in Louisiana (via the LA Wallet digital ID) and Ohio (claiming a Section 230 "interactive computer service" exemption that likely does not help a site publishing its own content).
- **Non-US:** the UK Online Safety Act has required "highly effective age assurance" on any pornographic service with UK users since July 25, 2025, and Ofcom has fined small operators (£600k–£1.35M). Australia's codes took effect March 9, 2026 (Aylo blocked Australia). France (Arcom) requires "double-anonymity" AV and bans card-based checks. Canada's S‑209 passed the Senate April 15, 2026 and is at second reading in the House (not law). The EU has an AV app blueprint (July 2025) piloting in five countries; no EU-wide mandate on small non-EU sites yet.
- **Vendors:** Stripe Identity is unavailable (its terms bar adult-industry use). Vendors that *explicitly* serve adult platforms: Persona (Playboy creator platform), VerifyMy, Ondato (OnlyFans is a named customer), Incode, Sumsub, AgeGO, and FSC's PrivateAV. Recommended shortlist for a ~120-subscriber site (§6): **PrivateAV (FSC)**, **VerifyMy**, and **Veriff self-serve** (with Yoti as the premium alternative). Realistic cost: $30–$100/month at this scale.
- **2257 is separate.** 18 U.S.C. §2257 is a *producer* record-keeping duty about *performers*; it has nothing to do with verifying viewers. The AV vendor chosen here is for fans; the 2257 vault (PLAN.md Phase 5) is for the creator's own ID.

---

## 2. US state law table

Legend: "⅓" = statute applies when one-third or more of the site's material is "harmful to minors." "Txn data" = statute lists a "commercially reasonable method that relies on public or private transactional data." "PRA" = private right of action (parents/minors/users can sue). "AG" = attorney-general enforcement. "Aylo" = whether Pornhub geo-blocks the state (per the Aug–Sept 2026 lists cited). Blank/"—" = not found in sources. Litigation column is the status as reported.

| # | State | Statute / bill | Effective | Threshold | Permitted methods (as reported) | Retention / deletion | Penalties (as reported) | Enforcement | Aylo blocks? | Notes / litigation |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Louisiana | Act 440 (HB 142, 2022), La. R.S. 9:2800.28 | Jan 1, 2023 | ⅓ ("substantial portion") | "Digitized identification card" (LA Wallet) or commercial AV system using gov ID or "public or private transactional data" (legislative examples: mortgage, education, employment records) | No retention of identifying info **(one source, breached.company, claims a 7‑year retention duty — conflicts with other sources; UNCONFIRMED, likely wrong)** | Up to $10,000 per violation (reported); later act added AG penalties (**bill number UNCONFIRMED**) | PRA + AG | **No** (accepts LA Wallet) | First-in-nation law. |
| 2 | Utah | SB 287 (2023); SB 73 (2026) "Online Age Verification Amendments" | May 3, 2023; SB 73 Sept 3, 2026 | ⅓ | "Digitized identification card" / reasonable AV | No retention | Up to $2,500 per violation (reported) | **PRA only** (no AG) | Yes (since May 2023) | SB 73 added VPN-related duties; **preliminarily enjoined Sept 24, 2026** (Judge Barlow, D. Utah) in Aylo's suit; state agreed not to enforce pending ruling. |
| 3 | Mississippi | SB 2346 | July 1, 2023 | ⅓ | Digitized ID card or commercial AV system (gov ID or txn data) | "Must not retain any identifying information … after access has been granted" | — | PRA (AG **UNCONFIRMED**) | Yes | |
| 4 | Virginia | SB 1515 | July 1, 2023 | ⅓ | Digitized ID or commercial AV (gov ID or txn data) | No retention | — | PRA | Yes | |
| 5 | Arkansas | SB 66 (Act 612) | July 31, 2023 | ⅓ | Digitized ID / commercial AV | — | — | PRA | Yes | |
| 6 | Texas | HB 1181 (Civ. Prac. & Rem. Code ch. 129B) | Sept 1, 2023 (enforceable after 5th Cir., Mar 2024) | >⅓ | Gov ID; "independent, third‑party age verification service"; or "commercially reasonable method that relies on public or private transactional data" | No retention | Up to $10,000/day; +$10,000/day if identifying info retained; +$250,000 if a minor accesses content | AG (deceptive‑trade‑practices framework) | Yes (Mar 2024) | **Upheld by SCOTUS, FSC v. Paxton, June 27, 2025.** AG sued Aylo (Feb 2024, ~$1.6M), MultiMedia LLC (Chaturbate), Hammy Media (xHamster). Health‑warning label requirement was struck by the 5th Cir. (**UNCONFIRMED here**). |
| 7 | Montana | SB 544 | Jan 1, 2024 | ⅓ | Digitized ID or commercial AV (gov ID or txn data) | No retention | Civil damages, punitive damages, fees | **PRA only** | Yes | |
| 8 | North Carolina | HB 8 (S.L. 2023‑132) | Jan 1, 2024 | "substantial portion" (⅓) | Commercial AV | No retention | — | PRA | Yes | |
| 9 | Idaho | HB 498 | July 1, 2024 | ⅓ | Reasonable AV | — | PRA with **$10,000 statutory minimum damages** | PRA (AG **UNCONFIRMED**) | Yes | |
| 10 | Indiana | SB 17 | July 1, 2024 | ⅓ | "Reasonable age verification" | — | — | AG + PRA | Yes | District court enjoined June 2024; 7th Cir. stayed injunction; enforced after Paxton. **Indiana AG sued Aylo (Dec 2025) arguing it must block VPN users.** |
| 11 | Kansas | SB 394 | July 1, 2024 | "substantial portion" — reported as **25%** (**UNCONFIRMED**) | Commercial AV | — | $10,000 per violation (reported) | AG + PRA | Yes | |
| 12 | Kentucky | HB 278 | July 15, 2024 | ⅓ | — | No retention; **$1,000 for each 24‑hour period information is retained** | Civil cause of action | **PRA only** | Yes | KRS text at apps.legislature.ky.gov (id=54996). |
| 13 | Nebraska | LB 1092, "Online Age Verification Liability Act" | July 18, 2024 | ⅓ | — | No retention; anyone whose data is retained may sue platform **and** vendor | AG civil penalty up to $2,500/violation; PRA for actual damages, fees | AG + PRA | Yes | |
| 14 | Alabama | HB 164 (2024) | **Oct 1, 2024** | "substantial portion" | "Reasonable age‑verification method … commercially available tools such as software or digital ID apps" | Site **and** verifier barred from retaining identifying data | **AG fines up to $10,000 per violation**, emergency injunctions; **PRA** for persons harmed | AG + PRA | Yes (blocked ahead of Oct 1, 2024) | Also mandates public‑health warning text (exact statutory language) and a **10% gross‑receipts tax on harmful content produced in Alabama** (funds Dept. of Mental Health). Confirm whether the tax reaches an out‑of‑state producer. |
| 15 | Oklahoma | SB 1959 | Nov 1, 2024 | ⅓ | Photo ID or third‑party service | — | — (**UNCONFIRMED**) | AG | Yes | |
| 16 | Florida | HB 3 (2024) | Jan 1, 2025 | ⅓ | "Reasonable method of age verification"; **must offer at least one anonymous AV option** | No retention | **Up to $50,000 per violation** + attorney fees/costs; civil liability | AG + PRA | Yes (Jan 1, 2025) | FSC sued (FSC v. Uthmeier); law in force. |
| 17 | South Carolina | H 3424 (Child Online Safety Act) | Jan 1, 2025 | ⅓ | "Reasonable age verification" | — | — | AG (+PRA **UNCONFIRMED**) | Yes | |
| 18 | Tennessee | SB 1792 (Protect Tennessee Minors Act) | Jan 1, 2025 | "substantial portion" | Gov ID or commercial AV | — (**reported re‑verification every 60 min and 7‑year anonymized record duty — UNCONFIRMED**) | **Felony criminal penalties** + civil liability | Criminal + civil | Yes | Enjoined Dec 2024/Jan 2025 (M.D. Tenn.); injunction dissolved after Paxton (**UNCONFIRMED exact date**). |
| 19 | Georgia | SB 351 (Protecting Georgia's Children on Social Media Act) | July 1, 2025 | ⅓ | AV | — | — | AG | Yes (July 2025) | The **social‑media** portions were enjoined (NetChoice litigation, June 2025); sources conflict on whether the adult‑site AV portion is in force — Aylo blocked GA anyway. **UNCONFIRMED; ask attorney.** |
| 20 | Wyoming | HB 43 | July 1, 2025 | **None — any site hosting harmful material** | Reasonable AV | — | Civil | **PRA only** | Yes | Unique: no ⅓ threshold. |
| 21 | South Dakota | HB 1053 | July 1, 2025 | ⅓ | — | "May not retain any identifying information … after access has been granted" | — | AG + PRA (**UNCONFIRMED**) | Yes | |
| 22 | North Dakota | HB 1561 | Aug 1, 2025 | ⅓ | — | — | — (**UNCONFIRMED**) | — | Yes | |
| 23 | Arizona | HB 2112 | Sept 26, 2025 | >⅓ | "Reasonable age verification methods" | — | Up to $10,000/day; +$250,000 if a minor gains access | **PRA (parents)**; AG **UNCONFIRMED** | Yes | Signed May 13, 2025. |
| 24 | Ohio | HB 96 (budget) → R.C. §1349.10 | Sept 30, 2025 | "Regularly and substantially" publishes/distributes (threshold wording differs — **confirm**) | Commercial AV using photo ID **or public/private transactional data**; third‑party/government databases | **Immediate deletion** of AV data, except info kept for "account and subscription access and billing purposes" | AG civil action | AG | **No** | Carve‑out for "provider of an interactive computer service" (47 U.S.C. §230). Aylo says Pornhub qualifies → stays live. A single‑creator site publishing its *own* content is unlikely to fit that carve‑out (**attorney question**). Legislature considering a "redo" bill (Mar 2026). |
| 25 | Missouri | AG rule **15 CSR 60‑18.010–.060** (Merchandising Practices Act); statute **§407.3405** (2026) | Rule Nov 30, 2025; statute reported Aug 28, 2026 (**UNCONFIRMED**) | ≥33% | Gov‑issued ID, digital ID wallet, or third‑party authentication service (**transactional data not listed in excerpts**) | Third parties "forbidden from retaining any identifying information" | §407.3405: $10,000/day; $10,000 per retention instance; +$250,000 if a minor accesses | AG | Yes (Nov 2025) | Rulemaking route is unusual; comments filed by Woodhull Foundation. |
| 26 | West Virginia | HB 4412 (2026) | **June 12, 2026** | >⅓ | Gov ID, digital ID, or commercial/governmental AV using gov ID or txn data | No retention | $10,000/day; $10,000 per retention instance; +$250,000 if minors access | AG (PRA **UNCONFIRMED**) | Yes (June 12, 2026) | Enrolled text: wvlegislature.gov. |
| 27 | Iowa | **HF 864** (2026) | **July 1, 2026** | ⅓ | Digital IDs, "commercial transactional data," or other methods approved by the Iowa AG | — | Up to $10,000/day; each minor access a separate violation | AG | Yes | Signed June 2026 (Gov. Reynolds). |

**Pending (not law as of research date):** Michigan SB 191; Pennsylvania SB 603 (Judiciary); New York A3946 (committee); Illinois SB 3945 (committee); California — an adult‑site AV bill passed the Assembly (Senate/governor status **UNCONFIRMED**). FSC's bill tracker (action.freespeechcoalition.com/age-verification-bills) is the canonical live list; it was not reachable from this sandbox.

### 2.1 Free Speech Coalition v. Paxton (June 27, 2025) — what it means

- Holding (6–3, Thomas, J., joined by Roberts, Alito, Gorsuch, Kavanaugh, Barrett): a law requiring publishers of sexually explicit content to verify users' ages "only incidentally burden[s]" adults' protected speech, so **intermediate scrutiny** applies, and Texas HB 1181 survives it. (Kagan, Sotomayor, Jackson dissented.)
- Practical meaning: (1) the ⅓‑threshold AV model is constitutional on its face; (2) district‑court injunctions in other states (Tennessee, Indiana) were lifted; (3) states are expanding scope (Utah's VPN provision; Indiana's VPN theory in its Aylo suit); (4) remaining litigation is about *details* (retention rules, VPN geolocation, Section 230 carve‑outs), not whether AV can be required.
- Sources: Faegre Drinker summary; Sidley Data Matters; SCOTUSblog; Hogan Lovells.

### 2.2 Aylo / Pornhub geo‑blocking (as of Aug–Sept 2026 reporting)

Blocked (25): Alabama, Arizona, Arkansas, Florida, Georgia, Idaho, Indiana, Iowa, Kansas, Kentucky, Mississippi, Missouri, Montana, Nebraska, North Carolina, North Dakota, Oklahoma, South Carolina, South Dakota, Tennessee, Texas, Utah, Virginia, West Virginia, Wyoming. Not blocked: **Louisiana** (verifies via LA Wallet) and **Ohio** (Section 230 interpretation). Internationally, Aylo blocked **France** (June 2025, over Arcom rules — **UNCONFIRMED here**) and **Australia** (from March 9, 2026). Counts vary across outlets (23–25) depending on date.

Why this matters for Carson: Aylo's choice shows the two realistic strategies — verify everyone, or geo‑block. A 120‑subscriber creator site cannot absorb the audience loss of blocking ~25 states (rough estimate: those states hold roughly 40–45% of the US population — **estimate, UNCONFIRMED**), so verification is the default path.

---

## 3. Non‑US regimes (brief)

| Jurisdiction | Instrument | Status / key dates | What it requires | Who it reaches | Penalties / enforcement | Notes for a small US site |
|---|---|---|---|---|---|---|
| **United Kingdom** | Online Safety Act 2023, Part 5 (own content) and Part 3 (UGC); Ofcom guidance on "highly effective age assurance" (HEAA), final Jan 2025 | Duty in force **July 25, 2025** | HEAA that is "technically accurate, robust, reliable and fair." Ofcom's non‑exhaustive HEAA list: open banking, photo‑ID matching, facial age estimation, mobile‑network operator checks, **credit card checks** (UK credit cards require 18+), digital identity wallets, email‑based age estimation. **Not acceptable:** self‑declaration, **debit cards** or any payment method a minor can hold. | Any service with "links to the UK" (UK users), regardless of size or location | Up to £18M or 10% of global turnover; access restriction orders. Fines to date on adult operators: Kick Online Entertainment £800k (Feb 12, 2026); 8579 LLC £1.35M + £50k (Feb 23, 2026); Youngtek Solutions £600k (May 27, 2026); MintStars £7,000 (small creator platform); OnlyFans (Fenix) £1.05M (Mar 2025, for mis‑reporting AV accuracy) | Ofcom has shown it will fine **small** operators. If UK fans are accepted, use a vendor whose methods Ofcom recognises (facial estimation, email estimation, ID) — or geo‑block the UK. |
| **European Union** | Digital Services Act Art. 28 (minors) + Commission guidelines (July 2025); **EU age‑verification blueprint** (white‑label app) released **July 14, 2025** | Pilots in **Denmark, France, Greece, Italy, Spain**; "full rollout planned for 2026"; shares specs with the EU Digital Identity Wallet (expected end‑2026) | App proves "over 18" to a site with no other personal data | DSA applies to services offered in the EU; the AV app is a tool, not (yet) a standalone mandate on small non‑EU sites (**attorney to confirm DSA small‑enterprise exemptions**) | DSA fines up to 6% of turnover for VLOPs; national regulators for others | Member‑state laws (France, Germany's JMStV/KJM, **Italy AGCOM from Nov 2025 — UNCONFIRMED**) are the binding ones today. |
| **France** | SREN law (2024); **Arcom référentiel** published **Oct 11, 2024**; in force **Jan 11, 2025** | Card‑based checks allowed only during a transition **Jan 11 – Apr 11, 2025**; **cards no longer acceptable** after | "Double anonymity": third‑party verifier learns identity but not the site; site learns only over/under 18 | Sites accessible in France (Arcom first targeted EU‑established sites Aug 1, 2025; in **July 2026 opened proceedings against 31 sites**) | Up to €150,000 or 2% of worldwide turnover; ISP/DNS blocking within 48 hours | Yoti's Digital ID has been assessed against Arcom's double‑anonymity requirements; AgeGO markets to France. |
| **Australia** | Online Safety Act 2021 — Phase 2 industry codes registered by eSafety (Sept 2025) | **In force March 9, 2026** | "Appropriate age assurance measures" (age verification via documents, age estimation via biometrics, age inference); privacy‑proportionality duty | Services accessible to Australians, including overseas sites | Civil penalties "in the millions" (reported up to ~A$49.5M) | Aylo blocked Australia on day one. For a US creator site, geo‑block or verify; eSafety has not (in sources found) fined a small foreign creator site. |
| **Canada** | **Bill S‑209**, Protecting Young Persons from Exposure to Pornography Act (Sen. Miville‑Dechêne), 45th Parliament | Introduced May 28, 2025; **passed Senate April 15, 2026**; at **second reading in the House of Commons** (as of Sept 2026). **Not law.** | Offence to make pornographic material available to minors online; a designated enforcement authority may seek Federal Court orders directing ISPs to **block** non‑compliant sites | Any organization making porn available in Canada | Fines (amounts **UNCONFIRMED**) + site blocking | Watch; earlier versions (S‑210) died at prorogation. |
| **Germany** (not requested, but relevant to EU fans) | JMStV; KJM approves AV systems | Long‑standing | KJM‑approved AV before access to porn | Sites targeting Germany | Media authority enforcement, blocking | Onfido and Trulioo hold KJM approvals (useful signal for vendor choice). |

---

## 4. Practical options for a small single‑creator site

### 4.1 The three options

| Option | How it works | Pros | Cons | Fit for this site |
|---|---|---|---|---|
| **(a) Verify everyone at signup** (before any explicit content, including free previews) | Vendor check (ID doc, or face age estimation, or email estimation) is the first step after email verification; site stores only a pass/fail + vendor reference, never the ID image | Cleanest compliance story in every state; simple rule for engineering ("nothing explicit until `age_verified = true`"); matches PLAN.md non‑negotiable #4 | Friction before the fan has committed money; cost per check on non‑converting signups | **Recommended** if the public landing page shows anything explicit. Mitigate friction with face/email estimation first, ID fallback. |
| **(b) Verify at first purchase** | Public pages are SFW; explicit previews and all paid content require AV; AV happens in the same flow as the first checkout | Fewer wasted checks; only paying fans are verified | Only works if **≥⅓ test is computed over the whole site** and the SFW public portion contains *no* harmful‑to‑minors material at all; any explicit teaser on a public page breaks the model | Workable if the marketing surface is strictly SFW. Attorney should confirm how each state counts "material" (by item, by page, by bytes). |
| **(c) Geo‑block non‑complying states** | Deny access from IPs in the 27 states (and UK/AU/FR if not verifying) | Zero AV cost in those states | Loses a large share of the US audience; IP geolocation is imperfect and VPNs defeat it; Indiana's AG has argued (Aylo suit, Dec 2025) that sites must also block VPN users; Utah's VPN provision (enjoined) shows where this is heading; still need a gate for the remaining states' fans travelling | **Not viable** as the primary strategy at 120 subscribers. Useful as a *supplement*: geo‑block jurisdictions whose methods you cannot satisfy (e.g., France's double anonymity, Australia) rather than the whole US. |

### 4.2 Does a paid card subscription count as "transactional data" verification?

Short answer: it is the weakest defensible reading anywhere, and expressly rejected in some places.

| Jurisdiction | Statutory language on transactional data (as reported) | Does a bare card charge satisfy it? |
|---|---|---|
| Texas HB 1181, Louisiana Act 440, Mississippi SB 2346, Virginia SB 1515, Montana SB 544, Ohio §1349.10, West Virginia HB 4412, Iowa HF 864 | Permit a "commercially reasonable method that relies on public or private transactional data to verify the age of an individual." Louisiana's legislative framing cites mortgage, education and employment records. | **Not established.** The statutes contemplate a *method* (e.g., a data‑broker/credit‑header check) that *relies on* transactional data, not the mere fact of a successful card payment. No AG opinion or court decision found treats a card charge alone as compliant. Debit and prepaid cards are issued to minors in the US. **UNCONFIRMED whether any state has ever accepted card‑only.** |
| Missouri 15 CSR 60‑18 / §407.3405 | Gov ID, digital ID wallet, or third‑party authentication service | Transactional data **not listed** in excerpts → card charge almost certainly insufficient. |
| Florida HB 3 | "Reasonable method" + mandatory **anonymous** option | A card charge is not anonymous and not a recognised AV method → insufficient. |
| Utah, Arkansas, Idaho, Kentucky, Nebraska, Alabama, Oklahoma, Arizona, Wyoming, SD, ND, SC, GA, TN, NC, KS, IN | "Reasonable age verification" / "commercially available" tools (wording varies) | Open‑textured; attorney judgement. Nothing found endorses card‑only. |
| UK (Ofcom HEAA) | **Credit card** checks acceptable (UK credit cards require 18+); **debit cards and any payment method a minor can hold are not** "highly effective" | A subscription paid by *credit* card passes; by *debit* card fails. The site cannot easily tell which through a hosted checkout → cannot rely on it. |
| France (Arcom) | Card checks banned after April 11, 2025 | No. |
| Australia (eSafety codes) | Lists age verification, estimation, inference; news reports list "credit card checks" among options (**UNCONFIRMED in the code text**) | Unclear; treat as no. |

Engineering consequence: build the age gate as its own step with a dedicated vendor; the `PaymentProcessor` adapter should never be the source of `age_verified`.

### 4.3 Cost reality at this scale

Assume ~300–600 verification attempts per year (new signups + re‑verification on failed estimations). At $0.80–$1.50 per check that is **$250–$900/year in usage**; monthly minimums dominate: Veriff self‑serve $49/mo, Sumsub $149/mo, Persona Essential $250/mo (12‑month term), PrivateAV $30/mo (1,000 checks). Quote‑only vendors (Yoti, Jumio, Onfido, Incode, Trulioo, AU10TIX) typically expect enterprise volumes; expect a floor that is high relative to this site's revenue (~$21,600/yr at 120 × $15).

### 4.4 2257 is a different obligation

18 U.S.C. §2257 requires **producers** (primary: whoever films; secondary: whoever publishes/reissues for commercial distribution) to keep records of each **performer's** legal name, date of birth, aliases, a copy of government photo ID, a copy of the depiction, production date and URL, with a compliance statement on the site. Penalties are criminal (up to 5 years first offence; 10 subsequent). It says nothing about **viewers**. For this site: the creator is the only performer; the 2257 vault in PLAN.md Phase 5 is for her ID, and the fan AV vendor must never be mixed into it. Who serves as records custodian (Carson, the creator, or the attorney) is an open question in PLAN.md.

---

## 5. Vendor comparison table

Columns: **Adult OK** = explicitly serves adult/18+ platforms (with evidence). **Est.** = offers face/email age *estimation* without an ID document. **Reusable** = "verify once, reuse" token/wallet. **Certs** = ACCS (UK Age Check Certification Scheme; ACCS 1:2025 incorporates ISO/IEC 27566‑1; ACCS 4:2020 incorporates PAS 1296:2018), KJM (Germany), Ofcom‑recognised method. Pricing in the vendor's quoted currency.

| Vendor | Adult OK? (evidence) | Est.? | Reusable? | Pricing / minimum | Data retention / "no ID images" controls | Certifications | Verdict for this site |
|---|---|---|---|---|---|---|---|
| **Persona** | **Yes.** Customer page "Adult content platform" and Playboy case study (Persona verifies *creators* on Playboy's creator platform to "ensure a safe 18+ environment"); age‑assurance page lists 13/16/18/21+ gates and names adult entertainment as a legally‑mandated AV industry. | Yes per age‑assurance page (**method detail UNCONFIRMED**) | Persona markets reusable/verified‑identity features (**UNCONFIRMED**) | **Essential $250/mo on a 12‑month minimum**, billed per successful verification; Growth/Enterprise quote‑only; Startup Program offers free verifications (eligibility **UNCONFIRMED** for adult) | Configurable retention/redaction (**UNCONFIRMED**). Feb 2026: researchers found an exposed Persona *test* frontend via Discord's AV flow showing extensive checks and code referencing retention "up to three years"; Persona said the environment was isolated and no personal data exposed. | ISO 27001, SOC 2 Type 2, ISO 27566‑1, FedRAMP (per Persona) | Adult‑friendly and credible, but $3,000/yr floor is heavy for 120 subscribers. Fine if the Startup Program applies. |
| **Veriff** | **Likely.** "Veriff for Communities" targets "platforms that connect creators and earners with members and audiences"; a Veriff blog features **Unlockt** (an adult creator paywall) as a customer (**UNCONFIRMED that the post calls it adult**). No explicit "adult" page found → **get written confirmation**. | **Yes** (selfie‑based age estimation; thresholds 13–25) | **UNCONFIRMED** | **Self‑serve: Essential $0.80/verification + $49/mo min; Plus $1.39 + $99; Premium $1.89 + $209**; 15‑day trial with 50 sessions; enterprise for 1,000+/mo | Default retention is short; "extended data retention up to 2 years" is a paid add‑on (+$0.30) — implies you can run with minimal retention (**exact default UNCONFIRMED**) | **UNCONFIRMED** (no ACCS entry found) | Cheapest mainstream self‑serve option with estimation. Shortlist, conditional on adult approval in writing. |
| **Yoti** | **Yes, by reputation.** Digital ID assessed against **Arcom's double‑anonymity** rules for adult platforms; widely deployed on UK adult sites post‑OSA (**named adult client UNCONFIRMED**) | **Yes** — facial age estimation, ACCS 1:2020 Level 2 certified (model Aug24, valid to **Oct 21, 2026**); ACCS‑reported MAE 1.05 yrs at age 18 | **Yes** — Yoti Digital ID app: create once, share "over 18" via QR/SDK | **Quote‑only**; third‑party estimates $1.50–$3.00/check; UK G‑Cloud list price from £1.80 for IDV; Shopify app exists | Yoti states images are deleted immediately after estimation (**UNCONFIRMED here**) | ACCS (estimation), Arcom‑assessed, Ofcom‑recognised methods, ISO 27001 | Gold‑standard privacy/certification; pricing and sales motion are enterprise‑oriented. Premium alternative. |
| **Jumio** | **UNCONFIRMED.** Patreon uses Jumio (Patreon allows adult‑adjacent content); no adult use‑case page or policy found either way | ID + selfie + liveness; standalone estimation **UNCONFIRMED** | **UNCONFIRMED** | Quote‑only, enterprise | Configurable (**UNCONFIRMED**) | **UNCONFIRMED** | Not a fit at this scale. |
| **Onfido (Entrust)** | **UNCONFIRMED** (use‑case page cites social, gaming retailers) | **Yes** (biometric age estimation KJM‑approved in Germany) | **UNCONFIRMED** | Quote‑only | **UNCONFIRMED** | **KJM approval** | Enterprise; skip unless German market matters. |
| **Sumsub** | **Yes.** Its AV page lists "websites with adult content" among users | **Yes** (facial age estimation without documents) | **Yes** — "Sumsub ID" / Reusable KYC included in Basic | **Basic $1.35/verification, $149/mo minimum**; charged only on successful verifications | Configurable retention (**UNCONFIRMED**) | **UNCONFIRMED** | Solid mid‑tier option with reusable ID; $1,788/yr floor. |
| **Stripe Identity** | **No.** Stripe Identity terms restrict use "for any purpose related to the adult entertainment or pornography industry"; Stripe Payments also prohibits adult content outright. | n/a | n/a | n/a | n/a | n/a | **Excluded.** |
| **AgeChecked** (UK) | **Yes, historically** (built for the UK adult‑site AV market since the 2017 Digital Economy Act era — **current adult page UNCONFIRMED**) | **UNCONFIRMED** (primarily data/ID/card checks; some estimation partners) | Reusable AgeChecked account (**UNCONFIRMED**) | **£0.28–£0.35/check on a 12‑month plan (min 100 checks); PAYG £0.75/check, min 100, no contract**; Shopify app | — | **PAS 1296 certification claimed — UNCONFIRMED** (ACCS registry unreachable) | Cheap, UK‑centric; limited US ID coverage (**UNCONFIRMED**). Backup option for UK fans. |
| **VerifyMy** (KYC AVC UK Ltd) | **Yes.** Dedicated "Adult entertainment" industry page; blogs on Ofcom pornography guidance | **Yes** — **email‑based age estimation** (pioneered by VerifyMy) and facial age estimation; plus ID/credit card/mobile | Returning‑user recognition (**UNCONFIRMED mechanism**) | Pricing "varies by platform, integration and monthly volume"; an eBay app priced at 45p; otherwise quote (**small‑site minimum UNCONFIRMED**) | Privacy‑first positioning; email estimation stores no images | **ACCS 1:2025 / ISO 27566‑1 certified; ACCS 2:2021 (data protection); ACCS 4:2020 incorporating PAS 1296:2018**; Ofcom‑recognised methods | Best certification set among adult‑explicit vendors; email estimation is the lowest‑friction HEAA method. Shortlist. |
| **k‑ID** | **UNCONFIRMED / unlikely** — product is built for games and youth platforms; publishes legal analysis of Paxton but no adult offering found | Yes (via partners) (**UNCONFIRMED**) | Yes (k‑ID account) (**UNCONFIRMED**) | **UNCONFIRMED** | — | — | Not a fit. |
| **Ondato** | **Yes.** "Adult content platforms" industry page; **OnlyFans** reported as a customer for creator/subscriber age estimation | **Yes** — biometric age estimation with fallback to ID + liveness | **UNCONFIRMED** | **€0.30 down to €0.01 per verification** by volume; minimum/monthly fee **UNCONFIRMED** | Claims Ofcom/OSA, CAADCA, COPPA alignment; retention controls **UNCONFIRMED** | **UNCONFIRMED** ACCS | Adult‑proven (OnlyFans) and cheap per check; confirm minimums. Strong alternate. |
| **Incode** | **Yes.** "Adult entertainment" industry page: "verifies users and creators are real adults, privacy‑first, with data redacted and automatically deleted" | **Yes** — facial age estimation (NIST top‑rated per Incode) + document + database | **UNCONFIRMED** | Quote‑only | Auto‑deletion/redaction claimed on adult page | **ACCS certified** (age verification solution) | Good fit on paper; enterprise sales. Worth one quote request. |
| **AU10TIX** | **UNCONFIRMED** — markets to adult/gambling compliance generally; no adult page found | **Yes** — selfie age estimation (~2 s) | **UNCONFIRMED** | Reported **from $500/month** (third‑party listing) | "Privacy‑first" positioning | **UNCONFIRMED** | Too expensive/enterprise. |
| **Trulioo** | **UNCONFIRMED** — target industries are fintech, marketplaces, gaming | **Yes** — facial estimation + email/mobile age checks | **UNCONFIRMED** | Quote‑only | — | **KJM approval** (2021) | Enterprise; skip. |
| **Privately SA** (Switzerland) | **UNCONFIRMED** for adult sites specifically (white‑labels to "many providers") | **Yes** — on‑device / in‑browser facial (and voice) age estimation; no cloud processing of faces, no ID | n/a (no account) | **UNCONFIRMED** | Strongest data‑minimisation design: nothing leaves the device | **ACCS 1:2025 / ISO 27566‑1 Level 3**, valid to **April 14, 2029** | Attractive as the *engine* behind another vendor; unlikely to contract directly at this size. |
| **AgeGO** (ExoGroup / ExoClick) | **Yes** — built for adult dating/adult traffic (UK and France) | Yes (photo/face) plus card/ID options (**method list UNCONFIRMED**) | Yes — user‑held AgeGO pass (**UNCONFIRMED**) | **Free to end users**; self‑service for sites; business pricing "free to enterprise" (**UNCONFIRMED**) | A French outlet (next.ink) reported AgeGO **logging which content users accessed** — privacy concern (**UNCONFIRMED details**) | **UNCONFIRMED** | Adult‑native and cheap, but ad‑network ownership and the logging report are red flags for a privacy‑sensitive brand. |
| **PrivateAV** (Free Speech Coalition) | **Yes** — built by the adult trade association for its members | **Yes** — AI age estimation + full document verification with biometric match | **UNCONFIRMED** | **From $30/month for up to 1,000 verifications**; 100 free sandbox tests; higher tiers available; **requires FSC membership** (fee **UNCONFIRMED**) | "No personal data ever stored, logged, or written to disk; all inputs erased the moment verification completes" | **UNCONFIRMED** (underlying technology partner not identified in sources) | Best price/fit for a tiny adult site. Shortlist, pending: who built it, certification, US‑state acceptance. |

---

## 6. Recommended vendor shortlist (2–3) and reasoning

1. **PrivateAV (via Free Speech Coalition membership)** — purpose‑built for exactly this operator profile, $30/month covers more than a year of this site's volume, offers both estimation and ID fallback, and promises zero data retention. Open items before committing: identify the underlying technology provider and any ACCS/ISO 27566 certification (**UNCONFIRMED**), FSC membership cost, whether it supports UK/AU HEAA expectations, and SLA/support for a solo operator. FSC membership also buys the 185‑page *Compliance with U.S. Age Verification Laws* toolkit, which the attorney will want.

2. **VerifyMy** — the only adult‑explicit vendor found with the full UK certification stack (ACCS 1:2025/ISO 27566‑1, ACCS 2 privacy, ACCS 4/PAS 1296). Its **email‑based age estimation** is the lowest‑friction method Ofcom recognises as highly effective, with facial estimation and ID as escalation. Pricing is quote‑based; ask for a small‑volume plan. Best choice if UK fans matter.

3. **Veriff (self‑serve Essential)** — $49/month minimum + $0.80/verification, selfie age estimation, short default retention, 15‑day trial, and a "Communities" package aimed at creator‑fan platforms. Condition: **written confirmation that a single‑creator adult subscription site is an accepted use**. If Veriff declines, substitute **Ondato** (OnlyFans customer; €0.01–€0.30/check) or **Sumsub** ($149/month; reusable Sumsub ID).

Premium alternative: **Yoti** (reusable Digital ID, Arcom‑assessed, ACCS‑certified estimation) if its minimum commitment turns out to be tolerable.

Do not use: Stripe Identity (prohibited), k‑ID (wrong market), AgeGO (ownership/logging concerns), Jumio/Onfido/Trulioo/AU10TIX/Incode (enterprise pricing without a clear advantage for this scale — Incode is the only one worth a quote).

### 6.1 "Do we need a vendor at all vs. relying on the payment processor?" — honest answer

- **Yes, a vendor is needed** if fans in any of the 27 states, the UK, Australia or France are accepted and the site shows ≥⅓ explicit content. Reasons: (i) no state has blessed a bare card charge as "transactional data" verification and several (Missouri, Florida) list methods that exclude it; (ii) US debit/prepaid cards are available to minors; (iii) Ofcom rejects debit cards and Arcom rejects all cards; (iv) a hosted checkout (CCBill/Segpay/Vendo) does not even tell the site whether a credit or debit card was used; (v) the age gate must precede *any* explicit content, which happens before checkout.
- What the processor **does** give: a weak corroborating signal and, in some states' open‑textured "reasonable method" language, part of a layered argument — never the whole defence. Some high‑risk processors offer or bundle AV add‑ons (**UNCONFIRMED** for CCBill/Segpay/Vendo; ask them during the processor application).
- The cheapest compliant architecture: SFW public pages → signup → **AV vendor check (estimation first, ID fallback)** → explicit previews → processor hosted checkout. Store only `{vendor, reference_id, result, timestamp, method}`; never the image or document.

---

## 7. Questions for the attorney

Scope and thresholds
1. For a single‑creator subscription site whose content is nearly all explicit, is there any reading under which the ⅓ threshold is *not* met (e.g., if the public marketing surface is SFW)? How do the states count "material" — per item, per page, per byte?
2. Does Ohio's "interactive computer service" carve‑out (R.C. §1349.10) apply to a site that publishes only the owner's own content? (Aylo relies on it; we probably cannot.)
3. Wyoming has no threshold and Kansas reportedly uses 25%: does anything on the site (even one explicit preview) trigger those laws?
4. Which of the 27 laws apply based on the *fan's* location vs. the *site's* location? Is there any safe harbour for a very small operator (revenue or user‑count exemptions)?

Methods and the card question
5. In the states listing "a commercially reasonable method that relies on public or private transactional data," does a successful card subscription through CCBill/Segpay/Vendo count, in your view? Has any AG or court said so? (Our research found none.)
6. Florida requires an "anonymous" AV option — does a face‑estimation flow satisfy it? Does Missouri's rule (gov ID / digital wallet / third‑party service) accept face estimation at all?
7. Is face age estimation alone acceptable in every state, or do some require a document? Should we set an estimation "buffer" (e.g., estimate ≥ 23 passes; 18–23 escalates to ID)?
8. Tennessee: is there really a re‑verification cadence (reported 60 minutes) and a records‑retention duty? If so, how do we reconcile that with the other states' "do not retain" rules?

Data and liability
9. Several states (Texas, Nebraska, Kentucky, Missouri, West Virginia) impose separate penalties for *retaining* identifying information, and Nebraska lets users sue the *vendor* too. What exactly may we store (vendor reference ID, pass/fail, timestamp, method)? Does keeping a vendor "reusable token" count as retention?
10. Which states give parents a private right of action (Utah, Montana, Kentucky, Wyoming, Arizona, Idaho with $10,000 minimum damages, Nebraska, Kansas, Louisiana, Virginia, Mississippi, Arkansas, Alabama, Florida…)? What does our exposure look like if one minor slips through?
11. Alabama HB 164's 10% gross‑receipts tax: does it reach an out‑of‑state producer with Alabama subscribers? Do we need Alabama's statutory health‑warning text? Did the Fifth Circuit's ruling on Texas's labels affect this?
12. Insurance: is there a cyber/media liability product that covers AV‑law claims for a site this size?

Geography and VPNs
13. Should we geo‑block any jurisdiction entirely (France for double‑anonymity, Australia, the UK) rather than verify? If we geo‑block, what geolocation accuracy is "reasonable" given Indiana's VPN theory and the (enjoined) Utah VPN provision?
14. UK: given Ofcom fined a £7,000‑scale creator platform (MintStars) and several small operators, do we accept UK fans at all? If yes, must the method be on Ofcom's HEAA list?
15. Canada S‑209: if it passes, does our architecture need to change?

Vendor contracting
16. Please review the chosen vendor's DPA/terms for: retention defaults, sub‑processors, whether they will indemnify for AV‑law claims, and whether their adult‑industry acceptance is in the contract (not just an email).
17. FSC membership: any conflict or concern with relying on PrivateAV (a trade‑association product) versus an independently certified vendor?

2257 and adjacent
18. Who is the §2257 custodian of records (Carson, the creator, or you)? Confirm the compliance‑statement wording and that a single‑performer site is a "secondary producer" too.
19. Are there state "deepfake"/"intimate image" or biometric‑privacy laws (Illinois BIPA, Texas CUBI, Washington) that affect running face estimation on fans in those states — and does the vendor's on‑device/immediate‑deletion design mitigate them?

---

## 8. Sources

Method note: every URL below surfaced in search results and its content was read through search‑engine excerpts; direct fetches were blocked by the sandbox's network policy. URLs marked † were blocked when a full read was attempted and should be re‑read before citing to a court or regulator.

US state laws, trackers and analysis
- https://www.recordinglaw.com/us-laws/age-verification-laws/ † (27‑state table)
- https://www.recordinglaw.com/news/iowa-age-verification-law-hf-864/
- https://www.spankchain.com/spankbyte-collection/age-verification-2025-recap †
- https://www.pcrisk.com/blog/tips/14112-online-porn-age-verification-laws-by-state †
- https://ondato.com/blog/adult-content-age-verification-laws/ †
- https://ondato.com/blog/mississippi-age-verification/
- https://ondato.com/blog/wyoming-age-verification/
- https://ondato.com/blog/south-dakota-age-verification-law/
- https://ondato.com/blog/ohio-age-verification-law/
- https://ondato.com/blog/arizona-age-verification-bill/
- https://idscan.net/blog/states-are-placing-age-restrictions-on-adult-content-is-your-state-one-of-them/ †
- https://kindbridge.com/online-pornography-age-verification-laws-by-state-map/ †
- https://automatehorizon.com/age-verification-laws-for-adult-websites/ †
- https://stateofsurveillance.org/guides/basic/age-verification-laws-by-state/ †
- https://legalclarity.org/age-verification-laws-by-state-what-they-require/ †
- https://www.superlawyers.com/resources/internet/age-verification-laws-accessing-adult-content/ †
- https://www.congress.gov/crs_external_products/LSB/HTML/LSB11020.web.html † (CRS, "Online Age Verification (Part I)")
- https://www.newamerica.org/insights/age-verification-the-complicated-effort-to-protect-youth-online/pursuing-kids-safety-through-online-age-verification-legislation/
- https://www.tomsguide.com/computing/online-security/online-age-verification-timeline
- https://action.freespeechcoalition.com/age-verification-bills † (FSC bill tracker)
- https://www.freespeechcoalition.com/toolkit † ; https://www.freespeechcoalition.com/blog/fsc-releases-updated-age-verification-toolkit
- https://breached.company/half-of-us-states-now-enforce-age-verification-laws-the-2026-mass-rollout-of-digital-id-requirements/
- https://www.tryarbiter.com/blog/state-age-verification-laws-2025
- https://xident.io/blog/age-verification-private-right-of-action-bipa-class-action-2026/
- https://onlinesafety.orrick.com/nebraska/ ; https://onlinesafety.orrick.com/wyoming/
- https://www.kjzz.org/politics/2025-09-22/arizona-law-requiring-age-verification-to-access-adult-websites-takes-effect-sept-26
- https://www.azleg.gov/legtext/57leg/1R/summary/S.2112JUDE.DOCX.htm †
- https://cybernews.com/how-to-use-vpn/missouris-online-age-verification-rule-takes-effect-prompting-spike-in-vpn-searches/
- https://ago.mo.gov/attorney-general-hanaway-moves-to-protect-children-from-online-pornographic-sites-with-age-verification-rule/
- https://www.biometricupdate.com/202607/missouris-new-age-assurance-law-specifies-data-storage-restrictions
- https://www.zyphe.com/resources/news/missouri-age-verification-law-407-3405-august-2026
- https://www.kfyrtv.com/2025/06/04/age-verification-pornography-websites-law-take-effect/ (North Dakota HB 1561)
- https://codes.ohio.gov/ohio-revised-code/section-1349.10 ; https://www.lsc.ohio.gov/assets/legislation/136/hb96/en0/files/hb96-ago-bill-analysis-as-enacted-136th-general-assembly.pdf
- https://www.journal-news.com/local/porn-sites-not-asking-for-age-verification-despite-new-ohio-law/DUPN5BD6RNDYJPYNQOFCPYP4CM ; https://wysu.org/ohio-news/2026-03-04/ohio-lawmakers-may-pass-redo-of-age-verification-law-for-porn-sites
- https://www.wvlegislature.gov/Bill_Text_HTML/2026_SESSIONS/RS/bills/hb4412%20sub1%20enr.pdf ; https://loveingroup.com/us-age-verification-laws-west-virginia-deadline/
- https://www.kcrg.com/2026/06/04/gov-reynolds-signs-bill-that-requires-age-verification-porn-websites/ (Iowa HF 864)
- https://apps.legislature.ky.gov/law/statutes/statute.aspx?id=54996 (Kentucky)
- https://www.clym.io/regulations/alabama-house-bill-164 † ; https://reclaimthenet.org/bill/alabama-hb-164 ; https://www.alreporter.com/2024/09/27/alabama-begins-to-see-impacts-of-porn-id-law-implementation ; https://www.wvua23.com/news/alabama/alabama-s-hb-164-requires-age-verification-for-adult-content-viewing/article_ef7b5e45-3b0f-5fef-ba36-c2ef24c463f0.html
- https://texasattorneygeneral.gov/news/releases/attorney-general-ken-paxton-sues-major-pornography-distributor-violating-texas-age-verification-laws ; https://www.fox26houston.com/news/ken-paxton-sues-pornhub-age-verification ; https://nbcdfw.com/news/local/texas-news/a-timeline-of-the-legal-battle-over-texas-age-verification-law/3706903
- https://cbsnews.com/miami/news/pornhub-to-be-blocked-in-florida-on-january-1-2025 ; https://www.yahoo.com/news/pornhub-other-adult-sites-pull-154545944.html
- https://fortune.com/2025/01/07/tennessee-porn-site-age-verification-law-blocked-judge-dozen-states-enforce
- Utah SB 73 / VPN: https://www.eff.org/deeplinks/2026/04/utahs-new-law-regulating-vpns-goes-effect-next-week ; https://www.kpcw.org/state-regional/2026-09-25/federal-judge-blocks-utahs-vpn-update-to-its-online-porn-age-verification-law ; https://www.deseret.com/politics/2026/05/13/pornhub-owner-aylo-sues-utah-over-age-verification-law-that-applies-to-virtual-private-networks-or-vpns/ ; https://fox13now.com/news/politics/utah-wont-enforce-vpn-law-pending-judges-ruling-in-pornhub-lawsuit
- Indiana VPN suit: https://reclaimthenet.org/indiana-sues-aylo-for-not-blocking-vpn-users ; https://reason.com/2025/12/17/porn-sites-must-block-vpns-to-comply-with-indianas-age-verification-law-state-suggests-in-new-lawsuit/printer/
- Pending states: https://shuftipro.com/news/michigan-lawmakers-push-age-checks-for-online-porn/ ; https://nysenate.gov/legislation/bills/2025/A3946 ; https://digital-release.newsnationnow.com/?p=2868928 (California) ; https://law.ungovr.org/age/us/il

Free Speech Coalition v. Paxton
- https://www.faegredrinker.com/en/insights/publications/2025/6/supreme-court-decides-free-speech-coalition-inc-v-paxton †
- https://datamatters.sidley.com/2025/07/08/texas-age-verification-law-upheld-u-s-supreme-court-balances-free-speech-and-child-protection-in-the-digital-age/
- https://www.scotusblog.com/2025/06/court-allows-texas-law-on-age-verification-for-pornography-sites/
- https://hlc.com/en/publications/supreme-court-sets-new-standards-for-restricting-online-adult-sexual-content-in-free-speech
- https://www.k-id.com/post/free-speech-coalition-v-paxton-what-it-means-for-age-verification-in-the-united-states
- https://www.troutman.com/insights/justices-age-verification-ruling-may-lead-to-more-state-laws/

Aylo / Pornhub geo‑blocking
- https://factually.co/fact-checks/society/which-us-states-countries-blocked-pornhub-and-similar-platforms-dd0a3c †
- https://cybernews.com/internet-censorship/how-to-access-pornhub/ †
- https://www.yahoo.com/news/us/articles/sorry-no-pornhub-access-25-211136509.html †
- https://mobilestalk.net/pornhub-is-blocked-in-these-states-as-of-april-2026/ ; https://www.documentarytube.com/blog/how-to-watch-pornhub-from-any-state-in-2026/
- https://thenightly.com.au/society/technology/top-porn-sites-like-pornhub-redtube-cut-australian-access-over-age-checking-c-21880953 ; https://www.thepinknews.com/2026/03/09/heres-why-pornhub-is-blocked-for-users-in-australia-right-now/

UK
- https://www.ofcom.org.uk/online-safety/protecting-children/ofcom-fines-porn-company-1.35-million-for-not-having-age-checks †
- https://www.ofcom.org.uk/online-safety/protecting-children/Ofcom-fines-porn-company-800k-for-failing-to-introduce-age-checks †
- https://ofcom.org.uk/online-safety/protecting-children/enforcement-programme-to-protect-children-from-encountering-pornographic-content-through-the-use-of-age-assurance †
- https://www.lexisnexis.com/en-gb/legal/news/ofcom-fines-porn-provider-600-000-for-osa-2023-breaches (Youngtek)
- https://www.scl.org/ofcom-fines-video-sharing-platform-mintstars-7000/ ; https://www.uktech.news/news/government-and-policy/onlyfans-owner-fined-1m-by-ofcom-in-age-verification-dispute-20250327
- https://lewissilkin.com/insights/2025/01/16/a-new-age-ofcom-publishes-final-version-of-age-assurance-guidance-102ju6k ; https://www.lewissilkin.com/insights/2023/12/08/debit-cards-not-accepted-ofcom-requires-uk-adult-site-to-upgrade-age-verificatio-102iu1q ; https://www.lewissilkin.com/insights/2026/07/16/ofcom-warns-that-tougher-action-is-needed-on-age-assurance-following-publication-102nc4m
- https://uklitigation.cooley.com/ofcoms-latest-guidance-on-age-assurance-under-the-online-safety-act/ ; https://www.osborneclarke.com/insights/uk-online-safety-act-ofcom-publishes-guidance-age-assurance-and-childrens-access
- https://inforrm.org/2026/03/11/ofcom-steps-up-online-safety-act-enforcement-with-two-further-age-assurance-fines-for-pornographic-platforms-alexandros-antoniou/
- https://www.rpclegal.com/snapshots/technology-digital/autumn-2026/online-safety-act-ofcom-fines-two-adult-sites-for-age-verification-failures/

EU / France / Australia / Canada / Germany
- https://digital-strategy.ec.europa.eu/en/news/commission-makes-available-age-verification-blueprint †
- https://cadeproject.org/updates/eu-commission-pushes-member-states-to-deploy-eu-age-verification-app-by-year-end/ ; https://www.amna.gr/en/article/918881/Greece-one-of-five-countries-to-try-out-first-age-verification-app--EU-says
- https://www.twobirds.com/en/insights/2025/france/double-verification-de-l-age-en-ligne-une-obligation-effective-depuis-le-11-janvier †
- https://techinformed.com/france-enforces-age-verification-law-adult-sites/ ; https://osborneclarke.com/node/25233 ; https://withpersona.com/blog/arcom-age-verification ; https://donneespersonnelles.fr/verification-age-en-ligne
- https://ia.acs.org.au/article/2025/australians-to-face-age-checks-on-porn-sites-from-march.html ; https://esafety.gov.au/industry/codes/faq-access-to-online-porn-and-other-adult-content † ; https://www.squirepattonboggs.com/media/qh5bakxz/phase-2-online-safety-codes.pdf ; https://verifymy.io/blog/australia-age-assurance-codes-2025
- https://www.parl.ca/legisinfo/en/bill/45-1/S-209 † ; https://openparliament.ca/bills/45-1/S-209/ ; https://en.wikipedia.org/wiki/Protecting_Young_Persons_from_Exposure_to_Pornography_Act †
- https://www.businesswire.com/news/home/20211122005036/en/Trulioo-Receives-Approval-from-German-Media-Authorities-to-Provide-Age-Verification-Services ; https://idtechwire.com/onfidos-biometric-solution-approved-age-verification-checks-germany-102703

18 U.S.C. §2257
- https://www.justice.gov/sites/default/files/criminal-ceos/legacy/2012/03/19/2257compliance.pdf
- https://ilt.eff.org/2257_Reporting_Requirements.html ; https://paymentcloudinc.com/blog/18-usc-2257/

Vendors
- Persona: https://withpersona.com/customers/adult-content-platform † ; https://withpersona.com/customers/playboy ; https://withpersona.com/use-case/compliance/age-assurance ; https://pricingsaas.com/companies/withpersona ; https://costbench.com/software/background-checks/persona-identity/ ; https://www.malwarebytes.com/blog/news/2026/02/age-verification-vendor-persona-left-frontend-exposed
- Veriff: https://veriff.com/product/age-validation ; https://www.veriff.com/industry/communities/veriff-for-community † ; https://veriff.com/blog/veriff-and-unlockt ; https://costbench.com/software/kyc-aml/veriff/ ; https://us.fitgap.com/products/006060/veriff
- Yoti: https://www.yoti.com/age-assurance/ † ; https://developers.yoti.com/age-verification/digital-id ; https://accscheme.com/registry/age-estimation/yoti-ltd/ † ; https://www.yoti.com/blog/age-check-certification-scheme-evaluation-for-yoti-facial-age-estimation ; https://realeyes.ai/blog/age-verification-companies-compared/ ; https://assets.applytosupply.digitalmarketplace.service.gov.uk/g-cloud-15/documents/702818/615462452489660-pricing-document-2026-01-28-0928.pdf
- Jumio: https://www.jumio.com/age-verification/ † ; https://support.patreon.com/hc/en-us/articles/8335062384141-Age-Verification-Frequently-Asked-Questions-FAQ-
- Onfido / Entrust: https://onfido.com/use-cases/age-verification † ; https://www.entrust.com/use-case/age-verification
- Sumsub: https://sumsub.com/age-verification/ † ; https://costbench.com/software/kyc-aml/sumsub/ ; https://guptadeepak.com/top-10-age-verification-solutions/
- Stripe Identity: https://stripe.com/legal/identity † ; https://stripe.com/en-gb-ca/legal/restricted-businesses ; https://support.stripe.com/questions/prohibited-and-restricted-businesses-list-faqs
- AgeChecked: https://agechecked.com/?p=2199 † (PAYG) ; https://agechecked.com/?p=2194 ; https://www.g2.com/products/agechecked/pricing ; https://apps.shopify.com/agechecked-1
- VerifyMy: https://verifymy.io/industries/adult-entertainment/ † ; https://verifymy.io/age-verification-and-estimation/pricing † ; https://verifymy.io/age-verification-and-estimation/email-address-age-estimation ; https://verifymy.io/blog/verifymy-iso-27566-certification/ ; https://accscheme.com/registry/age-assurance/kyc-avc-uk-ltd-verify-my-age/ † ; https://verifymy.io/blog/ofcom-releases-official-guidance-on-highly-effective-age-assurance-for-pornography-providers
- k‑ID: https://www.k-id.com/ † ; https://k-id.com/news-posts/australias-new-online-safety-industry-codes
- Ondato: https://ondato.com/industries/adult-content-platforms/ † ; https://ondato.com/age-verification-pricing/ † ; https://ondato.com/blog/ofcom-age-assurance/
- Incode: https://incode.com/industries/adult-entertainment/ ; https://www.incode.com/use-cases/age-assurance ; https://incode.com/press/incode-receives-accs-certification-for-its-age-verification-solution/
- AU10TIX: https://www.au10tix.com/uncategorized/elementor-47338/ ; https://www.au10tix.com/press-releases/au10tix-launches-free-assessment-tool-and-readiness-guide-to-help-organizations-navigate-child-safety-age-assurance-compliance/ ; https://us.fitgap.com/products/006198/au10tix
- Trulioo: https://mytechdecisions.com/latest-news/trulioo-receives-approval-from-german-media-authorities-to-provide-age-verification-services/ ; https://youverify.co/blog/best-age-verification-software-providers-2026
- Privately SA: https://accscheme.com/wp-content/uploads/Privately-SA-ACCS-1-2025-ISO-27566-Certificate-Of-Conformity-issued-15.04.2026.pdf ; https://www.biometricupdate.com/companies/privately ; https://www.startupticker.ch/en/news/ageai-to-simplify-in-store-age-checks
- AgeGO: https://www.globaldatinginsights.com/content-partners/exogroup/agego-is-the-go-to-solution-for-the-uks-age-verification-law/ ; https://nordvpn.com/en/blog/agego-age-verification/ ; https://www.tomsguide.com/computing/online-security/what-is-agego-and-is-it-safe-to-use † ; https://next.ink/198154/sites-porno-la-solution-agego-enregistre-les-contenus-auxquels-accedent-les-internautes/
- PrivateAV (FSC): https://www.freespeechcoalition.com/blog/fsc-launches-privateav †
- Comparative: https://didit.me/blog/top-age-verification-software-alternatives-2026/ † ; https://www.signzy.com/us/blog/best-age-verification-softwares ; https://sourceforge.net/software/age-verification/usa/
