-- Products depth (audit batch 3): gallery images, tags, and per-product SEO.
-- Arrays default to empty; SEO fields nullable. All additive.
ALTER TABLE "products" ADD COLUMN "gallery_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "products" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "products" ADD COLUMN "meta_title" TEXT;
ALTER TABLE "products" ADD COLUMN "meta_description" TEXT;
