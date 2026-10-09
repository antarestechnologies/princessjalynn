# Phase 0 — DRM Reality Check for the Video Stack

**Date:** 2026-10-05
**Scope:** Single-creator adult subscription site (Next.js). ~120 subscribers, ~20 peak concurrent viewers, ~200 GB (~60 h at 1080p) of VOD, ~2 TB/month egress.

> **Research caveat (read first).** The research sandbox's egress proxy blocked direct fetches of every vendor domain (mux.com, developers.cloudflare.com, bunny.net, api.video, vdocipher.com, gcore.com, aws.amazon.com, vimeo.com, gumlet.com, kinescope.com, ezdrm.com, pallycon.com, plus the secondary sources). Every quote and price below therefore comes from **search-engine snippets of those pages**, not from reading the page itself. Snippets are usually verbatim but can lag the live page. Every number marked "snippet" must be re-checked against the linked page before anything is signed. Where a number could not be found even in snippet form it says **could not verify**.

---

## 1. Summary

- **True DRM (Widevine / FairPlay / PlayReady) is available off-the-shelf from Mux (GA since Nov 2025, $100/mo + $0.003/license) and Bunny Stream (MediaCage Enterprise, $99/mo + $0.005/license).** Cloudflare Stream and api.video do **not** offer DRM — only signed, short-lived tokens. VdoCipher, Gumlet, Kinescope and Vimeo OTT offer DRM, but VdoCipher, Gumlet and Vimeo explicitly prohibit adult content. AWS can do DRM only via a third-party SPEKE key server (EZDRM/BuyDRM, ~$99–$300/mo extra) and a lot of engineering.
- **Adult-content permission narrows the field fast.** Bunny.net says in writing it accepts legal adult content. Cloudflare's Stream supplemental terms have no adult-content clause (community staff: legal content is fine). Mux's ToS language ("graphic, sexually explicit, or mature") reads as a prohibition — treat as **No** pending the policy agent's check. VdoCipher, Gumlet, Vimeo: explicit **No**.
- **Nobody in the affordable tier offers invisible forensic (per-viewer) watermarking.** What VdoCipher/Gumlet/Kinescope call "dynamic watermarking" is a *visible* overlay of the viewer's name/email. Real forensic A/B watermarking (NAGRA, Irdeto, Verimatrix, DoveRunner/PallyCon) starts around $500/month and is built for broadcasters. Not viable at 120 subscribers.
- **Estimated monthly cost at our scale:** Bunny ≈ $25 without DRM / ≈ $150 with DRM; Cloudflare Stream ≈ $90 (no DRM possible); Mux ≈ $70 without DRM / ≈ $190 with DRM (but adult likely prohibited); api.video ≈ $125 (no DRM); AWS DIY ≈ $200–$480 + engineering.
- **Bottom line for the creator:** DRM stops the easy stuff (right-click download, browser extensions, screen-recording on iPhone/Safari and most Android phones). It does not stop screen recording on a Windows/Mac Chrome browser, and nothing stops a phone camera pointed at a screen. The realistic goal is *traceability and friction*, not prevention.

---

## 2. Comparison table

Assumptions used for the $/mo column: 3,600 stored minutes (60 h); ~67,000 delivered minutes/month (2 TB at an average ABR mix of ~4 Mbps ≈ 30 MB/min); ~6,000 DRM licenses/month (≈4,500 playback sessions × some multi-key/short-session overhead). Prices are list prices from snippets; see Section 3 for the arithmetic.

| Vendor | True DRM (Widevine/FairPlay/PlayReady) | Signed tokens / short-lived URLs | Forensic (invisible) WM | Adult OK? | Est. $/mo at our scale | Doc links |
|---|---|---|---|---|---|---|
| **Mux** | **Yes — GA Nov 10, 2025.** Widevine + PlayReady + FairPlay. $100/mo access fee + $0.003/license (snippet). | Yes. RS256 JWT signed server-side with your private key; claims `sub` (playback ID), `aud` (`v` video, `t` thumb, `d` DRM license), `exp`. DRM needs a second JWT with `aud: d` passed to the player as `drm-token`. | No. No per-viewer watermark product found. | **Likely No.** ToS/moderation docs: content that is "graphic, sexually explicit, or mature" is prohibited (snippet; verify). | ≈ $70 (no DRM) / ≈ $190 (with DRM) | [DRM guide](https://docs.mux.com/guides/protect-videos-with-drm) · [DRM GA changelog](https://support-agent.mux.com/docs/changelog/drm-general-availability) · [DRM GA blog](https://www.mux.com/blog/protect-your-video-content-with-drm-now-ga) · [Secure playback](https://www.mux.com/docs/guides/secure-video-playback) · [Pricing](https://www.mux.com/docs/pricing) · [Terms](https://www.mux.com/terms) |
| **Cloudflare Stream** | **No.** Stream uses token-based access, not Widevine/FairPlay (community + third-party sources; no DRM page exists in Stream docs). | Yes. `requireSignedURLs` on the video; RS256 JWT signed with a Stream signing key you hold; default expiry 1 h, **max 24 h**; or call the `/token` endpoint. | No. Watermark API is a static image overlay burned in at upload (logo), not per-viewer. | **Yes (no clause against it).** Stream Supplemental Terms contain no adult-content provision; staff on community forum: legal content is OK. Must be on a paid Stream plan to serve video. | ≈ $87 (DRM not available) | [Securing your Stream](https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/) · [Pricing](https://developers.cloudflare.com/stream/pricing/) · [Token API](https://developers.cloudflare.com/api/node/resources/stream/subresources/token/methods/create) · [Community: Stream DRM](https://community.cloudflare.com/t/cloudflare-stream-drm/163718) · [Community: does Stream allow porn?](https://community.cloudflare.com/t/does-cloudflare-stream-allow-porn/192012) · [Service-specific terms](https://www.cloudflare.com/service-specific-terms-developer-platform/) |
| **Bunny Stream** | **Yes — MediaCage Enterprise DRM** (Widevine + FairPlay; PlayReady not mentioned). $99/mo base + $0.005/license up to 20k licenses/mo (then $0.004, $0.003) (snippet). Note: the free "MediaCage Basic" is AES encryption only, **not** real DRM. | Yes. Two layers: embed-view token auth (signs the iframe) and CDN token authentication — HMAC-SHA256 `token` + `expires` (UNIX ts) query params, optional IP lock / path token / country restriction. Token auth also protects the DRM license endpoint. | No. Watermark = your logo image overlay with position/size/opacity. | **Yes, in writing.** FAQ: accepts "providers of 'adult content', as long as the content is legal under the laws of Slovenia [and] each of the 50 States". | ≈ $25 (no DRM) / ≈ $150 (with DRM) | [MediaCage DRM](https://docs.bunny.net/stream/drm) · [Stream security](https://docs.bunny.net/stream/security) · [Security options](https://docs.bunny.net/stream/security-options) · [Widevine player](https://docs.bunny.net/stream/players/widevine) · [FairPlay player](https://docs.bunny.net/stream/players/fairplay) · [Token auth](https://docs.bunny.net/cdn/security/token-authentication/advanced) · [Pricing](https://docs.bunny.net/stream/pricing) · [Enterprise DRM page](https://bunny.net/stream/media-cage-enterprise-multi-drm-digital-rights-management/) · [AUP](https://bunny.net/acceptable-use/) · [FAQ](https://bunny.net/faq/) |
| **api.video** | **No.** Third-party comparisons state "api.video has no DRM"; no DRM page in docs. | Yes. Private videos with session tokens / private tokens. | No. | **Unconfirmed.** No adult clause found in snippets; ToS could not be read. | ≈ $125 (DRM not available) | [Private videos](https://docs.api.video/delivery/video-privacy-access-management) · [Pricing](https://api.video/pricing/) |
| **VdoCipher** | Yes — Widevine + FairPlay on every plan. | Yes (backend OTP/URL authentication; copied links won't play off-site). | **No — "dynamic watermark" is visible** (viewer IP/name/email overlaid in player, moving). | **No.** Terms §6: shall not host "content that contains nudity, pornography or sexually abusive content". | ≈ $417 (Premium $4,999/yr for 50 TB/yr; our 24 TB/yr exceeds the 15 TB Pro tier) — moot, adult banned | [Pricing](https://www.vdocipher.com/pricing) · [Terms](https://www.vdocipher.com/page/terms/) · [Dynamic watermark](https://www.vdocipher.com/blog/dynamic-watermarking) · [DRM page](https://www.vdocipher.com/page/drm/) |
| **Gcore Streaming** | Partial — FairPlay + PlayReady; Widevine "in backlog" per a 2026 third-party article (**could not verify** against Gcore docs). DRM pricing: contact sales. | Yes (token-protected playback; details could not be read). | No. | **Unconfirmed.** Mentioned on LowEndTalk as adult-friendly; no official clause read. | **Could not verify** (per-minute storage/delivery, 1080p transcoding free; DRM by quote) | [DRM docs](https://gcore.com/docs/streaming-platform/video-security/drm-protection) · [Pricing](https://gcore.com/pricing/streaming-platform) · [Third-party DRM comparison](https://www.forasoft.com/learn/video-encoding/articles/drm-packaging-widevine-fairplay-playready-cenc) |
| **AWS (MediaConvert + S3 + CloudFront, SPEKE)** | **Yes, but DIY.** SPEKE v2 supports Widevine/PlayReady/FairPlay; **AWS does not run the key server** — you contract a SPEKE partner (EZDRM Universal $199.99–$299.99/mo + $199.99 setup; BuyDRM KeyOS MultiPass $99/mo for 10k licenses) and run the license proxy. | Yes — CloudFront signed URLs/cookies (you build it). | No (NAGRA NexGuard integrates with AWS, enterprise pricing). | **Unconfirmed.** AWS AUP bans "obscene… child pornography, bestiality, non-consensual sex acts"; legal adult content is widely hosted but not explicitly blessed. | ≈ $200–$480 + significant engineering (CloudFront 2 TB ≈ $170 list; MediaConvert ladder ≈ $150–$250 one-time; S3 ≈ $9; DRM key server $99–$300) | [SPEKE](https://docs.aws.amazon.com/speke/latest/documentation/what-is-speke.html) · [SPEKE onboarding](https://docs.aws.amazon.com/speke/latest/documentation/customer-onboarding.html) · [MediaConvert pricing](https://aws.amazon.com/mediaconvert/pricing) · [MediaPackage pricing](https://aws.amazon.com/mediapackage/pricing) · [EZDRM pricing](https://www.ezdrm.com/service-pricing) · [AWS AUP](https://aws.amazon.com/aup) |
| **Vimeo OTT** | Yes — FairPlay + Widevine Modular + PlayReady, **Enterprise plan only** (unpriced; third-party estimates $500–$5,000+/mo). | Yes (domain/password privacy, expiring links). | No. | **No.** Community Guidelines (apply to Vimeo OTT): "does not allow pornography or other sexually explicit content." | Moot — adult banned, enterprise-only | [DRM with Vimeo OTT](https://help.vimeo.com/hc/en-us/articles/12427018635921-DRM-with-Vimeo-OTT) · [Guidelines](https://vimeo.com/help/guidelines) |
| **Gumlet** (other) | Yes — add-on $99/mo incl. 100k views, +$1 per 1k views. | Yes (signed URLs). | No — "dynamic watermark" is visible overlay, Business plan only. | **No.** Terms prohibit "pornography, obscenity, or nudity". | Moot | [Pricing update](https://www.gumlet.com/blog/gumlet-pricing-update-2026/) · [Terms](https://www.gumlet.com/terms/) · [Screen-capture prevention doc](https://docs.gumlet.com/docs/screen-capture-prevention) |
| **Kinescope** (other) | Yes — Widevine + FairPlay on all paid plans from €10/mo; no per-license fee claimed. | Yes (signed expiring links). | No — visible viewer name/email overlay ("dynamic"). | **Unconfirmed.** | **Could not verify** (plan tiers not read) | [Content protection docs](https://docs.kinescope.com/content-protection/) · [Anti-piracy page](https://kinescope.com/solutions/anti-piracy-video) |
| **FastPix** (other) | Yes — Widevine + FairPlay (2025–26 changelog). | Yes. | No. | **Unconfirmed.** | **Could not verify** | [Widevine changelog](https://fastpix.com/docs/changelog/widevine-drm-support) · [FairPlay changelog](https://fastpix.com/docs/changelog/fairplay-drm-support) |
| **Forensic WM specialists** (DoveRunner/PallyCon, NAGRA NexGuard, Irdeto, Verimatrix) | DRM: yes (PallyCon multi-DRM). | — | **Yes (true A/B forensic).** PallyCon Startup $500/mo for 20k sessions; NAGRA/Irdeto/Verimatrix private quotes. | n/a | ≥ $500/mo on top of hosting — **not viable** | [PallyCon pricing](https://pallycon.com/pricing-3/) · [DoveRunner FWM concepts](https://docs.doverunner.com/content-security/forensic-watermarking/getting-started/fwm-concepts/) · [NAGRA NexGuard](https://nagra.vision/security-solutions/forensic-watermarking/nagra-nexguard-for-pay-tv-and-streaming/) |

---

## 3. Per-vendor detail and cost arithmetic

### 3.1 Mux
- **DRM status.** Introduced in beta July 11, 2024 ("Introducing DRM: the latest tool in protecting your content on Mux"); **generally available Nov 10, 2025**. Snippet from the GA post: *"When you enable DRM on a Mux video, the system encrypts files automatically and generates licenses for the three leading DRM technologies: Google Widevine, Microsoft PlayReady, and Apple FairPlay."* Pricing snippet: *"$100 per month to access the feature, plus $0.003 per license. In most cases, one license equals one view, though browser caching can affect this."* Request access in Dashboard → Settings → Digital Rights Management. May 2026 changelog added offline/persistent license claims.
- **Tokens.** Signed playback IDs. Snippet from secure-playback guide: *"Tokens are encoded using the RS256 algorithm with the private key, and you sign tokens with the private key, and Mux verifies them with the public key."* Claims: `sub` = playback ID, `aud` ∈ {v, t, g, s, d}, `exp`. *"The expiration time should always exceed the current-time plus the duration of the video."* For DRM: *"a signed license URL is required in addition to the normal playback token, with the exception that the aud must be set to d (drm-license)"* and Mux Player takes it as `drm-token`. Optional Playback Restrictions add referrer allow-lists.
- **Watermark.** None per-viewer.
- **Pricing (snippets, July-2025 price cut).** Storage 1080p $0.0045/min/mo (first 50k min); delivery $0.0008/min with "first 100,000 delivery minutes every month are free" (snippet — verify, this may be plan-specific); encoding stated as free in one snippet and $0.043–0.044/min in another — **could not verify**.
- **Our cost.** Storage 3,600 × $0.0045 = **$16.20**. Delivery 67,000 × $0.0008 = **$53.60** (or $0 if the 100k free minutes apply). DRM $100 + 6,000 × $0.003 = **$118**. Total ≈ **$70 without DRM, ≈ $190 with DRM.**
- **Adult.** Snippet of Mux docs/ToS: users agree they *"won't upload any content that is graphic, sexually explicit, or mature in nature"* and Mux ToS bans content it *"reasonably deems to be … obscene, or otherwise objectionable."* Treat as **No** unless the policy agent gets written clearance. Mux also sells NSFW-detection moderation to its customers, which is consistent with Mux not wanting to host it.

### 3.2 Cloudflare Stream
- **DRM status.** Confirmed **not offered**. Stream docs have no DRM page; the "Securing your Stream" page covers only signed URLs. Third-party summary (Gumlet alternative page / LiveAPI): *"Stream doesn't offer Widevine or FairPlay, instead using signed URLs with short-lived tokens plus domain restrictions."* Community threads asking for DRM (163718, 182393) have no "yes". One 2026 listicle (Analytics Insight) claims Cloudflare has multi-DRM — this is contradicted by Cloudflare's own docs and should be disregarded.
- **Tokens.** Snippet: *"Turn on requireSignedURLs to protect a video using signed URLs. When you mark a video to require signed URL, it can no longer be accessed publicly with only the video id."* *"If you call the /token endpoint without any body, it will return a token that expires in one hour … The maximum time specification is 24 hours from issuing time."* Self-signing: create a signing key (RSA key pair, PEM/JWK returned once), sign RS256 JWTs in your Next.js API route — no API call per viewer. Supports `accessRules` (IP/geo) and `downloadable` flag.
- **Watermark.** Snippet: *"Watermark API lets you add a watermark to a video at the time of uploading … a watermark profile describes the watermark image and properties such as positioning, padding, and scale."* Static logo only.
- **Pricing (snippets of developers.cloudflare.com/stream/pricing).** *"Storage is a prepaid pricing dimension purchased in increments of $5 per 1,000 minutes stored, regardless of file size. Delivery is a post-paid, usage-based pricing dimension billed at $1 per 1,000 minutes delivered. Ingress … and encoding are always free."* Bandwidth included in delivered minutes.
- **Our cost.** Storage: 3,600 min → buy 4,000 min = **$20**. Delivery 67,000 min = **$67**. Total ≈ **$87/mo.** Very predictable; no egress-GB risk.
- **Adult.** Community moderator snippet: *"There is no provision against adult content in the CF Stream Supplemental Terms."* *"Cloudflare does not make editorial decisions on what content is appropriate … provided the content is legal and does not violate the terms of use it is OK."* Cloudflare's abuse policy targets CSAM, IP infringement, etc. Must use a paid product (Stream) for video — the CDN ToS 2.8 successor forbids serving video via the free CDN.

### 3.3 Bunny Stream
- **DRM status.** **Yes — MediaCage Enterprise DRM.** Snippet: *"MediaCage Enterprise DRM uses Google's Widevine and Apple's FairPlay technologies to provide an end-to-end solution."* Pricing snippet: *"a base fee of $99 per month, coupled with additional costs for DRM-license fees … Up to 20,000 licenses/month: $0.005 per license; 20,001–100,000: $0.004; 100,001–500,000: $0.003."* License definition: *"A DRM license is issued each time a user initiates playback of a video that requires a DRM license for decryption … multi-key DRM allows a single playback device to receive multiple separate licenses — for example, one for the video stream and two for accompanying … audio tracks."* Caution: the free **MediaCage Basic** is described as *"a basic free DRM system … device-agnostic … does not require any special hardware or software support on the client"* — that is AES encryption with a license endpoint, **not** Widevine/FairPlay. Only Enterprise counts as true DRM.
- **Tokens.** Snippet: *"Bunny Stream offers two layers of token-based protection — one for the embed iframe and one for the underlying CDN URLs."* CDN token auth: *"The token parameter … represents a Base64 encoded SHA256 hash based on the URL, expiration time and other parameters. The expires parameter must always be included."* Supports directory-level tokens (needed for HLS segment trees), IP lock, country allow/block. *"If enabled, embed view token authentication also protects MediaCage Enterprise DRM License service endpoint."* Generated server-side with your library's security key — trivial in a Next.js route.
- **Watermark.** Logo overlay only (position/size/opacity).
- **Pricing (snippets of docs.bunny.net/stream/pricing).** *"Standard encoding is included at no extra cost … Only Premium Encoding is billed"* ($0.05/min for 1080p/720p). *"Storage starts from $0.01/GB"*; replication +$0.01/GB per extra region. *"CDN delivery starts from $0.005/GB"* (volume); Standard network Europe/NA $0.01/GB, MEA up to $0.06/GB. $1 monthly minimum, 14-day trial.
- **Our cost.** Storage: source 200 GB + rendition ladder ≈ 300–400 GB × $0.01 = **$3–4**. Delivery 2,000 GB × $0.01 = **$20** (mostly NA/EU viewers; could be $30–60 if a big share is in high-cost regions). Encoding **$0** (standard). DRM: $99 + 6,000 × $0.005 = **$129**. Total ≈ **$25 without DRM, ≈ $150 with DRM.**
- **Adult.** **Yes, explicitly.** FAQ snippet: *"bunny.net accepts its service to be used for providers of 'adult content', as long as the content is legal under the laws of Slovenia, each of the 50 States of the Union … and abides by all other Terms of Service."* Bunny Stream also has a "content tagging" mechanism for sensitive libraries.

### 3.4 api.video
- **DRM status.** **No.** Third-party comparison snippet: *"api.video has no DRM, and the public changelog has not moved since November 12, 2024."* No DRM page exists in docs.api.video.
- **Tokens.** Private videos: playback requires a session/private token obtained server-side; links are per-session.
- **Watermark.** None per-viewer found.
- **Pricing (snippets).** Pay-as-you-go: encoding free, hosting $0.00285/min (standard $0.003, high-protection $0.005), delivery $0.0017/min.
- **Our cost.** Storage 3,600 × $0.00285 = **$10.26**; delivery 67,000 × $0.0017 = **$114**. Total ≈ **$125/mo** — pricier than Cloudflare for the same no-DRM feature set, and the vendor appears stagnant.
- **Adult.** **Unconfirmed** — no clause surfaced; ToS could not be read.

### 3.5 VdoCipher
- DRM: Widevine + FairPlay on all plans. "Dynamic watermark" = visible overlay of IP/name/email rendered client-side (the WordPress plugin fetches viewer data locally; VdoCipher never sees it). No invisible forensic product despite the blog title.
- Pricing (snippet): Starter $149/yr (1 TB bandwidth **per year**, 100 GB storage) → Value $399 (2.5 TB) → Express $699 (5 TB) → Pro $1,599 (15 TB) → Premium $4,999 (50 TB). Overage ≈ $0.18–0.40/GB. We need ~24 TB/yr → Premium ≈ **$417/mo**.
- Adult: **No** — Terms §6 (snippet): *"The Subscriber shall not use the Services to upload, host or distribute content that contains nudity, pornography or sexually abusive content."*

### 3.6 Gcore Streaming
- DRM: a 2026 Fora Soft comparison says Gcore has FairPlay + PlayReady with Widevine "in backlog" and DRM is quote-only. **Could not verify** against gcore.com docs (blocked). Pricing: storage billed on peak stored minutes, delivery per minute or per GB (enterprise), 1080p ABR transcoding included. No numbers obtained.
- Adult: **Unconfirmed**; Gcore markets AI nudity moderation to customers and is named on LowEndTalk as adult-tolerant — not authoritative.

### 3.7 AWS (MediaConvert → S3 → CloudFront, DRM via SPEKE)
- DRM: SPEKE is AWS's key-exchange API (built on DASH-IF CPIX). Snippet: *"SPEKE is used to supply keys to encrypt video on demand (VOD) content through AWS Elemental MediaConvert and for live content through AWS Elemental MediaPackage."* *"For SPEKE V2.0, this solution works for Widevine, Playready and Fairplay."* **AWS supplies no license server**; you contract a partner (Axinom, BuyDRM, castLabs, EZDRM, Intertrust, Irdeto, DoveRunner …). EZDRM snippets: FairPlay Professional / Widevine Modular $99.99/mo (10k licenses); Universal DRM $199.99/mo; Universal Complete $299.99/mo (20k licenses, $199.99 setup). BuyDRM KeyOS MultiPass $99/mo (10k licenses).
- Tokens: CloudFront signed URLs/cookies — you implement key rotation, policy, etc.
- Pricing (snippets): MediaConvert Basic tier from $0.0075/min (SD; HD/multi-rendition multipliers apply); MediaPackage VOD $0.05/GB (avoidable — package CMAF with MediaConvert straight to S3); CloudFront $0.085/GB first 10 TB.
- Our cost: CloudFront 2 TB ≈ **$170** list (AWS's always-free 1 TB/mo CloudFront tier may halve this — **could not verify** current status); S3 ~400 GB ≈ **$9**; MediaConvert one-time ladder encode ≈ **$150–250**; DRM key server **$99–$300/mo**. Total ≈ **$200–$480/mo** plus weeks of engineering for packaging, license proxy, player integration. Only justified if we need total control.
- Adult: **Unconfirmed.** AUP bans "obscene" and non-consensual/bestiality/CSAM content; legal adult sites run on AWS routinely, but there is no explicit permission.

### 3.8 Vimeo OTT, Gumlet, Kinescope, FastPix
- **Vimeo OTT**: DRM only on unpriced Enterprise; Community Guidelines (apply to Vimeo OTT) ban pornography and "content primarily intended to cause sexual stimulation." **Out.**
- **Gumlet**: DRM add-on $99/mo (100k views incl.), visible dynamic watermark on Business plan; Terms ban pornography/obscenity/nudity, 3 strikes. **Out.**
- **Kinescope**: Widevine + FairPlay and visible viewer-identity watermark on every paid plan from €10/mo, "protected delivery priced the same as ordinary delivery." Adult policy and real plan prices **could not verify**; worth a 10-minute ToS read by the policy agent as a dark-horse option.
- **FastPix**: Widevine + FairPlay live; pricing and adult policy **could not verify**.

---

## 4. Plain-language: what DRM does and does not prevent

**What DRM is.** When a video is "DRM-protected", the file is encrypted and the decryption key is handed only to a trusted component inside the viewer's browser or phone (Widevine on Chrome/Android, FairPlay on Safari/iOS/macOS, PlayReady on Edge/Windows). The player never sees the plain video; the operating system decrypts and displays it.

**What it reliably stops**
- **Direct download / "save video" tools.** Downloaders, browser extensions, and `yt-dlp`-style tools get only encrypted segments they cannot decrypt. (Signed URLs alone do *not* stop this: a logged-in subscriber's browser has the key-free stream and any extension can save it.)
- **Screen recording on Apple devices.** Apple's WebKit documents: *"Media elements whose contents are protected by FairPlay will not appear in screen recordings."* iPhone/iPad/Mac Safari screen recordings and QuickTime captures show a black rectangle where the video is. (Caveat from Apple's developer forum: the *audio* of FairPlay content can still be captured on iOS Safari.)
- **Screen recording on most Android phones (Widevine L1).** L1 decrypts and renders inside the hardware Trusted Execution Environment; capture apps get black frames. Snippet (BuyDRM): *"Widevine Security Level L1 … is effective at preventing screen recording, utilizing special hardware features in devices such as TEE or Secure Media Path."*

**What it does NOT stop**
- **Screen recording on desktop Chrome / Firefox / Edge (Windows and Mac).** These browsers only have **Widevine L3**, which is software-only. Snippets: *"Desktop browsers like Chrome and Firefox on Windows or macOS only support the L3 security level"* (Bitmovin/VdoCipher) and *"There's no way to completely block screen recording on desktop browsers like Chrome or Firefox because they only support Level 3 (L3) of Widevine DRM"* (Gumlet docs). OBS and the built-in Windows/macOS recorders capture L3 playback normally. Vendors that advertise "screen-capture prevention" achieve it on desktop only by forcing Safari/Edge-PlayReady or by degrading resolution on L3.
- **Widevine L3 itself has been broken repeatedly.** In 2020 a researcher published a Chrome extension that *"demonstrates how it's possible to bypass Widevine DRM by hijacking calls to the browser's Encrypted Media Extensions (EME) and decrypting all Widevine content keys transferred"*; Google DMCA'd 135 GitHub repos (TorrentFreak). Leaked L3 CDMs circulate; a determined pirate gets a clean file, not a screen recording.
- **HDCP can be stripped.** Hardware "HDCP strippers" / HDMI splitters sold on AliExpress/Amazon re-emit a clean 1080p–4K signal into a capture card (PointerClicker guide; MakeMKV/HDfury forum threads). This defeats even L1/FairPlay once the video leaves the device over HDMI.
- **A phone camera pointed at the screen.** Snippet (VdoCipher glossary): *"Because the capture happens outside the device entirely, no DRM, HDCP, or screen-capture flag can prevent it; only visible watermarking deters it and makes the resulting copy traceable."* Intertrust's whitepaper calls this the "digital-to-analog" hole.
- **Re-sharing of an account.** DRM doesn't know who is holding the phone. Concurrency limits and device limits are a separate (vendor or self-built) feature.

**Honest framing for the creator:** DRM raises the skill floor from "anyone with a browser extension" to "someone with a capture setup or a phone camera." For a 120-subscriber site, the leak that actually happens is a subscriber screen-recording on a laptop or filming a phone — exactly the cases DRM does not cover. That is why traceability (watermarking) matters more than encryption at this scale.

---

## 5. The fallback: signed URLs + visible per-viewer watermark + deterrents

If DRM is skipped (Cloudflare) or deferred (Bunny without the $99/mo add-on), the practical stack is:

1. **Signed, short-lived playback URLs** issued by a Next.js server route only to an authenticated, paid subscriber. Cloudflare: RS256 JWT, 1-hour default, 24-hour max, optional IP/geo rules. Bunny: HMAC-SHA256 `token`+`expires`, directory-level token so every HLS segment is covered, optional IP lock. Mux: RS256 JWT with `exp` ≥ video length. Rotate keys quarterly; keep expiry at video length + 15 min.
2. **Visible per-viewer watermark** rendered over the player: the subscriber's handle (or a short opaque viewer ID that maps to the account in our DB — avoids showing email) plus a timestamp, in a semi-transparent font, repositioning every 20–60 s so it cannot be cropped out of every frame.
3. **Honest deterrents**: hide native download controls (`controlsList="nodownload"`), disable right-click on the player, `disablePictureInPicture`, blur or pause on `visibilitychange`/`blur`, require a fresh token per play, concurrency limit (one active stream per account), and a clearly worded leak policy in the ToS.
4. **Account-side controls** that actually bite: per-account stream concurrency, device/session count, unusual-geo alerts, and a one-click "revoke all sessions" for an account suspected of leaking.

**State plainly: this does not stop screen recording.** A subscriber can record it on any laptop in one keystroke. What it does is (a) make casual link-sharing useless because links die in an hour, (b) make every leaked copy carry the leaker's identity so the account can be terminated and, if warranted, pursued, and (c) remove the frictionless "download" path. Against a 120-person audience where the creator can ban a leaker, that is most of the real-world value.

---

## 6. How visible per-viewer watermarking is done with HLS, in practice

**(a) Client-side DOM overlay — recommended baseline.**
Render an absolutely-positioned `<div>` over the `<video>` element (hls.js or the vendor's player) with the viewer's handle/ID + `Date.now()`, opacity 0.25–0.4, text-shadow for legibility, and a `setInterval` that moves it to a random position every 30 s. Also draw it twice (two positions) so a single crop can't remove it. Costs nothing; works with Cloudflare, Bunny and Mux players alike (Mux Player and Bunny's iframe need a wrapper; with hls.js or the Bunny/Cloudflare HLS URL in your own `<video>` it's trivial). Vendors like VdoCipher, Gumlet and Kinescope implement their "dynamic watermark" exactly this way (VdoCipher's plugin *"fetches the viewer's IP, name, or email locally on your own site and overlays it on the player"*). **Weakness:** any technical user can delete the element in DevTools or record only the `<video>` node; the watermark also disappears in native fullscreen on iOS unless you use the vendor player's overlay slot. It is a deterrent and a traceability tool for *casual* leaks, not a protection.

**(b) Server-side burned-in per-viewer transcodes.**
Re-encode the video with the viewer's ID in the pixels for each viewer/session. At our scale that means 120 × 60 h = 7,200 h of encodes (and 120× storage) or on-demand just-in-time transcoding with 20 concurrent FFmpeg processes. Not viable in cost or latency unless a vendor does it. None of Mux, Cloudflare, Bunny or api.video offers per-viewer burn-in; AWS could via MediaConvert per-user jobs at ~$0.015+/min/rendition — hundreds of dollars per subscriber. **Skip.**

**(c) Vendor forensic (invisible A/B) watermarking.**
The vendor pre-encodes two imperceptibly different variants of every segment and serves each session a unique A/B sequence at the CDN edge; a leaked copy — even a phone-camera copy — can be decoded back to the session. Available from DoveRunner/PallyCon (Startup $500/mo for 20k sessions; Professional $2,000/mo), NAGRA NexGuard, Irdeto TraceMark, Verimatrix (quote-only, broadcaster pricing) — and requires a packager (AWS MediaPackage/MediaConvert or Nimble) that supports A/B playlists, plus a session manager. **Not offered by any vendor in our price band.** Revisit only if the business grows ~10× or a leak costs more than ~$6,000/year.

**Recommendation:** ship (a) on day one regardless of vendor; add real DRM via Bunny MediaCage Enterprise (or Mux if adult clearance is obtained) when the $100–130/mo is justified; treat (c) as out of scope.

---

## 7. Recommendation

**Shortlist**
1. **Bunny Stream** — primary. Only vendor that (i) says in writing legal adult content is welcome, (ii) has true Widevine + FairPlay DRM available as a $99/mo + $0.005/license switch when we want it, (iii) costs ≈ $25/mo at our scale without it, and (iv) has flexible HMAC token auth that works with our own hls.js player (so the DOM watermark is easy). Risks: no PlayReady (Edge users fall back to Widevine L3 — fine), MEA/APAC egress is pricier, and DRM licenses are multi-key (budget 1.5–2 licenses per play).
2. **Cloudflare Stream** — fallback / A-B candidate. Cheapest *predictable* bill (≈ $87/mo, minutes not GB), signed-URL story is excellent, terms don't prohibit legal adult content, but **DRM is impossible** and the watermark API is a static logo. Pick it only if DRM is formally dropped.
3. **Mux** — technically the best DRM product (all three systems, GA, offline licenses, great docs) at ≈ $190/mo, **but** ToS language appears to prohibit sexually explicit content. Keep on the list only if the policy agent gets written confirmation from Mux; otherwise drop.
- **Drop:** VdoCipher, Gumlet, Vimeo OTT (adult explicitly banned); api.video (no DRM, pricier than Cloudflare, stagnant); AWS DIY (2–5× the cost plus weeks of work for marginal gain at 20 concurrent viewers); Gcore/Kinescope/FastPix (could not verify pricing or policy — park unless the policy agent clears one).

**What to tell the creator (one paragraph):**
"We can make it so a subscriber cannot simply download your videos or share a link — links expire within an hour and only work for a logged-in, paying account. If we turn on DRM (about $100–130 a month extra with Bunny), screen recording will also be blocked on iPhones, iPads, Macs using Safari, and most Android phones; it will *not* be blocked on a Windows or Mac laptop using Chrome, and nothing on earth stops someone filming their screen with a second phone. So the honest promise is not 'nobody can copy this' — it's 'anyone who copies it leaves their fingerprints on it.' Every stream will carry that viewer's own username and the time, faintly, moving around the picture, so if a clip shows up somewhere we know exactly which account leaked it and can ban them and pursue it. For a membership of about 120 people, that traceability — plus the fact that casual downloading just doesn't work — is the protection that actually matters."

---

## 8. Sources (every URL consulted; all vendor pages reached only via search snippets because the sandbox proxy blocked direct fetches)

**Mux**
- https://docs.mux.com/guides/protect-videos-with-drm
- https://support-agent.mux.com/docs/changelog/drm-general-availability
- https://www.mux.com/blog/protect-your-video-content-with-drm-now-ga
- https://www.mux.com/blog/introducing-drm-the-latest-tool-in-protecting-your-content-on-mux
- https://www.mux.com/docs/guides/secure-video-playback
- https://www.mux.com/docs/guides/signing-jwts.md
- https://www.mux.com/docs/changelog/drm-offline-playback-support
- https://mux.com/docs/changelog/player-web-2-8-0
- https://www.mux.com/docs/pricing
- https://www.mux.com/terms
- https://www.mux.com/docs/examples/moderate-video-content
- https://tessl.io/registry/tessl/npm-mux--mux-node/files/docs/jwt.md

**Cloudflare Stream**
- https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/
- https://developers.cloudflare.com/stream/pricing/
- https://developers.cloudflare.com/api/node/resources/stream/subresources/token/methods/create
- https://community.cloudflare.com/t/cloudflare-stream-drm/163718
- https://community.cloudflare.com/t/upload-encrypted-video-using-drm-widevine-etc/182393
- https://community.cloudflare.com/t/does-cloudflare-stream-allow-porn/192012
- https://community.cloudflare.com/t/acceptable-use-policy/313947
- https://www.cloudflare.com/service-specific-terms-developer-platform/
- https://www.cloudflare.com/trust-hub/abuse-approach/
- https://blog.cloudflare.com/updated-tos/
- https://blog.cloudflare.com/add-watermarks-to-your-cloudflare-stream-video-uploads
- https://www.gumlet.com/cloudflarestream-alternative/
- https://liveapi.com/blog/cloudflare-stream/
- https://flarecalc.com/calculators/stream

**Bunny Stream**
- https://docs.bunny.net/stream/drm
- https://docs.bunny.net/stream/security
- https://docs.bunny.net/stream/security-options
- https://docs.bunny.net/stream/players/widevine
- https://docs.bunny.net/stream/players/fairplay
- https://docs.bunny.net/stream/widevine-security-levels
- https://docs.bunny.net/cdn/security/token-authentication/advanced
- https://support.bunny.net/hc/en-us/articles/360016055099
- https://docs.bunny.net/stream/pricing
- https://bunny.net/pricing/stream/
- https://bunny.net/stream/media-cage-enterprise-multi-drm-digital-rights-management/
- https://bunny.net/blog/were-simplifying-video-security-introducing-enterprise-drm/
- https://bunny.net/acceptable-use/
- https://bunny.net/faq/
- https://support.bunny.net/hc/en-us/articles/4412240806802-Understanding-Bunny-Stream-Content-Tagging
- https://swarmify.com/blog/bunny-stream-review/
- https://kinescope.com/kinescope-vs-bunny
- https://daveswift.com/bunnystream/

**api.video**
- https://docs.api.video/delivery/video-privacy-access-management
- https://api.video/pricing/
- https://fastpix.com/blog/best-video-apis-for-creator-subscription-platforms-2026
- https://www.gumlet.com/learn/video-api-platforms-for-developers/
- https://toolradar.com/tools/api-video/pricing

**VdoCipher**
- https://www.vdocipher.com/pricing
- https://www.vdocipher.com/page/terms/
- https://www.vdocipher.com/page/drm/
- https://www.vdocipher.com/blog/dynamic-watermarking
- https://www.vdocipher.com/blog/forensic-watermarking/
- https://www.vdocipher.com/glossary/camcording/
- https://www.vdocipher.com/blog/widevine-drm/
- https://www.gumlet.com/learn/gumlet-vs-vdocipher/

**Gcore**
- https://gcore.com/docs/streaming-platform/video-security/drm-protection
- https://gcore.com/pricing/streaming-platform
- https://www.forasoft.com/learn/video-encoding/articles/drm-packaging-widevine-fairplay-playready-cenc
- https://lowendtalk.com/discussion/182351/global-cdn-network-which-allows-porn

**AWS / SPEKE / key-server partners**
- https://docs.aws.amazon.com/speke/latest/documentation/what-is-speke.html
- https://docs.aws.amazon.com/speke/latest/documentation/customer-onboarding.html
- https://aws.amazon.com/blogs/media/get-to-know-speke
- https://aws.amazon.com/mediaconvert/pricing
- https://aws.amazon.com/mediapackage/pricing
- https://docs.aws.amazon.com/solutions/latest/video-on-demand-on-aws-foundation/cost.html
- https://aws.amazon.com/aup
- https://www.ezdrm.com/service-pricing
- https://aws.amazon.com/blogs/media/securing-premium-live-content-with-nagra-nexguard-forensic-watermarking-on-aws/

**Vimeo OTT, Gumlet, Kinescope, FastPix**
- https://help.vimeo.com/hc/en-us/articles/12427018635921-DRM-with-Vimeo-OTT
- https://vimeo.com/help/guidelines
- https://www.gumlet.com/blog/gumlet-pricing-update-2026/
- https://www.gumlet.com/terms/
- https://www.gumlet.com/learn/video-drm-cost/
- https://www.gumlet.com/learn/dynamic-watermarking-video-platforms-compared/
- https://docs.kinescope.com/content-protection/
- https://kinescope.com/solutions/anti-piracy-video
- https://fastpix.com/docs/changelog/widevine-drm-support
- https://fastpix.com/docs/changelog/fairplay-drm-support

**Forensic watermarking vendors**
- https://pallycon.com/pricing-3/
- https://docs.doverunner.com/content-security/forensic-watermarking/getting-started/fwm-concepts/
- https://nagra.vision/security-solutions/forensic-watermarking/nagra-nexguard-for-pay-tv-and-streaming/
- https://www.forasoft.com/learn/video-streaming/articles-streaming/forensic-watermarking-ab-streaming
- https://kinescope.com/blog/forensic-watermarking

**DRM limitations: screen capture, Widevine L3, HDCP, camcording**
- https://bugs.webkit.org/show_bug.cgi?id=185351 (WebKit: FairPlay media excluded from screen recordings)
- https://developer.apple.com/forums/thread/816464 (audio of FairPlay content capturable on iOS Safari)
- https://docs.gumlet.com/docs/screen-capture-prevention
- https://optiview.dolby.com/docs/theoplayer/faq/how-to-prevent-screen-recording/
- https://go.intertrust.com/hubfs/assets/I2S/Can-Screen-Capturing-Be-Prevented.pdf
- https://go.buydrm.com/thedrmblog/preventing-screen-recording-with-drm-balancing-security-and-user-experience
- https://go.buydrm.com/thedrmblog/managing-widevine-drm-for-preventing-screen-capture-and-recording-on-android-devices
- https://developer.bitmovin.com/playback/docs/widevine-security-levels-in-web-video-playback
- https://kinescope.com/blog/multi-drm-widevine-fairplay-playready
- https://torrentfreak.com/google-takes-down-repositories-that-circumvent-its-widevine-drm-201113/
- https://ar5iv.labs.arxiv.org/html/2204.09298 (Exploring Widevine for Fun and Profit)
- https://pointerclicker.com/hdmi-splitters-that-bypass-hdcp/
- https://forum.makemkv.com/forum/viewtopic.php?p=99324
- https://www.cnx-software.com/news/hdcp/

**Aggregators (used only for cross-checking; lower confidence)**
- https://www.analyticsinsight.net/tech-news/10-best-video-hosting-platforms-with-drm-protection-in-2026 (claims Cloudflare has DRM — contradicted by Cloudflare's own docs)
- https://www.forasoft.com/learn/video-streaming/articles-streaming/multi-drm-cost-calculator
- https://apicostcalc.com/mux-vs-cloudflare-stream-vs-bunny-stream-cost-calculator.html
