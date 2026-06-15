-- Growth G1.1 — post-purchase one-time offers (OTO). Additive: one new table.
-- Order-bump (pre-purchase) stays on products.bump_enabled and is untouched here.
-- The OTO charge itself (Part 2) reuses the seller gateway + the markBuyerPaymentPaid
-- idempotent claim; this migration only adds the seller-managed offer catalog.

-- CreateTable
CREATE TABLE "upsells" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "offer_product_id" UUID NOT NULL,
    "trigger_product_id" UUID,
    "headline" TEXT NOT NULL,
    "blurb" TEXT,
    "discount_bps" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "upsells_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "upsells_tenant_id_active_idx" ON "upsells"("tenant_id", "active");

-- CreateIndex
CREATE INDEX "upsells_offer_product_id_idx" ON "upsells"("offer_product_id");

-- CreateIndex
CREATE INDEX "upsells_trigger_product_id_idx" ON "upsells"("trigger_product_id");

-- AddForeignKey
ALTER TABLE "upsells"
    ADD CONSTRAINT "upsells_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upsells"
    ADD CONSTRAINT "upsells_offer_product_id_fkey"
    FOREIGN KEY ("offer_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upsells"
    ADD CONSTRAINT "upsells_trigger_product_id_fkey"
    FOREIGN KEY ("trigger_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
