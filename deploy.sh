#!/usr/bin/env bash
#
# InvoxAI deploy — run from the repo root on the VPS: ./deploy.sh
#
# Brings CODE, DB, and the RUNNING servers into lockstep, in the right order, so
# a stale build can never serve a client that's out of step with the schema
# (the cause of the two "Something went wrong on every page" outages). The order
# matters: migrate the DB and regenerate the client BEFORE the new build starts
# serving.
set -euo pipefail
cd "$(dirname "$0")"

echo "==> 1/5 install deps (frozen lockfile)"
pnpm install --frozen-lockfile

echo "==> 2/5 generate Prisma client (matches schema)"
pnpm db:generate

echo "==> 3/5 apply pending migrations (DB matches schema)"
pnpm prisma migrate deploy

echo "==> 4/5 build all apps"
pnpm build

echo "==> 5/5 reload servers (zero-downtime)"
if command -v pm2 >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js --update-env
  pm2 save
  echo "==> done — all apps reloaded onto the fresh build."
else
  echo "!! pm2 is not installed. One-time setup, then re-run ./deploy.sh:"
  echo "     npm install -g pm2"
  echo "     pm2 start ecosystem.config.js && pm2 save && pm2 startup"
  exit 1
fi
