# InvoxAI

Multi-tenant SaaS: an AI website / store / course / payment-page builder where each
seller connects their **own** Razorpay gateway. InvoxAI never holds buyer money.

## Status: C1 — Foundation

Turborepo + pnpm monorepo. Four Next.js (App Router, TS strict) apps, shared packages,
Prisma → Supabase, Redis, and a `/health` probe in every app.

### Apps
| App                 | Dir           | Port | Domain                         |
| ------------------- | ------------- | ---- | ------------------------------ |
| Marketing + pricing | `apps/web`    | 3000 | `invoxai.io`                   |
| Seller dashboard    | `apps/app`    | 3001 | `app.invoxai.io`               |
| Platform admin      | `apps/admin`  | 3002 | `admin.invoxai.io`             |
| Public tenant pages | `apps/tenant` | 3003 | `username.invoxai.io`          |

### Packages
- `@invoxai/config` — zod-validated env (single root `.env`, server/public split).
- `@invoxai/db` — Prisma client singleton (pooled runtime URL, direct URL for migrations).
- `@invoxai/auth` — Supabase clients: `/client` (anon, browser) + `/server` (service-role, server-only).
- `@invoxai/utils` — Redis (ioredis) singleton.
- `@invoxai/ui` — shared React components.

### Setup
```bash
cp .env.example .env   # fill in Supabase + Redis values
pnpm install
pnpm db:generate       # generate Prisma client
pnpm dev               # all four apps
```
Then check each app's probe — e.g. http://localhost:3000/health — expect `{"ok":true}`.

### Commands
```bash
pnpm dev                 # run all apps
pnpm build               # build all
pnpm db:migrate          # create+apply a migration (uses DIRECT_URL)
pnpm db:studio           # inspect the DB
```

### Security notes baked into C1
- Single gitignored root `.env`; env validated at startup (fails loud with a list of missing vars).
- Service-role key only in `@invoxai/auth/server`, guarded by `import "server-only"` — it can never
  be bundled into client code. Browser code uses the anon key only.
- Prisma migrations go through `DIRECT_URL`; runtime uses the pooled `DATABASE_URL`.
