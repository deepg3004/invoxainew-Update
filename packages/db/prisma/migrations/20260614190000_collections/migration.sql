-- Storefront collections/categories (Shopify-style). Additive: a new table +
-- a nullable products.collection_id FK (SET NULL on delete) → safe for any
-- running build (products stay valid; uncategorised = null).
CREATE TABLE "collections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "collections_tenant_id_idx" ON "collections"("tenant_id");
ALTER TABLE "collections"
    ADD CONSTRAINT "collections_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "products" ADD COLUMN "collection_id" UUID;
ALTER TABLE "products"
    ADD CONSTRAINT "products_collection_id_fkey"
    FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
