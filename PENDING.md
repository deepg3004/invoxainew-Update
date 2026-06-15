# InvoxAI — PENDING WORK (every open item)

> Generated 2026-06-15. Source of truth = master plan (`docs/INVOXAI_MASTER_PLAN.md`),
> session memory, security audit, and a full codebase scan (0 inline TODO/FIXME — all
> tracked here). Legend:
> **🟢 Claude can build** (self-contained, no secrets/decisions) ·
> **🟡 Claude builds, then needs a key/decision/deploy from Deep** ·
> **🔴 Only Deep can do** (account config, secret keys, content, product decision) ·
> **⏸ Deferred** (low priority, explicitly parked).

---

## 0. STATUS SNAPSHOT
- **Prod** = live on this box (commit `2b59714` baseline, then app-only deploys through `225ecbf`). 4 systemd units (invox-web/app/admin/tenant) + Caddy. DB = live Supabase.
- **Branch** `feature/post-audit-improvements` is now also pushed to `github.com/deepg3004/invoxainew-Update` `main` (229 commits, 679 files).
- **No pending DB migrations** — all 1→15x migrations are applied to prod. Future code that adds a migration must be deployed with `pnpm db:deploy`.
- The big recurring theme: **most "missing" audit items already exist in this branch** — the real unlock is DEPLOY + Deep's LIVE keys/content, not new code.

---

## 1. 🔴 DEPLOY / CONFIG / SECRETS — only Deep can do (highest impact, no code)
These are not bugs; they are account/content/secret setup. The platform is built and waiting on them.

1. **Razorpay TEST → LIVE keys** — currently test keys; real payments need Deep's live secret.
2. **Manual UPI ID is blank** — set the UPI VPA so manual-UPI checkout works.
3. **`RESEND_API_KEY`** (email provider) — until set, ALL email is dormant: abandoned-cart recovery, sequences, broadcasts, themed emails. Code is built + env-gated.
4. **`CRON_SECRET` + a scheduler** hitting these every ~15 min (built, inert without it):
   - `/api/cron/recovery` (abandoned-cart)
   - `/api/cron/sequences` (drip)
   - `/api/cron/broadcasts` (email blasts)
5. **`META_CONVERSIONS_TOKEN`** — needed for Meta CAPI server-side Purchase events (see §5).
6. **Content gaps (Deep's own data):** course "treert" has 0 lessons; only 1 product; empty bio text/socials; hidden 4★ review; empty tracking pixels; wallet balance low (₹206).
7. **Consent region policy** (GDPR opt-in vs India implied-consent) — a PRODUCT DECISION blocking the cookie-consent banner (§5).
8. **Rotate the GitHub token** `ghp_4W3t5...` shared in chat — https://github.com/settings/tokens.

---

## 2. NAV / ADMIN-CONTROL PROGRAM — remaining batches (Deep's 8-part request)
Batches 1–2 + theme-audit fix are ✅ DONE+DEPLOYED. Remaining, in sequence:

3. **🟢 Admin-controlled menu visibility** — per seller-menu-item state: `visible / hidden / coming-soon / maintenance`. Needs a config model (global default, optional per-plan/per-tenant), admin UI to toggle, `SELLER_NAV` reads it, route guards enforce (blocked item → coming-soon/maintenance screen).
4. **🟢 Global maintenance mode (admin switch)** — when ON, all public tenant storefronts show a maintenance screen; only `invoxai.io` (web) + `admin.invoxai.io` stay live. Needs a platform-settings flag + tenant middleware/layout check.
5. **🟡 Premium themes/templates priced in admin** — admin authors premium themes/templates with a price; sellers pay to unlock. Money path → reuse `markBuyerPaymentPaid` claim-winner idempotency + adversarial review. (Note: also requires the `builder_template` FeatureRule below.)
6. **🟡 "Remove InvoxAI branding" paid feature** — gate `BuiltWithBadge` removal behind a paid upgrade; admin sets price. Badge already lives in `apps/tenant/app/ThemeRuntime.tsx`.
7. **🟡 Full 2FA TOTP** — Supabase MFA enroll/challenge/verify flow in `/settings` security. (Currently a "Coming soon" stub.)
8. **🟢 Billing page form** — add the billing form on `/billing`.

**Also pending from this program:**
- **🔴 Admin must create the `builder_template` FeatureRule under `/features`** to price premium templates — until then premium template apply returns "not available" (no-op).
- **⏸ Untheme follow-up:** buyer portal `/account/*` (7 pages) still unthemed (by minor priority); `/bio` `/verify` `/report-abuse` intentionally plain.

---

## 3. BUILDER — remaining items
Phases 0/0b/1/2/3/4-part1 + entity widgets + templates marketplace are ✅ DONE+DEPLOYED (29 block types, 24-theme library). Remaining:

- **🟢 Hand-authorable add/edit UI for the 3 static widgets** (`list` / `testimonial` / `callout`) — currently AI-generated + previewed + preserved through save, but not hand-authorable in the editor. Small now that the add/picker infra exists.
- **⏸ Editor PreviewBlock gradient/shimmer parity** — mostly fixed (289b01f); any residual flat-accent cosmetic mismatch vs live is cosmetic only.
- **⏸ Full markdown rich-text** for product / AI-page descriptions — currently line-break-preserving only; needs a safe markdown renderer.
- **❌ Custom HTML/CSS block — DELIBERATELY DECLINED** (breaks the no-raw-HTML trust boundary). Not a pending item; documented so nobody "adds" it.

---

## 4. (was Phase 4) TRACKING / ATTRIBUTION REMAINDER
TikTok pixel + click attribution (fbclid/gclid/ttclid/fbp) are ✅ DONE+DEPLOYED. Remaining:

- **🟡 Meta CAPI server-side Purchase** — fire post-commit best-effort from `markBuyerPaymentPaid` / `confirmManualBuyerPayment` with shared `event_id` dedup; browser `firePurchase(amount, orderId)` eventID threaded through ~5 buy boxes. **Blocked on `META_CONVERSIONS_TOKEN`.**
- **🔴 Consent Mode v2 + cookie banner** — blocked on Deep's consent-region policy (§1.7, a product decision).

---

## 5. OPS BUCKET (master plan §7) — remaining
- **🟢 Team / RBAC** — per-tenant `TeamMember` (multi-seat, OWNER/MANAGER/STAFF) + admin sub-roles (OPS/FINANCE/SUPPORT/MARKETING claims; current admin is a single email allowlist). ⚠️ Touches EVERY action's auth gate — large, careful surface.
- **🟡 WhatsApp / SMS channels** — provider adapter (Gupshup/Twilio) behind the existing notification `channel` field. Unlocks WhatsApp on abandoned-cart + sequences. **Blocked on provider choice (§9) + provider creds.**
- **🟡 Seller SMTP** — `SellerSmtp { host, port, user, secretEnc }` (encrypted) so sellers send buyer email from their own domain. Needs the encryption pattern (already have AES-256-GCM helper).
- **🟢 Buyer enhancements** — email-OTP login fallback, `BuyerAddress`, `BuyerWishlist`.
- **🟢 Dedicated `Buyer` model** — currently buyers are derived (profile/email). A first-class model is the last genuinely-missing schema entity (besides TeamMember).
- **⏸ Affiliate payouts/portal** — POOR FIT: InvoxAI uses seller-owned-gateway (no platform-held funds to withdraw). Likely SKIP, or build as off-platform records only.
- **✅ Support desk** — DONE (buyer↔seller tickets). Admin oversight page could be added later (minor).

---

## 6. COMMUNITY DEPTH (master plan §4) — 🟡 env-gated
Replace the static `accessUrl` with real bot-driven grant/revoke.
- **Telegram VIP** — `TelegramVipGroup / SubscriptionPlan / Membership / UserSession`; bot auto-invites on PAID, kicks on expiry (cron sweep). Needs `TELEGRAM_BOT_TOKEN`.
- **Discord** — `DiscordServer / DiscordMembership`; OAuth connect + bot auto-assigns role on PAID, removes on expiry. Needs a Discord bot.
- Reuses the existing community money path (claim-winner grant) + jobs for expiry sweeps. **Blocked on bot tokens + bot hosting decision (§9).**

---

## 7. COURSE / VIDEO (master plan §5) — 🟡 infra-heavy
Course/Section/Lesson/Enrolment/LessonProgress + Quizzes + Certificates already exist. Missing:
- **Protected HLS + transcode pipeline** — `HlsAsset { lessonId, storageKey, status }` + a transcode worker (self-host ffmpeg OR Mux/Cloudflare Stream adapter), playback via short-lived signed HLS URLs, enrolment-gated.
- **Drip** — `Lesson.availableAfterDays` → unlock N days after enrolment.
- **Lesson-watch analytics** — watch events (PageView exists; add lesson-watch).
- **Blocked on:** storage (S3/R2) + transcode infra decision (§9). Certificates ✅ done.

---

## 8. CRM — Part 2 (optional)
- **🟢 CRM Part 2** — manual stage override + tags + REFUNDED stage. Needs a stored contacts table (current pipeline is derived from orders/leads). Derived view already covers the core, so this is optional.

---

## 9. FUTURE BUCKET (master plan §8)
- **✅ Bookings / 1-on-1** — DONE (batch 13, safe slot design).
- **🟢 Events / Webinars (ticketed)** — `event_registrations`; mirrors the workshop money rail. (Workshops ✅ done; generic ticketed events still open.)
- **🟢 AI chatbot agents** — per-site support/FAQ/lead bot (Claude). Net-new.
- **🟢 Social-post scheduler** — planner first, API publishing later.

---

## 10. OPEN PRODUCT DECISIONS (must confirm before building the blocked items)
1. **WhatsApp provider** — Gupshup vs Twilio vs Interakt (affects §5 WhatsApp/SMS).
2. **Video infra** — self-host ffmpeg vs Mux vs Cloudflare Stream (affects §7).
3. **Telegram/Discord bot hosting** — long-running worker vs serverless webhooks (affects §6).
4. **Admin RBAC rollout** — big auth surface; sequence so it doesn't block other work (§5).
5. **Bookings/Events priority** — Bookings done; pull Events earlier or keep in Future?
6. **Consent region policy** — GDPR opt-in vs India implied-consent (blocks §4 cookie banner).

---

## 11. ⏸ DEFERRED LOW-PRIORITY LEFTOVERS
- Bulk coupon-code generator.
- Free-shipping coupon type.
- Forms: custom field types (dynamic schema) + file-upload field.
- Per-plan storage-limit override (media library is a flat 1 GiB constant today).
- Broader large-infra audit items already mapped above: video transcode, full email-marketing platform polish, WhatsApp, intl payments, COD, Zapier, heatmaps.

---

## 12. SECURITY — open/deferred items
The 2026-06-14 audit is essentially closed (secrets CLEAN; H1 UPI auto-confirm, M1 atomic-wallet, F1/F2/F3 input-scoping all ✅ FIXED).
- **⏸ zod structural hardening (DEFERRED, decision pending)** — adding zod at app action boundaries needs zod in each app's `package.json` (a package install = human approval) and is a broad refactor. Marginal value is low since the concrete gaps are closed and validation is hand-rolled + db-layer self-enforced. Revisit only if Deep approves the dep.

---

## 13. RECOMMENDED NEXT ORDER (Claude-buildable, no blockers)
1. **Nav batch 3** — admin-controlled menu visibility (unlocks 4 + maintenance mode).
2. **Nav batch 4** — global maintenance mode.
3. **Builder** — hand-authorable list/testimonial/callout add/edit UI (small, finishes Builder).
4. **Nav batch 8** — billing form.
5. **Nav batches 5 & 6** — premium-template pricing + branding-removal paywall (money path → adversarial review).
6. **Ops** — Buyer model + wishlist/addresses/OTP; then Team/RBAC (large).
7. **Future** — Events / AI chatbot / social scheduler.

> Everything in §1, plus the `META_*`/`TELEGRAM_*` keys and provider/infra decisions in §10, is **blocked on Deep** and cannot be built around.
