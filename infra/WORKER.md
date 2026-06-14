# Notification worker (BullMQ)

A standalone background worker that processes the InvoxAI **notifications** queue
(seller/buyer sale notifications + emails) off the request path, with retries.

It is **opt-in**. Until you install the worker AND turn on the flag, notifications
run **inline** exactly as before — deploying this code changes nothing in prod.

## What it is

- Queue + producer + worker live in `packages/jobs`.
- Producer: `enqueueSaleNotification()` — called by the tenant app **only when**
  `NOTIFICATIONS_USE_QUEUE=true`. If the enqueue fails (e.g. Redis down) the app
  falls back to running the notification inline, so nothing is ever dropped.
- Worker: `pnpm --filter @invoxai/jobs worker` (runs `tsx src/worker.ts`). It uses
  the existing `REDIS_URL` and runs the **same** `processSaleNotification` the
  inline path uses.

## Roll it out

1. **Install the systemd unit** (copy the repo's copy; adjust the node path in the
   file if your nvm version differs):

   ```sh
   cp /root/invoxai/infra/invox-worker.service /etc/systemd/system/invox-worker.service
   systemctl daemon-reload
   systemctl enable --now invox-worker
   systemctl status invox-worker          # expect: active (running), "worker ready"
   journalctl -u invox-worker -f          # watch jobs flow
   ```

2. **Turn the flag on** — add to the root `.env`:

   ```
   NOTIFICATIONS_USE_QUEUE=true
   ```

   then restart the tenant app so the producer starts enqueuing:

   ```sh
   systemctl restart invox-tenant
   ```

## Verify end-to-end

- Make a test sale (or re-confirm a UPI order). You should see `completed <jobId>`
  in `journalctl -u invox-worker`, and the same in-app notification + email rows
  in `notification_logs` as before.
- To roll back instantly: set `NOTIFICATIONS_USE_QUEUE=false` (or remove it) and
  `systemctl restart invox-tenant` — the app returns to the inline path; the
  worker can keep running harmlessly (it just sees no new jobs).

## Notes

- The job is keyed `sale:<buyerPaymentId>` so a duplicate enqueue for the same
  order is de-duplicated by BullMQ — matching the inline path's fire-once intent.
- Retries: 5 attempts, exponential backoff (2s base); failed jobs are kept 24h
  for inspection (`removeOnFail`), completed jobs pruned after 1h.
- Future: an admin "queue health" card (waiting/active/failed counts), and moving
  other event types (refunds, low-stock digests) onto the same queue.
