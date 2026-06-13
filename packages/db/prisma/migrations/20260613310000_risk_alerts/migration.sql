-- Phase 16: admin-facing risk alerts, derived from existing data. Additive.

CREATE TYPE "RiskSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "RiskStatus" AS ENUM ('OPEN', 'DISMISSED', 'RESOLVED');

CREATE TABLE "risk_alerts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "RiskSeverity" NOT NULL DEFAULT 'MEDIUM',
    "detail" TEXT NOT NULL,
    "status" "RiskStatus" NOT NULL DEFAULT 'OPEN',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "risk_alerts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "risk_alerts_tenant_id_type_key" ON "risk_alerts" ("tenant_id", "type");
CREATE INDEX "risk_alerts_status_idx" ON "risk_alerts" ("status");

ALTER TABLE "risk_alerts"
  ADD CONSTRAINT "risk_alerts_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: deny-anon. Generated/read/triaged server-side via Prisma (admin).
alter table public.risk_alerts enable row level security;
