-- Custom domains (Phase 15): seller-connected domains for tenant sites.

-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('PENDING', 'VERIFIED');

-- CreateTable
CREATE TABLE "tenant_domains" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "domain" TEXT NOT NULL,
    "status" "DomainStatus" NOT NULL DEFAULT 'PENDING',
    "verify_token" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_domains_domain_idx" ON "tenant_domains"("domain");
CREATE UNIQUE INDEX "tenant_domains_tenant_id_domain_key" ON "tenant_domains"("tenant_id", "domain");

-- ISOLATION: at most one VERIFIED row per domain, so two tenants can never both
-- serve the same host. PENDING rows aren't constrained (a domain can be claimed
-- by several tenants until one proves control), which also avoids squatting.
CREATE UNIQUE INDEX "tenant_domains_domain_verified_key" ON "tenant_domains"("domain") WHERE "status" = 'VERIFIED';

-- AddForeignKey
ALTER TABLE "tenant_domains" ADD CONSTRAINT "tenant_domains_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: deny-anon lockdown. Read/written server-side via Prisma (seller CRUD,
-- tls-allow, host resolution), always scoped by tenant_id or matched by domain.
alter table public.tenant_domains enable row level security;
