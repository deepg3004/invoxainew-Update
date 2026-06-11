-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('DIGITAL', 'PHYSICAL', 'SERVICE');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price_paise" INTEGER NOT NULL,
    "image_url" TEXT,
    "kind" "ProductKind" NOT NULL DEFAULT 'DIGITAL',
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "stock_qty" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "products_tenant_id_status_idx" ON "products"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenant_id_slug_key" ON "products"("tenant_id", "slug");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS for products. Deny-anon lockdown (RLS on, NO policies): the browser/anon
-- role can neither read nor write. The seller app and the public storefront both
-- read/write through Prisma's owner role (which bypasses RLS), always scoped by
-- tenant_id in the query. A public "published products" read policy can be added
-- later if anon clients ever need direct catalog reads.
alter table public.products enable row level security;
