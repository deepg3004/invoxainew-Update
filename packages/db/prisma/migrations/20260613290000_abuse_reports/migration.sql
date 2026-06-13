-- Phase 16: public abuse/scam reports against a tenant store. Triaged by admins.

CREATE TYPE "AbuseStatus" AS ENUM ('NEW', 'REVIEWING', 'ACTIONED', 'DISMISSED');

CREATE TABLE "abuse_reports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" TEXT,
    "reporter_email" TEXT,
    "page_url" TEXT,
    "status" "AbuseStatus" NOT NULL DEFAULT 'NEW',
    "admin_note" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abuse_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "abuse_reports_status_created_at_idx" ON "abuse_reports" ("status", "created_at");
CREATE INDEX "abuse_reports_tenant_id_idx" ON "abuse_reports" ("tenant_id");

ALTER TABLE "abuse_reports"
  ADD CONSTRAINT "abuse_reports_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: deny-anon. Reports are inserted server-side via Prisma (owner role); the
-- anon storefront client never touches the table directly. Admins read/triage
-- server-side behind requireAdmin.
alter table public.abuse_reports enable row level security;
