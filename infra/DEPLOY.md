# InvoxAI — VPS deployment notes

This VPS (`93.127.195.147`, Ubuntu 24.04) serves the four apps behind Caddy.

## Topology

```
Internet ──HTTPS──▶ Caddy (:80/:443) ──▶ Next.js apps (systemd)
                       invoxai.io / www  → 127.0.0.1:3000  invox-web
                       app.invoxai.io    → 127.0.0.1:3001  invox-app
                       admin.invoxai.io  → 127.0.0.1:3002  invox-admin
                       *.invoxai.io      → 127.0.0.1:3003  invox-tenant  (on-demand TLS)
```

## DNS required

A-records → `93.127.195.147`:
- `invoxai.io`, `www`, `app`, `admin` — already set.
- **`*.invoxai.io` (wildcard)** — REQUIRED for tenant subdomains; add at the DNS provider.

## Apps (systemd)

Units: `/etc/systemd/system/invox-{web,app,admin,tenant}.service`. Each runs
`pnpm start` (`next start -p <port>`) from its app dir with `NODE_ENV=production`.

```bash
systemctl status invox-app           # one app
systemctl restart invox-tenant       # restart after a rebuild
journalctl -u invox-app -f           # logs
```

### Hardening (interim — services still run as root, Phase 0)

Each unit has a sandboxing drop-in at
`/etc/systemd/system/invox-<svc>.service.d/hardening.conf` (repo copy:
`infra/systemd/invox-hardening.conf`). Node-safe set — deliberately omits
`MemoryDenyWriteExecute` (breaks V8 JIT) and `ProtectHome` (app lives under
`/root`). To (re)apply on a fresh box:

```bash
for s in web app admin tenant; do
  mkdir -p /etc/systemd/system/invox-$s.service.d
  cp infra/systemd/invox-hardening.conf /etc/systemd/system/invox-$s.service.d/hardening.conf
done
systemctl daemon-reload && systemctl restart invox-web invox-app invox-admin invox-tenant
```

**TODO (planned window): run services as non-root.** Blocked because the app
(`/root/invoxai`) and node (`/root/.nvm`) live under `/root` (700). Migration =
relocate app to `/opt/invoxai`, install system-wide node, chown to the `deep`
user, rewrite units (`User=deep`, new paths, `HOME=/home/deep`), move `.env`,
rebuild, restart.

## Deploy a new build

```bash
cd /root/invoxai
git pull                              # if applicable
pnpm install
pnpm db:generate                      # if schema changed
pnpm db:migrate                       # if there are new migrations (uses DIRECT_URL)
pnpm build                            # production build of all apps
systemctl restart invox-web invox-app invox-admin invox-tenant
systemctl reload caddy                # only if /etc/caddy/Caddyfile changed
```

## Monitoring & observability (Phase 1.4)

**Lightweight monitor** — `infra/monitor/healthcheck.mjs`, run every 5 min by the
`invox-monitor.timer` systemd timer (units in `infra/systemd/`). Pings all four
`/health` endpoints and runs DB anomaly checks (negative wallets, stuck CREATED
orders, low wallets, DUE-commission total); logs to the journal and exits
non-zero on failure. Set `ALERT_WEBHOOK_URL` in `.env` (e.g. a Slack incoming
webhook) to also receive POSTed alerts. Install on a fresh box:

```bash
cp infra/systemd/invox-monitor.{service,timer} /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now invox-monitor.timer
journalctl -u invox-monitor.service -f      # watch results
```

**Sentry** — the apps initialise Sentry server-side via `instrumentation.ts`,
env-gated on `SENTRY_DSN` (no-op when unset). Add `SENTRY_DSN` to `.env` and
redeploy to start reporting. Client-side capture + source-map upload would add a
`withSentryConfig` wrap in each `next.config.js` (a follow-up).

**Uptime** — point an external uptime monitor (UptimeRobot, BetterStack, etc.)
at `https://app.invoxai.io/health` (and admin/tenant/web), alerting on non-200 or
`ok:false`. This catches a full-box outage the on-box monitor can't report.

## Caddy

Config: `/etc/caddy/Caddyfile` (repo copy: `infra/Caddyfile`). TLS is automatic
(Let's Encrypt). Tenant subdomains use **on-demand TLS** gated by the tenant app's
`GET /api/tls-allow?domain=<host>` — it returns 200 only for hosts that map to a real
tenant, so certs are never issued for arbitrary domains pointed at this IP.

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
journalctl -u caddy -f
```

## Security TODO before real traffic

- `admin.invoxai.io` is internet-facing — must get auth/allow-listing before C3 adds
  real admin features (currently only a status page).
- Rotate the Supabase service-role key + DB password (shared in chat during setup).
- Swap `DATABASE_URL` to the Supabase Transaction Pooler for connection scaling.
- Configure Supabase custom SMTP (built-in email is rate-limited).
