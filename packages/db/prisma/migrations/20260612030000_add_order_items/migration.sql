-- Store slice 3: multi-item (cart) order lines.
-- Additive only: creates the order_items table. BuyerPayment gains no columns
-- (the new orderItems relation is virtual); a cart order is a BuyerPayment with
-- product_id NULL plus one order_items row per product.

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "buyer_payment_id" UUID NOT NULL,
    "product_id" UUID,
    "title_snapshot" TEXT NOT NULL,
    "unit_price_paise" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_items_buyer_payment_id_idx" ON "order_items"("buyer_payment_id");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_buyer_payment_id_fkey" FOREIGN KEY ("buyer_payment_id") REFERENCES "buyer_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS for order_items. Deny-anon lockdown (RLS on, NO policies): the browser/anon
-- role can neither read nor write. The storefront checkout and order displays
-- read/write through Prisma's owner role (which bypasses RLS), always scoped via
-- the parent buyer_payment's tenant_id.
alter table public.order_items enable row level security;
