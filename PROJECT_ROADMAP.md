# InvoxAI — Repo-Grounded Roadmap (reconciling the Final Plan with reality)

> Review of the 41-section "Final InvoxAI Project Plan" against the **actual** codebase
> (audited 2026-06-14: 52 Prisma models, 4 apps, full menu walk). Read this before treating
> the Final Plan as a build list — large parts are already done, and some of its assumptions
> about "what the repo already has" are incorrect.

## Headline

1. **Do NOT start a new project.** The Final Plan's §3 says "use this structure for the new project" — but this repo already IS that structure (`apps/web|app|admin|tenant`, `packages/*`) and is far along.
2. **The MVP (§40, 16 items) is ~100% built** — see the table below.
3. **The plan's schema list (§37) is wrong for this repo.** It lists ~20 tables that don't exist here (`ai_agents`, `auto_dm_sequences`, `referrals`, `funnel_templates`, `kyc_profiles`, `Store`, `subscription_members`, `payment_disputes`, multi-provider gateways…). The real schema uses different, already-built models (`Tenant`, `Product`, `Course`, `Community`, `BuyerPayment`, `Wallet`, `SellerGateway`, `AiPage`, `KycDocument`, etc.). Don't "add" tables that exist; don't assume features the plan claims are present.

## §40 MVP scope — status: 16 / 16 DONE

| # | MVP item | Status | Where |
|---|----------|--------|-------|
| 1 | Signup / login | ✅ | Supabase auth (`packages/auth`) |
| 2 | `username.invoxai.io` | ✅ | `Tenant` + host resolve |
| 3 | User dashboard | ✅ | `apps/app` |
| 4 | Admin dashboard | ✅ | `apps/admin` |
| 5 | Admin plan editor | ✅ | `/admin/plans` (+ audit logging) |
| 6 | Feature billing | ✅ | `consumeFeature`, `/usage`, `/feature-payments` |
| 7 | Wallet recharge | ✅ | platform-gateway top-up |
| 8 | Seller Razorpay connect | ✅ | `/gateway` (AES-256-GCM secret) |
| 9 | Product / payment page | ✅ | `/products`, `/pay-pages` |
| 10 | Buyer checkout | ✅ | seller gateway + cart + manual UPI |
| 11 | Payment success | ✅ | verify route + webhook (idempotent) |
| 12 | Wallet commission debit | ✅ | `applyPaidEffects` (atomic, M1 fixed) |
| 13 | AI page generation ₹149 | ✅ | `consumeFeature` + **direct-pay (#2) now built** |
| 14 | Buyer Google login | ✅ | tenant `/account` (Google + OTP) |
| 15 | Meta Pixel + GA4 | ✅ | `/tracking` |
| 16 | Basic analytics | ✅ | `/analytics` |

**You are at/past MVP.** Plus extras beyond MVP already built: courses+lessons, communities, coupons, reviews, bio link, lead forms, abandoned-cart, invoices (GST), domains, KYC upload+review, risk/abuse, activity+audit logs, GTM/Google-Ads/UTM tracking.

## The 5 engines (§41) — what's real

| Engine | Built | Not built (net-new) |
|--------|-------|---------------------|
| **Seller** | builder (AI pages), products, store, courses, payment pages, gateway connect, analytics | multi-page "sites", funnels module, richer builder widgets |
| **Buyer** | Google/OTP login, orders, courses, downloads, communities, receipts | login-logs model, support tickets |
| **Revenue** | plans, wallet, commission, AI-page ₹149, feature billing, **direct-pay**, invoices | premium-template sales, AI-credits product, add-on SKUs |
| **Marketing** | Meta/GA4/GTM/Google-Ads, UTM builder, campaign + funnel + page analytics | store/course-specific analytics breakouts |
| **Admin** | plans, pricing, feature rules, wallets, gateways, tenants, buyers (search), domains, tracking, risk, notifications, **audit logs (global)** | functional sub-roles (Ops/Finance/Support/Marketing), team members |

## Genuinely NOT built (net-new work — prioritized)

These are real, and most are **post-MVP / optional**, not blockers:

### Tier 1 — small, real gaps (finish the existing surfaces)
1. **Store- & course-specific analytics** breakouts (overview/funnel/page/campaign already exist).
2. **Lesson progress tracking** (no `LessonProgress` model; lessons are all-visible today).
3. **Server-side invoice PDF** (currently browser-print).
4. **Abandoned-cart auto-nudges** (needs the email worker + a schedule; manual recovery works).

### Tier 2 — net-new modules (each is a real project slice + migration)
5. **WhatsApp + SMS notification sending** — channels are modeled, only **email (Resend)** actually sends. Needs a provider integration per channel.
6. **Multi-provider seller gateways** — only **Razorpay + manual UPI** exist. Cashfree/PhonePe/PayU/Stripe/PayPal are net-new adapters (the `SellerGateway` abstraction helps, but each needs a provider module + webhook).
7. **Richer AI builder** — current editor has 6 block types (heading/text/image/button/video/divider) and single pages. The plan's 20+ widgets (pricing table, FAQ, testimonials, countdown, in-page forms, product/course cards, header/footer) + **multi-page sites** are net-new.
8. **Template / theme marketplace** — today: 4 code theme presets + 3 starter templates (in code). The plan's DB-backed, admin-managed, free/premium marketplace is net-new (needs `Template`/`Theme` models + admin CRUD + purchase flow).
9. **Course depth** — drip content, certificates, protected HLS video are net-new (schema + player work).

### Tier 3 — larger / later (clearly post-MVP)
10. **AI chatbot/agents** (§27), **Auto-DM + social posts** (§28), **Referrals/affiliates** (§29) — none exist; each is a full module. Defer.
11. **Admin functional sub-roles** (Ops/Finance/Support/Marketing) + **team members per tenant** — today admin is a single allowlist tier; this is a permissions/RBAC project.
12. **Marketing site (`apps/web`) content** — confirm which of Home/Features/Pricing/Templates/Demo/Contact/Terms/Privacy/Refund/About/FAQ actually exist; likely several are stubs. (Not audited in depth this session.)

## Recommended plan (realistic, repo-grounded)

**Phase A — polish to launch (days):** Tier 1 (#1–#4) + confirm `apps/web` marketing pages exist. This makes the *current* product fully launch-ready. Nothing here needs a big migration.

**Phase B — revenue depth (1–2 wk):** template/theme marketplace (#8) + premium-template/add-on SKUs — these directly add the revenue lines in §2 you don't yet monetize. Reuses the feature-billing + direct-pay rails just built.

**Phase C — reach (2–4 wk):** WhatsApp/SMS (#5) + one extra gateway, Cashfree (#6) — broadens notifications and payment coverage.

**Phase D — builder maturity (3–6 wk):** richer widgets + multi-page sites (#7), course depth (#9). This is the biggest engineering lift; sequence it after revenue/reach.

**Phase E — later:** AI agents / Auto-DM / referrals / RBAC sub-roles (#10–#11). Defer until the core is monetizing.

## Working rules to avoid the recurring "Something went wrong" error
- Every schema change = **`prisma migrate deploy` applied to the DB AND a fresh `next build` + restart**, in lockstep. The two outages this session were both stale-build / unapplied-migration mismatches, never missing code.
- Move the `next start` processes under **pm2** (or systemd) with `pnpm build` in the deploy step, so a deploy can't leave a stale build serving.

## Bottom line
The Final Plan is a good *north star*, but as a build list it's misleading: ~80% of it (and 100% of the MVP) is already implemented. The honest remaining work is the ~12 net-new items above — almost all post-MVP. Build Phase A, ship, then monetize with Phase B.
