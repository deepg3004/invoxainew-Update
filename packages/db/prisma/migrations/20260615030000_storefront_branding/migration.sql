-- Storefront branding (audit batch 1): logo, hero banner, brand colour,
-- about-the-seller blurb, footer policy links, and store-level SEO. All
-- nullable, additive.
ALTER TABLE "tenants" ADD COLUMN "logo_url" TEXT;
ALTER TABLE "tenants" ADD COLUMN "banner_url" TEXT;
ALTER TABLE "tenants" ADD COLUMN "brand_color" TEXT;
ALTER TABLE "tenants" ADD COLUMN "about_text" TEXT;
ALTER TABLE "tenants" ADD COLUMN "privacy_url" TEXT;
ALTER TABLE "tenants" ADD COLUMN "refund_url" TEXT;
ALTER TABLE "tenants" ADD COLUMN "terms_url" TEXT;
ALTER TABLE "tenants" ADD COLUMN "store_meta_title" TEXT;
ALTER TABLE "tenants" ADD COLUMN "store_meta_description" TEXT;
