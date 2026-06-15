-- Ad-click attribution on orders: fbclid / gclid / ttclid / fbp captured on landing
-- and stamped at checkout (for Meta CAPI + Google enhanced conversions + reporting).
-- Additive, all nullable, no data change.
ALTER TABLE "buyer_payments" ADD COLUMN "fbclid" TEXT;
ALTER TABLE "buyer_payments" ADD COLUMN "gclid" TEXT;
ALTER TABLE "buyer_payments" ADD COLUMN "ttclid" TEXT;
ALTER TABLE "buyer_payments" ADD COLUMN "fbp" TEXT;
