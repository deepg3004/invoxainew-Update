# Deploying InvoxAI

## The one rule that prevents the "Something went wrong on every page" outage

The apps run as **`next start` production builds** — a running server serves a
**frozen build** and never picks up code changes or `prisma generate` on its own.
Both outages this session were the same cause: a code/schema change landed but the
running build wasn't rebuilt, or a migration wasn't applied, so the bundled Prisma
client asked Postgres for columns that didn't exist → every data page threw.

**So CODE, DB, and the RUNNING SERVERS must move together, in this order:**

1. generate the Prisma client (matches the schema)
2. `prisma migrate deploy` (DB matches the schema)
3. `pnpm build` (build bundles the correct client)
4. restart/reload the servers (serve the fresh build against the migrated DB)

`deploy.sh` does exactly this. **Never** `git pull` + leave the old `next start`
running, and never run `prisma generate`/change the schema without applying the
migration and rebuilding.

## First-time setup (once)

```bash
npm install -g pm2
pm2 start ecosystem.config.js   # starts web/app/admin/tenant on 3000–3003
pm2 save && pm2 startup          # survive reboots
```

## Every deploy after that

```bash
./deploy.sh
```

That runs: install → generate client → migrate deploy → build → `pm2 reload`
(zero-downtime). If pm2 isn't installed it prints the setup command and stops.

## Ports

| App | Port | URL |
|-----|------|-----|
| web (marketing) | 3000 | invoxai.io |
| app (seller dashboard) | 3001 | app.invoxai.io |
| admin | 3002 | admin.invoxai.io |
| tenant (public stores) | 3003 | username.invoxai.io |

## Handy pm2 commands

```bash
pm2 status                 # see all apps
pm2 logs invox-app         # tail the seller app
pm2 reload invox-app       # reload one app
pm2 restart all            # hard restart everything
```
