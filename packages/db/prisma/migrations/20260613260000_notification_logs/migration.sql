-- Phase 14 (slice 2): outbound-notification log (email now; more channels later).
-- Append-only, best-effort — written after the money path, never blocks a payment.

CREATE TABLE "notification_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "event_type" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "status" TEXT NOT NULL,
    "provider_message_id" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_logs_tenant_id_created_at_idx"
  ON "notification_logs" ("tenant_id", "created_at");

ALTER TABLE "notification_logs"
  ADD CONSTRAINT "notification_logs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: deny-anon. Written/read server-side via Prisma owner role.
alter table public.notification_logs enable row level security;
