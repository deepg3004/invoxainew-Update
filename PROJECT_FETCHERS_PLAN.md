# InvoxAI — Fetchers & Functions Plan (per-menu audit)

> Audited 2026-06-14 across all three apps (seller `apps/app`, `apps/admin`, buyer `apps/tenant`),
> walking every menu/route and checking the `@invoxai/db` fetchers + server actions each page uses.

> **Status (2026-06-14): all 9 gaps below are now built** (course review form, contacts CSV export,
> admin audit-logging on the 6 global-config mutations, and a global audit-log view on `/settings`).
> Typecheck 10/10, tests pass. No migration required. This doc is kept as the record of what was found/done.

## TL;DR

**The data layer is essentially complete.** Every menu page fetches real data and every
button/form is wired to a real server action backed by an actual `@invoxai/db` function.
The "Something went wrong on every page" you saw was **not** missing fetchers/functions — it
was a schema/DB mismatch (a migration I generated but hadn't applied). **That is now fixed**
(migration `20260614140000_feature_direct_payment` applied; `Database schema is up to date`).

So there is **no large "complete all fetchers" effort** — there are **9 specific gaps**, listed
below. Most menus need nothing.

## Menu-by-menu status

### Seller app (`apps/app`) — COMPLETE except 1
Overview `/` · Build (`/ai-pages`, `/bio`, `/storefront`) · Commerce (`/products`, `/coupons`,
`/courses`, `/communities`, `/pay-pages`, `/orders`, `/reviews`, `/abandoned`) · Money
(`/transactions`, `/wallet`, `/gateway`, `/billing`, `/invoices`, `/feature-payments`) · Grow
(`/forms`, `/contacts`, `/domains`, `/analytics`, `/tracking`, `/usage`, `/verification`, `/activity`)
— **all COMPLETE.** The Razorpay loop (order → checkout → verify/webhook → fulfilment, idempotent)
is wired across wallet, billing, and feature payments. **One gap: `/contacts` has no CSV export.**

### Admin app (`apps/admin`) — COMPLETE except audit-logging gaps
`/` · `/tenants` · `/tenants/[id]` · `/abuse-reports` · `/risk` · `/reports` · `/notifications`
(+`/templates`) · `/pricing` · `/features` · `/settings` · `/jobs` — **COMPLETE.** Every page enforces
`requireAdmin()` and every mutating action re-checks it (no auth-gate gaps). **Gaps:** global-config
mutations (plans, pricing, feature rules/limits) **don't write an `AdminAuditLog`** (unlike tenant-level
admin actions, which do); and a `/buyers/[id]` detail route doesn't exist (confirm if wanted).

### Buyer app (`apps/tenant`) — COMPLETE except 1
Storefront (`/`, `/[slug]`, `/store`, `/courses`, `/communities`) · detail+checkout (`/p`, `/c`, `/m`,
`/pay`, `/cart`) · payment APIs (`/api/pay/verify`, UPI) · buyer portal (`/account`, `/orders/[id]`,
`/learn/[slug]`, `/community/[slug]`) · `/f` `/bio` `/report-abuse` — **all COMPLETE**, host-resolved,
suspension-checked, ownership-gated. No stubs/TODOs anywhere. **One gap: the course review form is
built but never rendered on the learn page.**

## Gaps to build (the actual work-list)

Priority order. Each is small; none needs a migration except where noted.

| # | App | Gap | Fetcher/function to add | File | Effort |
|---|-----|-----|--------------------------|------|--------|
| 1 | tenant | **Course review form not mounted** — `ReviewForm kind:"course"`, `review-actions.ts`, `createCourseReview`/`getBuyerReviewForCourse` all exist; the form is just never rendered, so enrolled buyers can't review courses. | (none — wire existing) fetch `getBuyerReviewForCourse` + render `<ReviewForm kind="course" …>` | `apps/tenant/app/account/learn/[slug]/page.tsx` (~L86) | XS |
| 2 | app | **`/contacts` has no export** — every other valuable list (orders, invoices) exports CSV; contacts doesn't. | export route/action using existing `listContacts` + `lib/csv.ts` (`toCsv`/`csvResponse`); add "Export" button | `apps/app/app/contacts/` | S |
| 3 | admin | **`createPlan` unaudited** — platform-wide plan creation writes no `AdminAuditLog`. | add `adminEmail` param + audit write (`plan.create`) | `packages/db/src/pricing.ts:59` | S |
| 4 | admin | **`updatePlan` unaudited** — plan re-pricing/commission changes unlogged. | `adminEmail` + audit (`plan.update`) | `packages/db/src/pricing.ts:90` | S |
| 5 | admin | **`setPlanActive` unaudited** — retire/restore unlogged. | `adminEmail` + audit (`plan.retire`/`restore`) | `packages/db/src/pricing.ts:111` | S |
| 6 | admin | **`upsertPricingSetting` unaudited** — global price knobs (e.g. AI-page ₹149) unlogged; `upsertPlatformSettings` already audits, this is the inconsistency. | `adminEmail` + audit | `packages/db/src/pricing.ts:149` | S |
| 7 | admin | **`upsertFeatureRule` unaudited** — feature fee/GST/toggle changes unlogged. | `adminEmail` + audit | `packages/db/src/feature.ts:30` | S |
| 8 | admin | **`setPlanFeatureLimit` unaudited** — free-allowance changes unlogged. | `adminEmail` + audit | `packages/db/src/feature.ts:53` | S |
| 9 | admin | **Global audit-log view** — #3–#8 write rows with null `tenantId`, but `listAdminAuditLog` is tenant-scoped, so they'd be invisible. Needs a `listGlobalAdminAuditLog` reader + a place to show it (e.g. a tab on `/settings` or `/reports`). | `listGlobalAdminAuditLog()` | `packages/db/src/admin.ts` + an admin page | M |

> #3–#8 are one coherent change ("audit global config mutations"); the calling actions already
> have `gate.user.email`, so it's mostly threading `adminEmail` through + one `adminAuditLog.create`
> each. Do #9 alongside so the new entries are actually viewable.

## Not gaps (intentional — don't "fix")
- `/contacts` in-memory search over a 2000-row scan cap (contacts are derived, no table) — fine until scale.
- Invoice PDF is browser-print only (no server-side PDF) — works today.
- Abandoned-checkout auto-nudges await an email-provider + scheduled job (manual recovery works; honest feature flag).
- No `/account/orders` list page — the `/account` dashboard renders the full orders table inline by design.
- Lesson progress tracking — no `LessonProgress` model; consistent with the text-based MVP. Build only if required.
- Product list could show units-sold/rating (`getProductSalesCounts`/`getProductRatingSummaries` exist, unused) — optional enrichment, not a gap.

## Recommended order
1. **#1** (XS, real user-facing feature) → **#2** (S, quick win).
2. **#3–#8 + #9** as one "admin audit-logging" change (compliance/trust; all small, shared shape).
