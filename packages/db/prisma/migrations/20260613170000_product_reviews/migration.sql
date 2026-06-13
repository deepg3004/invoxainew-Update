-- Verified-purchase product reviews. New table; additive.

CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED', 'HIDDEN');

CREATE TABLE "product_reviews" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "buyer_profile_id" UUID NOT NULL,
    "author_name" TEXT,
    "rating" INTEGER NOT NULL,
    "body" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

-- One review per buyer per product.
CREATE UNIQUE INDEX "product_reviews_product_id_buyer_profile_id_key" ON "product_reviews"("product_id", "buyer_profile_id");
CREATE INDEX "product_reviews_product_id_status_idx" ON "product_reviews"("product_id", "status");
CREATE INDEX "product_reviews_tenant_id_created_at_idx" ON "product_reviews"("tenant_id", "created_at");

ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- tenantId is denormalised (scalar in Prisma); FK enforced here like other aux tables.
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: deny-anon. Public render + buyer writes go through Prisma (owner role).
alter table public.product_reviews enable row level security;
