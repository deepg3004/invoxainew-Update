# Release runbook — post-audit batches 1–12 (2026-06-15)

Deploy checklist for the work on `feature/post-audit-improvements`. This is the
release-specific list; the box/topology/services reference is `infra/DEPLOY.md`.

> Run everything from `/root/invoxai` on the VPS. Take a DB backup first
> (`infra/backup-db.sh`) — all migrations below are additive, but back up anyway.

## 0. Get the code onto the box

The repo has no git remote, so push/pull isn't available. Get this branch onto the
VPS however you normally sync (e.g. `git pull` if you add a remote, or copy the
tree). Confirm you're on the right commit:

```bash
git log --oneline -1   # expect: a868eec feat(quizzes)…  (or later)
```

## 1. Install + generate

```bash
pnpm install
pnpm db:generate        # regenerate the Prisma client from the new schema
```

## 2. Apply the 11 new migrations  ⚠️ production-safe command

Use **`db:deploy`** (runs `prisma migrate deploy` — applies pending migrations only,
never resets). Do NOT use `db:migrate` (that's `migrate dev`, for local only).

```bash
pnpm db:status          # should list the 10 below as "not yet applied"
pnpm db:deploy
```

The 11 pending migrations (all additive — new tables/columns only, no destructive
changes):

| # | Migration | Adds |
|---|-----------|------|
| 1 | `20260615020000_bio_socials_theme` | bio TikTok/LinkedIn/Threads + theme colour |
| 2 | `20260615030000_storefront_branding` | logo/banner/brand colour/about/policies/SEO |
| 3 | `20260615040000_coupon_restrictions` | per-customer limit, first-order-only, product-specific |
| 4 | `20260615050000_product_depth` | gallery, tags, per-product SEO |
| 5 | `20260615060000_form_powerups` | notify-on-submit, redirect URL |
| 6 | `20260615070000_broadcasts` | email broadcasts (2 tables) |
| 7 | `20260615080000_workshops` | live workshops (2 tables + buyer_payments.workshop_id) |
| 8 | `20260615090000_certificates` | course certificates (1 table + courses.certificate_enabled) |
| 9 | `20260615100000_file_assets` | media library (1 table) |
| 10 | `20260615110000_quizzes` | per-lesson quizzes (3 tables) |
| 11 | `20260615120000_bookings` | 1-on-1 bookings (3 tables + buyer_payments.booking_slot_id) |

## 3. Build + restart

```bash
pnpm build
systemctl restart invox-web invox-app invox-admin invox-tenant
```

## 4. Environment keys (set in `.env`, then rebuild/restart)

Most features work after the migrations. These keys unlock the email + scheduled
parts. All are **optional/no-op until set** — nothing breaks without them.

| Key | Unlocks | Notes |
|-----|---------|-------|
| `RESEND_API_KEY` | Broadcasts, abandoned-cart recovery, email sequences | Until set, sends are "skipped" (logged), not failed |
| `EMAIL_FROM` | The From address on those emails | Defaults to `InvoxAI <noreply@invoxai.io>`; must be a Resend-verified sender |
| `CRON_SECRET` | The scheduled sweeps (below) | Endpoints return 503 until set |

Razorpay LIVE keys + UPI ID are configured per-seller in the dashboard (the seller's
own gateway) — not platform `.env`.

## 5. Schedule the cron sweeps (for broadcasts / recovery / sequences)

Point an external scheduler (cron, GitHub Actions, Uptime cron, etc.) at these,
every ~5–15 min, with header `Authorization: Bearer <CRON_SECRET>`:

```
POST https://app.invoxai.io/api/cron/broadcasts     # delivers queued broadcasts (batch 8)
POST https://app.invoxai.io/api/cron/recovery       # abandoned-cart recovery
POST https://app.invoxai.io/api/cron/sequences       # drip email sequences
```

(These live in the admin app's API routes; same `CRON_SECRET` for all three.)

## 6. Post-deploy smoke checks

```bash
pnpm db:status            # all migrations applied
curl -s https://app.invoxai.io/health     # ok:true
```

Then in the dashboard, confirm the new nav + pages render:
- **Build → Media library** (`/media`) — upload a file, see usage bar
- **Commerce → Workshops** (`/workshops`) — create a draft
- **Grow → Broadcasts** (`/broadcasts`) — compose a draft (banner shows if no RESEND key)
- **Courses → edit a course** — "Issue a completion certificate" toggle; **edit a
  lesson** — the Quiz editor
- A published AI page renders the new premium blocks (hero / pricing / gallery / …)
- Admin app: **Growth → Broadcasts** oversight

## What shipped in this release (batches 1–12)

Storefront branding · coupon power-ups · product depth · form power-ups · bio
socials · **premium builder blocks** (hero, pricing table, feature grid, stats,
gallery, logo strip, image+text) + 4 premium themes · public-page polish ·
**Broadcasts** (email marketing) · **Workshops** (live sessions) · **Certificates**
(course completion) · **Media library** (cloud storage) · **Quizzes** (per-lesson) ·
**1-on-1 Bookings** (consultations with time slots).

Deferred (not in this release): Team/RBAC, withdrawals/payouts, dedicated Buyer model.
