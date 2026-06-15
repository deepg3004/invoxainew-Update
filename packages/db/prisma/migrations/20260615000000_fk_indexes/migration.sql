-- Add the 8 HIGH-priority missing foreign-key indexes flagged in the
-- 2026-06-14 Prisma index/N+1 audit. Each backs a FK column that is filtered
-- or joined on in hot read paths but had no covering index.

-- products.collection_id (collection product listings)
CREATE INDEX IF NOT EXISTS "products_collection_id_idx" ON "products"("collection_id");

-- buyer_payments FK columns (per-entity order lookups)
CREATE INDEX IF NOT EXISTS "buyer_payments_product_id_idx" ON "buyer_payments"("product_id");
CREATE INDEX IF NOT EXISTS "buyer_payments_course_id_idx" ON "buyer_payments"("course_id");
CREATE INDEX IF NOT EXISTS "buyer_payments_community_id_idx" ON "buyer_payments"("community_id");
CREATE INDEX IF NOT EXISTS "buyer_payments_coupon_id_idx" ON "buyer_payments"("coupon_id");
CREATE INDEX IF NOT EXISTS "buyer_payments_payment_page_id_idx" ON "buyer_payments"("payment_page_id");

-- order_items.product_id (product sales rollups)
CREATE INDEX IF NOT EXISTS "order_items_product_id_idx" ON "order_items"("product_id");

-- refunds.buyer_payment_id (refund lookups per order)
CREATE INDEX IF NOT EXISTS "refunds_buyer_payment_id_idx" ON "refunds"("buyer_payment_id");
