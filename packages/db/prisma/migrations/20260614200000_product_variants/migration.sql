-- Product variants (Shopify-style size/color). Additive: a new table only → safe
-- for any running build. Checkout pricing integration is a SEPARATE later change.
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "price_paise" INTEGER NOT NULL,
    "stock_qty" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");
ALTER TABLE "product_variants"
    ADD CONSTRAINT "product_variants_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
