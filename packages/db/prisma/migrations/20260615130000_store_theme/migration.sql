-- Premium theme system: the storefront's chosen theme preset slug. Additive,
-- nullable, no data change.
ALTER TABLE "tenants" ADD COLUMN "store_theme" TEXT;
