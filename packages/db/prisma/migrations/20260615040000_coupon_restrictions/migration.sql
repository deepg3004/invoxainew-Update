-- Coupon restrictions (audit batch 2): per-customer usage limit, first-order-only,
-- and product-specific scope. All additive; enforced server-side in applyCoupon.
ALTER TABLE "coupons" ADD COLUMN "per_customer_limit" INTEGER;
ALTER TABLE "coupons" ADD COLUMN "first_order_only" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "coupons" ADD COLUMN "product_id" UUID;

CREATE INDEX "coupons_product_id_idx" ON "coupons"("product_id");
