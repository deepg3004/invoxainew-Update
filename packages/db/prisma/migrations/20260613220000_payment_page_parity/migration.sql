-- Payment-page product parity: image, compare-at, access link, kind. Additive.
-- "ProductKind" enum already exists; reused for payment_pages.kind.
ALTER TABLE "payment_pages"
  ADD COLUMN "image_url" TEXT,
  ADD COLUMN "compare_at_paise" INTEGER,
  ADD COLUMN "access_url" TEXT,
  ADD COLUMN "kind" "ProductKind" NOT NULL DEFAULT 'DIGITAL';
