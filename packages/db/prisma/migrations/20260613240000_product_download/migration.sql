-- Hosted digital downloads: private file key + original name on products. Additive.
ALTER TABLE "products"
  ADD COLUMN "download_key" TEXT,
  ADD COLUMN "download_name" TEXT;
