# Database backups

`infra/backup-db.sh` takes a logical (`pg_dump`) backup of the application data —
the **`public` schema, including its RLS policies** — gzipped, timestamped, with
day-based retention. It SUPPLEMENTS Supabase's own managed backups with a copy you
control and can move offsite.

What it does NOT include: Supabase-managed schemas (`auth`, `storage`, …). Those
hold buyer/seller login accounts and uploaded files and are covered by Supabase's
own backups. `public.profiles.id` mirrors `auth.users.id`, so a full disaster
recovery also needs Supabase Auth restored (via the Supabase dashboard/support).

## One-time setup on the VPS

1. **Install the Postgres 17 client** (the Supabase server is PG17; an older
   `pg_dump` refuses to dump a newer server). Ubuntu 24.04's default repo only ships
   v16, so add the official PGDG repo:

   ```bash
   apt-get install -y curl ca-certificates gnupg lsb-release
   install -d /usr/share/postgresql-common/pgdg
   curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
     https://www.postgresql.org/media/keys/ACCC4CF8.asc
   echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
     > /etc/apt/sources.list.d/pgdg.list
   apt-get update && apt-get install -y postgresql-client-17
   ```

2. **Verify a manual backup works:**

   ```bash
   bash /root/invoxai/infra/backup-db.sh
   ls -lh /root/invox-backups/
   ```

3. **Schedule it daily** with the provided systemd timer:

   ```bash
   cp /root/invoxai/infra/invox-backup.service /etc/systemd/system/
   cp /root/invoxai/infra/invox-backup.timer   /etc/systemd/system/
   systemctl daemon-reload
   systemctl enable --now invox-backup.timer
   systemctl list-timers invox-backup.timer    # confirm next run
   ```

   (Or a cron equivalent: `30 2 * * * /root/invoxai/infra/backup-db.sh >> /var/log/invox-backup.log 2>&1`)

## Configuration

- `INVOX_BACKUP_DIR` — where backups are written (default `/root/invox-backups`).
- `INVOX_BACKUP_RETENTION_DAYS` — prune older than N days (default `14`).
- The DB URL is read from the repo `.env` (`DIRECT_URL`, falling back to
  `DATABASE_URL`). The direct connection is used because `pg_dump` over the pgbouncer
  pooler is unreliable.

## Offsite copy (recommended)

Keep at least one copy off the VPS — e.g. nightly `rsync`/`scp` of
`/root/invox-backups/` to another host, or push to object storage (S3/B2). A backup
that only lives on the same server doesn't protect against losing that server.

## Restore

To a **fresh / empty** Postgres database (e.g. a new Supabase project or a local
PG17), restore the public schema:

```bash
gunzip -c /root/invox-backups/invoxai-YYYYMMDD-HHMMSS.sql.gz | psql "<TARGET_DIRECT_URL>"
```

Notes:
- The dump uses `--no-owner --no-privileges`, so it restores under the connecting
  role without needing the original roles.
- Restore into an EMPTY public schema. To wipe first (DESTRUCTIVE):
  `psql "<URL>" -c 'drop schema public cascade; create schema public;'`
- For full DR, also restore Supabase Auth/Storage from Supabase's own backups, then
  re-apply any extensions the app relies on.
- Test a restore into a throwaway database periodically — an untested backup isn't a
  backup.
