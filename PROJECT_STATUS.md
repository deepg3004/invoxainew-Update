# InvoxAI — Project Status (verified)

> Ground-truth status of the **user/seller-side** feature set, verified by reading the
> actual code on 2026-06-14. This supersedes the earlier eyeballed "Missing Features"
> audit, which marked many shipped, working flows as missing. Each ✅ below cites the
> file that proves it. Items marked **not verified** were not deep-read in this pass and
> are the most likely place for real gaps to remain.

## Summary

The earlier audit estimated ~40% complete (51 of 85 features "missing"). That is **not
accurate** — the builder editor, buyer corner, commerce depth, community, manual UPI,
and feature billing it called the "biggest gaps" are all implemented and wired. The real
remaining backlog is the short list in [Real backlog](#real-backlog), not 51 features.

## Status by phase

Legend: ✅ implemented & verified · 🟡 partial / nuance · ❌ genuinely missing · ❔ not verified this pass

### Phase 2 — Auth + Onboarding
- ✅ Supabase auth (email OTP + Google OAuth), `getUser()`-validated — `packages/auth/*`, each app's `middleware.ts`
- ✅ Onboarding flow — `apps/app/app/onboarding/`
- ✅ Profile — `apps/app/app/profile` path via dashboard
- ✅ Activity log for actions — `apps/app/app/activity/page.tsx` → `packages/db/src/activity.ts`
- ❔ Dedicated "business settings" page — not confirmed

### Phase 3 — Tenant + Subdomain
- ✅ Username selection + tenant creation — onboarding + `getTenantByOwnerId`, `Tenant.username @unique`
- ✅ Tenant public site by host — `apps/tenant/app/[slug]`, host resolution
- ✅ Domain management — `apps/app/app/domains/`

### Phase 4 — Plans + Usage
- ✅ Billing monthly/yearly — `apps/app/app/billing/`
- ✅ Usage limits table — `apps/app/app/usage/page.tsx` → `getTenantFeatureUsageSummary`
- 🟡 Upgrade page — billing covers upgrade; no separate `/upgrade` route
- ❔ Feature-level limit warnings beyond usage page — partial

### Phase 5 — Feature Billing (audit said "all missing" — FALSE)
- ✅ AI-page overage charge flow — `apps/app/app/ai-pages/actions.ts:51-66` (quota check) → `packages/db/src/feature.ts:202-291` `consumeFeature` (free-limit → base+GST → wallet debit → `FeatureCharge`, atomic). Price is admin-set via `FeatureRule.basePaise` (default ₹149), not hardcoded.
- ✅ Usage tracking — `FeatureUsage` per tenant/feature/month, shown on `/usage`
- 🟡 Feature purchase log — `FeatureCharge` rows written, but surfaced only as wallet transactions; no dedicated `/feature-payments` view
- ❌ Direct platform-gateway payment for features — only wallet debit works; direct path returns `payment_required` but is stubbed (`feature.ts:199`)

### Phase 6 — Wallet (audit said pause/warnings missing — mostly FALSE)
- ✅ Balance + transaction history — `apps/app/app/wallet/`, `packages/db/src/wallet.ts`
- ✅ Low-balance warning — `apps/app/app/components/LowBalanceBanner.tsx` on dashboard, fed by `getWalletStatus`
- ✅ Commission debit on paid order, visible to seller — `packages/db/src/payments.ts:796-841` (reason "Commission on sale")
- 🟡 "Checkout pause" — there is **no** hard block of buyer checkout at zero balance (by design — wallet holds only seller fee money, never buyer money). The real pause is **UPI auto-confirm** falling to a manual queue when DUE commission exceeds the ceiling (`payments.ts:1013, 1070`). Unpaid commission accrues as `CommissionStatus.DUE` and auto-settles on next top-up (`settleDueCommissions`).

### Phase 7 — Platform Gateway
- ✅ Platform Razorpay for subs/wallet top-up, HMAC-verified, idempotent — `apps/app/app/api/webhooks/razorpay/route.ts`, `PlatformOrder`, `PaymentEvent`
- ❔ Post-recharge invoice surfaced to user — `Invoice`/`invoices` route exist; not deep-verified end-to-end

### Phase 8 — Seller Gateway
- ✅ Razorpay connect (secret AES-256-GCM encrypted) — `apps/app/app/gateway/`, `SellerGateway.secretEnc`
- ✅ Manual UPI connect (audit said missing — FALSE) — `SellerUpi` + `gateway/UpiForm.tsx`; buyer UTR submit `apps/tenant/app/upi-actions.ts` → `autoConfirmOrHoldUpiOrder`, wired on 5 checkout surfaces
- ✅ Gateway health/status — `gateway/page.tsx`
- ❌ **Seller-facing webhook/event log view** — `PaymentEvent` exists but is admin-only; no seller view
- ❌ Cashfree / other providers — planned later

### Phase 9 — Products + Payment Pages + Checkout
- ✅ Products, payment pages, orders, abandoned checkouts, coupons, CSV export, order detail — `apps/app/app/{products,pay-pages,orders,abandoned,coupons}/`
- ✅ Wallet commission debit on order — see Phase 6 (`payments.ts:796-841`)
- ✅ Buyer receipt / access grant on PAID — `payments.ts:763,781` (enrolment + community membership in the paid transaction)

### Phase 10 — Buyer Corner (audit said "entire module missing" — FALSE)
- ✅ Seller buyer/CRM list with spend + order counts — `apps/app/app/contacts/page.tsx` → `packages/db/src/crm.ts`
- ✅ Buyer portal — `apps/tenant/app/account/*`: login (Google+OTP), orders, order detail w/ access control, downloads (signed URLs), courses, communities
- ✅ Buyer access management — `Enrolment` / `CommunityMembership` grants, attribution by profileId OR email (guest unlock on later sign-in)

### Phase 11 — AI Builder (audit said "core builder missing" — FALSE)
- ✅ AI generation (Claude `claude-opus-4-8`, json_schema output) — `apps/app/lib/ai.ts:58-105`
- ✅ Visual drag-and-drop block editor — `apps/app/app/ai-pages/[id]/edit/PageEditor.tsx` (reorder, 6 block types, live preview, image upload)
- ✅ Version history — `AiPageVersion` + restore UI; Templates (3); Themes (4 presets + accent picker)
- ❌ Mobile/desktop preview toggle — single desktop preview only
- 🟡 Route names `/dashboard/websites`, `/dashboard/builder/[pageId]` don't exist; functionality lives at `ai-pages/[id]/edit`

### Phase 12 — Store / Course / Forms / Bio / Community
- ✅ Public store + cart + checkout (server-trusted pricing, seller-gateway-direct) — `apps/tenant/app/{store,cart}/`, `/p /c /m` checkout routes
- ✅ Course lesson builder + enrolment-gated learning — `apps/app/app/courses/[id]/` (lessons, isPreview, sortOrder); buyer `apps/tenant/app/account/learn/[slug]`
- ✅ Lead forms + submissions view — `apps/app/app/forms/`, `forms/[id]`
- ✅ Bio link — `apps/app/app/bio/`, tenant `/bio`
- ✅ Community (audit said missing — FALSE) — seller `communities/`, tenant `/c/[slug]`, `/account/community`, membership grants on PAID

### Phase 13 — Tracking + Analytics
- ✅ Meta Pixel / Google Ads / GA4 / GTM / UTM builder — `apps/app/app/{tracking,utm}/`
- ✅ Analytics overview — `apps/app/app/analytics/`
- ✅ Page-level (Traffic → Top pages), Checkout funnel, Top campaigns/referrers — all present on `analytics/page.tsx` (audit called these missing — FALSE)
- ❌ Dedicated **store-** and **course-specific** analytics breakouts — genuinely absent
- ✅ "30d chart blank on load" bug — **fixed**: `apps/app/app/components/useChartResizeNudge.ts` (robust multi-frame re-measure for the `next/dynamic(ssr:false)` recharts container; replaced the flaky single-rAF nudge in both chart components)

### Phase 14 — Notifications (audit said prefs/logs missing — FALSE)
- ✅ Notifications page + email preference toggles + "Recent emails" send-log — `apps/app/app/notifications/` (`NotificationPreference`, `NotificationLog`)
- ✅ Email sending via Resend (no-op until `RESEND_API_KEY` set) — `packages/utils/src/email.ts`
- ❌ WhatsApp notifications — planned later

### Phase 15 — Custom Domains
- ✅ Add domain, DNS (TXT/A) instructions, verification status, primary selection — `apps/app/app/domains/page.tsx`, `setPrimaryDomain`
- 🟡 SSL status is **derived** from VERIFIED state ("HTTPS active"), not an independently tracked field

### Phase 17 — Activity Logs
- ✅ Seller activity log page (paginated, labelled) — `apps/app/app/activity/page.tsx`

## Real backlog

The genuinely missing / partial items that survived verification — this is the actual next-work list.

**Shipped on this branch:**
- ✅ **Dedicated feature-purchase log** (`/feature-payments`) — `FeatureCharge` rows surfaced directly with a tenant-scoped reader + nav link.
- ✅ **Builder mobile/desktop preview toggle** — viewport switch in the AI-page editor preview.
- ✅ **"Blank 30d chart on load" bug** — robust multi-frame re-measure (`useChartResizeNudge`).

**Still open:**
1. **Seller-facing gateway webhook/event log** — `PaymentEvent` model exists but is admin-only AND its `tenantId` is never populated today (webhook calls `claimPaymentEvent` without it); a real seller view needs either a money-path change to stamp `tenantId`, or a new seller-gateway webhook-capture layer. *(bigger than it looks — see note)*
2. **Direct platform-gateway payment for features** — only wallet debit works today; the direct-pay branch is stubbed in `feature.ts:286`.
3. **Store-** and **course-specific** analytics breakouts — overview/funnel/page/campaign analytics already exist; these two dedicated views do not.
4. **Later-phase, intentionally not built:** WhatsApp notifications, Cashfree/other gateway providers.

## How this was verified

Three independent read-only passes over the actual route tree and `packages/db` query layer
(`apps/{app,admin,tenant}/app/**`, `packages/db/src/**`), each instructed to distinguish a
real working flow from a stub and to cite file:line. Items left as ❔ were outside those passes.
