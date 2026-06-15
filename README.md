# InvoxAI

**An AI website / store / course / payment-page builder with a seller-owned payment gateway.**

Each seller connects their **own** Razorpay account, so buyer money flows directly to the
seller — InvoxAI never holds funds and takes its cut as a transparent commission. Sellers
build premium, fully-themed pages with an AI block builder, sell digital products, courses,
communities, workshops and 1-on-1 bookings, and grow with built-in marketing tooling.

> Monorepo snapshot — Turborepo + pnpm, four Next.js (App Router, TypeScript strict) apps
> over shared packages, Prisma → Supabase (Postgres), Redis, and Anthropic Claude.

---

## Apps

| App                 | Dir           | Port | Domain                  | What it is                                    |
| ------------------- | ------------- | ---- | ----------------------- | --------------------------------------------- |
| Marketing + pricing | `apps/web`    | 3000 | `invoxai.io`            | Public marketing site                         |
| Seller dashboard    | `apps/app`    | 3001 | `app.invoxai.io`        | Where sellers build & run their business      |
| Platform admin      | `apps/admin`  | 3002 | `admin.invoxai.io`      | Operator console (plans, KYC, cron, control)  |
| Public tenant store | `apps/tenant` | 3003 | `{username}.invoxai.io` | Each seller's live, themed storefront & pages |

## Packages

- `@invoxai/db` — Prisma client + schema (pooled runtime URL, direct URL for migrations).
- `@invoxai/auth` — Supabase clients: anon (browser) + service-role (`server-only`).
- `@invoxai/utils` — the page-builder trust boundary (`normalizeToBlocks`), the theme system
  (`THEME_PRESETS`, `THEME_LIBRARY`, `resolveTheme`, `themeCss`), money helpers, Redis.
- `@invoxai/ui` — shared design-system React components (dashboard shell, cards, forms).
- `@invoxai/jobs` — background sweeps (abandoned-cart recovery, sequences, broadcasts).
- `@invoxai/config` — zod-validated env (single root `.env`, server/public split).

---

## Feature highlights

**Builder & design**
- AI page generation from a brief, then a block editor (~29 block types) with live preview.
- A premium theme system: **24 themes** × per-page token overrides, animated backgrounds,
  curated font pairings, gradient/shimmer CTAs — applied consistently across every public page.
- Starter templates + an admin-authored template marketplace (free & premium).
- A guided create flow that requires picking a **theme + starting point** before publishing.

**Commerce (seller-owned gateway)**
- Products (digital/file), courses, communities, workshops, 1-on-1 bookings.
- Storefront with branding (logo, banner, brand colour, about, policies, SEO), coupons,
  upsells/order bumps, reviews, cart & checkout, abandoned-checkout recovery.
- Integer-paise money throughout; idempotent "claim-winner" payment effects so a payment is
  never double-counted and never lost.

**Growth & operations**
- Email sequences, broadcasts, A/B tests, affiliates, contacts/CRM, support tickets.
- Analytics + ad tracking (Meta Pixel, GA4, Google Ads, GTM, TikTok) with UTM/click capture.
- Buyer account portal (orders, learning, community, bookings, support).
- Wallet + commission, feature-usage billing, GST tax invoices, custom domains, KYC verification.

**Security model**
- Multi-tenant isolation enforced in the application layer; every seller-scoped query is keyed
  by a server-resolved `tenantId` — never a tenant id from request input.
- The service-role key lives only behind `import "server-only"`; browser code uses the anon key.
- All builder content is re-validated & sanitized server-side (safe URLs, allow-listed blocks
  and fonts) before storage — the editor can't persist an unknown block or a `javascript:` URL.
- Single git-ignored root `.env`, validated at startup; migrations run via `DIRECT_URL`,
  runtime uses the pooled `DATABASE_URL`.

---

## Getting started

```bash
cp .env.example .env     # fill in Supabase, Redis, Anthropic, Razorpay values
pnpm install
pnpm db:generate         # generate the Prisma client
pnpm dev                 # run all four apps
```

Each app exposes a health probe — e.g. http://localhost:3000/health → `{"ok":true}`.

### Common commands

```bash
pnpm dev                 # run all apps (turbo)
pnpm build               # production build of everything
pnpm typecheck           # tsc --noEmit across the monorepo
pnpm test                # vitest
pnpm db:migrate          # create + apply a migration (uses DIRECT_URL)
pnpm db:deploy           # apply pending migrations (prod)
pnpm db:studio           # inspect the database
```

## Tech stack

Next.js (App Router) · TypeScript (strict) · Turborepo + pnpm · Prisma + Supabase (Postgres) ·
Redis · Anthropic Claude · Tailwind CSS · Razorpay.

---

_Requires Node ≥ 20 and pnpm 11. This repository is a project snapshot; secrets are kept in a
git-ignored `.env` and are not part of the codebase._
