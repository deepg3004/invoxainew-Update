-- Storefront announcement bar (optional). Additive, nullable.
ALTER TABLE "tenants"
  ADD COLUMN "announcement" TEXT,
  ADD COLUMN "announcement_link" TEXT;
