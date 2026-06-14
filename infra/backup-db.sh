#!/usr/bin/env bash
#
# InvoxAI database backup — a logical (pg_dump) backup of the application data
# (the `public` schema, including its RLS policies), gzipped and timestamped, with
# day-based retention. This SUPPLEMENTS Supabase's own managed backups with a copy
# you control and can move offsite.
#
# Usage:   infra/backup-db.sh
# Env:     INVOX_BACKUP_DIR (default /root/invox-backups)
#          INVOX_BACKUP_RETENTION_DAYS (default 14)
#          INVOX_ENV_FILE (default <repo>/.env)
#
# Restore (to a fresh/empty Postgres): see infra/BACKUP.md.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${INVOX_ENV_FILE:-$REPO_ROOT/.env}"
BACKUP_DIR="${INVOX_BACKUP_DIR:-/root/invox-backups}"
RETENTION_DAYS="${INVOX_BACKUP_RETENTION_DAYS:-14}"

if [ ! -f "$ENV_FILE" ]; then
  echo "backup-db: env file not found at $ENV_FILE" >&2
  exit 1
fi

# Prefer the DIRECT connection (DIRECT_URL) — pg_dump over the pgbouncer pooler is
# unreliable. Fall back to DATABASE_URL. Strip surrounding quotes; keep everything
# after the first '=' (the URL itself contains '=' in query params).
read_var() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
DB_URL="$(read_var DIRECT_URL)"
[ -z "$DB_URL" ] && DB_URL="$(read_var DATABASE_URL)"
if [ -z "$DB_URL" ]; then
  echo "backup-db: neither DIRECT_URL nor DATABASE_URL set in $ENV_FILE" >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "backup-db: pg_dump not installed. Run: apt-get install -y postgresql-client" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/invoxai-$TS.sql.gz"
TMP="$OUT.tmp"

# Dump to a temp file and only promote it on success, so a failed dump never
# leaves a corrupt/partial backup behind. `set -o pipefail` makes the pipe fail
# if pg_dump fails even though gzip succeeds.
cleanup() { rm -f "$TMP"; }
trap cleanup EXIT
set -o pipefail

# --schema=public  → our application data + RLS policies (Supabase manages auth/
#                    storage schemas + their own backups).
# --no-owner/--no-privileges → restorable to a fresh DB without our exact roles.
pg_dump "$DB_URL" --schema=public --no-owner --no-privileges | gzip > "$TMP"
mv "$TMP" "$OUT"

# Prune backups older than the retention window.
find "$BACKUP_DIR" -name 'invoxai-*.sql.gz' -type f -mtime +"$RETENTION_DAYS" -delete

echo "backup-db: wrote $OUT ($(du -h "$OUT" | cut -f1)); kept $(ls -1 "$BACKUP_DIR"/invoxai-*.sql.gz 2>/dev/null | wc -l) file(s)"

# --- Optional offsite copy ---------------------------------------------------
# The local backups live on the same VPS disk as everything else, so a disk loss
# takes them with it. Push a copy to a remote you control (any rclone backend:
# S3/B2/R2/Drive/SFTP…). One-time setup:
#   apt-get install -y rclone
#   rclone config                       # create a remote, e.g. "offsite"
# then set INVOX_OFFSITE_REMOTE (env or a systemd drop-in), e.g.
#   INVOX_OFFSITE_REMOTE=offsite:invoxai-backups
# Left unset → this step is skipped, so the backup behaves exactly as before.
OFFSITE_REMOTE="${INVOX_OFFSITE_REMOTE:-}"
if [ -n "$OFFSITE_REMOTE" ]; then
  if ! command -v rclone >/dev/null 2>&1; then
    echo "backup-db: INVOX_OFFSITE_REMOTE set but rclone not installed (apt-get install -y rclone)" >&2
    exit 1
  fi
  # `copy` is additive — it never deletes remote history, so offsite retention is
  # your remote's policy, independent of the local RETENTION_DAYS window.
  rclone copy "$BACKUP_DIR" "$OFFSITE_REMOTE" --include 'invoxai-*.sql.gz' --no-traverse
  echo "backup-db: offsite copy to $OFFSITE_REMOTE complete"
else
  echo "backup-db: offsite copy skipped (set INVOX_OFFSITE_REMOTE to enable — see infra/BACKUP.md)"
fi
