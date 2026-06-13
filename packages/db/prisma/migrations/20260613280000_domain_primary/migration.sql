-- Phase 15 (slice 4): a tenant's canonical/preferred custom domain. Additive.
-- At most one primary per tenant (partial unique index, the same pattern as the
-- VERIFIED-domain index). Host resolution is unchanged — primary only affects
-- canonical links.

ALTER TABLE "tenant_domains"
  ADD COLUMN "is_primary" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "tenant_domains_tenant_primary_key"
  ON "tenant_domains" ("tenant_id") WHERE "is_primary" = true;
