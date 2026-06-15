# InvoxAI — Master Build Plan (Gap → Spec → Sequence)

> Status: **PLAN ONLY** (agreed 2026-06-14). No code in this pass.
> First bucket to build: **Growth / Automation**. Builder approach: **extend `AiPage`**.
> This doc is the consolidated map of the remaining `[[repo-parity-build]]` work:
> Final Plan (target) vs current InvoxAI repo (built) vs previous repo `deepg3004/hello` (82 tables, features to port).

---

## 0. Non-negotiable invariants (apply to EVERY new module)
Carried from the current codebase — every new feature must honour them:
1. **Money = integer paise**; commission/GST/discount = integer **basis points**. Never floats.
2. **Tenant isolation in app code** — every query scoped by session-derived `tenantId` (Prisma runs as owner, bypasses RLS; RLS stays deny-anon as backstop).
3. **Idempotency** — any money/grant path keyed on a UNIQUE id; reuse the `markBuyerPaymentPaid` atomic-claim (claim-winner-only) pattern. Replays must no-op.
4. **Buyer money never touches InvoxAI** — buyer pays on the seller's own gateway/UPI; InvoxAI only debits the seller's wallet for commission/fees.
5. **Secrets encrypted at rest** (AES-256-GCM), never returned to the browser or logged. Private files via short-lived signed URLs only.
6. **Append-only ledgers/logs** keep no `updatedAt`; mutable rows get `updatedAt`. New money-touching tables follow the wallet-ledger discipline (balance only mutated in the same txn as a ledger row).

---

## 1. Where we are vs target (one-line per domain)
**Strong / done (ahead of prev repo):** wallet+immutable ledger, commission engine, feature billing (₹149), platform gateway, GST invoices, seller gateway + manual UPI, tenant/subdomain/custom-domain+SSL, products/variants/collections/coupons, payment pages, basic store/orders, affiliates, bio link, lead forms, risk/abuse/KYC, activity/audit logs, basic ads tracking + analytics, email notifications.

**Remaining ~18–20 modules**, clustered into 5 buckets (build order):
1. **Growth / Automation** ← FIRST
2. **Community depth** (Telegram/Discord)
3. **Course / Video** (HLS, drip, certs)
4. **Builder** (multi-page, extend `AiPage`) + Templates/Themes
5. **Ops** (support, team/RBAC, WhatsApp/SMS, buyer OTP/wishlist/addresses, affiliate payouts)
Plus **Later/Future:** Bookings, Events/Webinars, AI chatbot agents, Social-post scheduler.

---

## 2. SEQUENCED ROADMAP

| Phase | Bucket | Modules (in order) | Reuses | Risk |
|------|--------|--------------------|--------|------|
| G1 | Growth | Post-purchase Upsell/OTO → Abandoned-cart recovery → Email/DM Sequences → CRM pipeline → Social-proof → A/B testing | money core, jobs, notifications | Low |
| C1 | Community | Telegram VIP (bot invite/expiry) → Discord auto-role | gateway, jobs | Med (bot infra) |
| L1 | Course/Video | Transcode+HLS pipeline → drip → certificates → view analytics | jobs, storage | High (infra) |
| B1 | Builder | Extend AiPage → multi-page Sites/Pages/Versions → widget catalog → Templates/Themes marketplace | blocks render, feature billing | Med |
| O1 | Ops | Support desk → Team/RBAC → WhatsApp/SMS channels → seller SMTP → buyer OTP/wishlist/addresses → affiliate payouts | auth, notifications | Low–Med |
| F1 | Future | Bookings → Events/Webinars → AI chatbot agents → Social posts | — | varies |

Rule of thumb already proven in `[[repo-parity-build]]`: **one complete, tested module per turn** when we move to build (data model + db actions + app UI + tests), but this doc plans ALL of them up front.

---

## 3. BUCKET 1 — GROWTH / AUTOMATION (full spec — FIRST to build)

### G1.1 Post-purchase Upsell / OTO  *(already in progress per memory)*
**Purpose:** after a buyer pays, offer a one-click add-on (one-time offer) on the seller's gateway, no re-entry of details.
**Data model (Prisma additions):**
- `Upsell { id, tenantId, kind: ORDER_BUMP|POST_PURCHASE, triggerProductId?, offerProductId, headline, blurb?, discountBps Int @default(0), active Bool, sortOrder, createdAt, updatedAt }`
- `OtoConsumed { id, parentBuyerPaymentId, upsellId, createdAt, @@unique([parentBuyerPaymentId, upsellId]) }` ← idempotency: refresh can't double-charge.
**Key functions (`packages/db/src/upsells.ts`):** `listActiveUpsells(tenantId, triggerProductId)`, `createOtoOrder({parentPaymentId, upsellId})` → prices offer server-side (offerProduct.pricePaise − discount), creates a NEW `BuyerPayment` on the seller's gateway, returns checkout; `consumeOto()` inside the PAID claim.
**Flow:** PAID order → success page reads active POST_PURCHASE upsells → buyer clicks "Add for ₹X" → `createOtoOrder` (server-trusted price) → seller gateway → verify → `markBuyerPaymentPaid` (claim-winner writes `OtoConsumed`, commission debit, grant) → done. Order-bump variant already exists via `Product.bumpEnabled`.
**UI:** Seller → Growth → Upsells (list, create bump vs post-purchase, pick trigger/offer product, discount, headline). Buyer → `/pay/success?oto=…`.
**Effort:** S–M. **Depends on:** nothing new.

### G1.2 Abandoned-cart / checkout recovery  *(route `/abandoned` exists — finish it)*
**Purpose:** recover checkouts started but not paid via timed email/WhatsApp nudges.
**Data:** `AbandonedCheckout { id, tenantId, buyerEmail?, buyerContact?, productId?/cartSnapshot Json, amountPaise, resumeToken @unique, status: OPEN|RECOVERED|LOST, nudge1At?, nudge2At?, recoveredPaymentId?, createdAt, updatedAt }`.
**Functions:** `recordAbandoned()` (called when a CREATED BuyerPayment/UPI session ages without PAID, or a checkout beacon fires), `sweepAbandonedNudges()` (cron worker: +1h → nudge1, +24h → nudge2, then LOST), `markRecovered(resumeToken)` on PAID.
**Flow:** checkout started → row OPEN → BullMQ cron sweeps → notification (email now, WhatsApp when channel lands) with `…/pay/<slug>?resume=<token>` → PAID flips RECOVERED. Idempotent on `resumeToken`.
**UI:** Seller → Growth → Abandoned Carts (list, status, recovered revenue). **Reuses:** `@invoxai/jobs`, notifications. **Effort:** M.

### G1.3 Email / DM Sequences (drip automation)
**Purpose:** automated multi-step follow-ups triggered by events.
**Data:** `EmailSequence { id, tenantId, name, trigger: SIGNUP|PURCHASE|LEAD|TAG, triggerProductId?, active, createdAt, updatedAt }`; `SequenceStep { id, sequenceId, order, delayHours, channel: EMAIL|WHATSAPP, subject?, body }`; `SequenceEnrollment { id, sequenceId, contactId, currentStep Int @default(0), nextRunAt, status: ACTIVE|DONE|CANCELLED, @@index([status, nextRunAt]) }`.
**Functions:** `enrollInSequence(sequenceId, contact)` (idempotent per (sequence, contact)), `advanceSequences()` (cron: pick `ACTIVE && nextRunAt<=now`, send current step via channel adapter, bump `currentStep`/`nextRunAt`, DONE at end), trigger hooks wired into signup/PAID/lead.
**Flow:** event → enroll → worker advances by `delayHours` → channel send → log to `NotificationLog`.
**UI:** Seller → Growth → Sequences (builder: steps, delays, channel, copy). **Reuses:** jobs, notifications, CRM contacts. **Effort:** M–L.

### G1.4 CRM pipeline
**Purpose:** unify leads + buyers into contacts with a sales pipeline.
**Data:** `CrmContact { id, tenantId, email?, phone?, name?, stage: LEAD|ENGAGED|CUSTOMER|VIP|REFUNDED, source?, tags String[], valuePaise Int @default(0), lastActivityAt, createdAt, updatedAt, @@unique([tenantId, email]) }`.
**Functions:** `upsertContact()` (from LeadSubmission, BuyerPayment, signup), `moveStage()` (manual + auto: PAID→CUSTOMER, repeat→VIP, refund→REFUNDED), `listPipeline(tenantId)` grouped by stage.
**Flow:** lead/buyer/refund events upsert contact + auto-advance stage; seller drags cards on a kanban.
**UI:** Seller → Growth → CRM (kanban Lead→Engaged→Customer→VIP). **Reuses:** lead forms, orders. **Effort:** M.

### G1.5 Social-proof popups
**Purpose:** live "Rahul from Pune just bought X" toasts on public pages.
**Data:** `SocialProofEvent { id, tenantId, kind: PURCHASE|SIGNUP, displayName (masked), productTitle?, city?, createdAt }` (append-only, no PII).
**Functions:** write on PAID (masked first name + city only); `GET /api/social-proof?tenant=` returns recent N.
**Flow:** PAID → event row → public page polls endpoint → renders toast. **Privacy:** mask name, never email/phone.
**UI:** Seller → toggle + style in tracking/store settings. **Effort:** S.

### G1.6 A/B testing (page experiments)  *(last in bucket)*
**Purpose:** split-test a page; pick the winner by conversion.
**Data:** `PageExperiment { id, tenantId, pageId, variantBId, splitBps Int @default(5000), metric: VIEW|PURCHASE, active }`; counters in an append-only `ExperimentEvent` or rolled-up columns.
**Functions:** cookie-bucket visitor, serve variant, attribute conversion, report winner.
**Flow:** visitor → bucketed by cookie → variant served → conversion counted. **Effort:** M. **Depends on:** Builder (G works better once multi-page exists) — can ship a simple version against AiPage now.

---

## 4. BUCKET 2 — COMMUNITY DEPTH (Telegram / Discord)
Replace the current `accessUrl` link with real bot-driven access grant + revoke.
- **Telegram:** `TelegramVipGroup { tenantId, chatId, title }`, `TelegramSubscriptionPlan { groupId, pricePaise, intervalDays }`, `TelegramMembership { groupId, buyer, expiresAt, status }`, `TelegramUserSession` (link buyer→telegram user via bot deep-link). Bot **auto-invites on PAID**, **kicks on expiry** (cron sweep). Buyer memberships are time-boxed (recurring via re-pay).
- **Discord:** `DiscordServer { tenantId, guildId }`, `DiscordMembership { buyer, roleId, status }` — OAuth connect + bot **auto-assigns role on PAID**, removes on expiry.
- **Reuses:** community money path (already grants `CommunityMembership` on PAID — extend the claim-winner to call the bot), jobs for expiry sweeps. **New infra:** a Telegram bot token + a Discord bot (encrypted, per the secrets rule). **Effort:** L.

---

## 5. BUCKET 3 — COURSE / VIDEO
- **Transcode + protected HLS:** `HlsAsset { lessonId, storageKey, status: UPLOADING|TRANSCODING|READY }`, a transcode **worker** (ffmpeg self-host OR Mux/Cloudflare Stream adapter), playback via **short-lived signed HLS URLs** (no public keys), enrolment-gated server-side.
- **Drip:** `Lesson.availableAfterDays Int?` → lesson unlocks N days after enrolment.
- **Certificates:** generate a PDF on 100% `LessonProgress` (reuse invoice PDF tooling) → buyer corner download.
- **Course analytics:** `course_view_sessions` equivalent (PageView already exists; add lesson-watch events).
- **Already built:** Course/Section/Lesson/Enrolment/LessonProgress. **Effort:** L (infra-heavy). Storage = S3/R2.

---

## 6. BUCKET 4 — BUILDER (extend `AiPage`) + Templates/Themes
**Decision (agreed): extend the existing `AiPage`** — keep the proven safe server-render path (`@invoxai/utils/blocks`, no raw model HTML).
- **Multi-page:** new `BuilderSite { tenantId, name }` 1:N `AiPage` (add `siteId?`, `path`, `isHome`); keep `AiPageVersion` (already the version-history pattern). Pages stay structured-JSON `content`.
- **Widget catalog:** extend `blocks.ts` renderer with the Plan's 25 widgets (heading/text/image/button/video/pricing/FAQ/testimonials/feature-grid/countdown/lead-form/payment-button/product-card/course-card/store-grid/social/trust-badges/stats/header/footer…). Each widget = a typed block + a server renderer. No raw HTML ever.
- **AI generation:** unchanged engine; per-extra-page charge already handled by **feature billing** (`ai_page` rule, wallet/direct). Multi-page just loops the generator per page.
- **Templates/Themes marketplace:** `BuilderTemplate { category, isPremium, pricePaise?, contentJson }`, `Theme { tokens Json }`; admin authoring in admin app; "use template" copies JSON → new site (mirrors prev repo `builder_templates`). Premium templates = a feature charge.
- **Device preview / live edit (color/font/radius/copy):** client editor over the block JSON. **Effort:** L, but incremental (multi-page first, widgets next, marketplace last).

---

## 7. BUCKET 5 — OPS
- **Support desk:** `SupportTicket { tenantId, buyer?, subject, status }`, `SupportMessage { ticketId, sender, body }`. Buyer corner + seller inbox + admin oversight. **Effort:** M.
- **Team / RBAC:** `TeamMember { tenantId, userId, role: OWNER|MANAGER|STAFF, perms }` (per-tenant multi-seat) + **admin sub-roles** (extend `requireAdmin` to OPS/FINANCE/SUPPORT/MARKETING claims; current is a single email allowlist). **Effort:** M (touches every action's auth gate — do carefully).
- **WhatsApp / SMS channels:** provider adapters (Gupshup/Twilio) behind the existing notification `channel` field; `NotificationLog` already supports it. Unlocks abandoned-cart + sequences on WhatsApp. **Effort:** M.
- **Seller SMTP:** `SellerSmtp { tenantId, host, port, user, secretEnc }` (encrypted) so sellers send buyer email from their own domain. **Effort:** S–M.
- **Buyer enhancements:** email-OTP login fallback (`buyer_portal_otps`), `BuyerAddress`, `BuyerWishlist`. **Effort:** M.
- **Affiliate payouts + portal:** `AffiliatePayout`, affiliate-facing portal w/ OTP login (prev repo `affiliate_portal_otps`). Note: payouts here are **seller→affiliate off-platform records** (InvoxAI doesn't hold funds), consistent with the no-payout core. **Effort:** M.

---

## 8. LATER / FUTURE (Plan §27/§28 + commerce extras)
- **Bookings/Appointments** (`booking_types/availability/bookings`) — calendar + paid slots on seller gateway.
- **Events / Webinars** (`event_registrations`) — ticketed events.
- **AI chatbot agents** (Plan §27) — per-site support/FAQ/lead bot (Claude). Net-new (not even in prev repo).
- **Social-post scheduler** (Plan §28) — planner first, API publishing later.

---

## 9. Open product decisions to confirm as we build
1. **WhatsApp provider** (Gupshup vs Twilio vs interakt) — affects G1.2/G1.3 channel adapter.
2. **Video infra** (self-host ffmpeg vs Mux/Cloudflare Stream) — cost vs ops for Bucket 3.
3. **Telegram/Discord bot hosting** — long-running worker vs serverless webhooks.
4. **Admin RBAC** rollout — big auth surface; sequence so it doesn't block other work.
5. **Bookings/Events** priority — keep in Future, or pull earlier if your audience needs it.

---

## 10. Build cadence (when we switch from plan to code)
Per `[[repo-parity-build]]`: one complete, **tested** module per turn — Prisma model + migration (staged for your approval, per CLAUDE.md) + `packages/db` actions + app UI + vitest. Start: **G1.1 Upsell/OTO** (already in progress) → G1.2 → … in the table order. Each module preserves the §0 invariants and adds tests for any money path.
