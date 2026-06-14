-- #2 Direct platform-gateway payment for features.
--
-- NOTE: review before applying. Adds an enum value + two nullable columns; all
-- additive and backward-compatible (existing rows get NULL). On Postgres 12+
-- (Supabase is 15) ADD VALUE + ADD COLUMN coexist in one transaction safely here
-- because the new enum value is not USED within this migration.

-- New purpose for a platform order that buys a prepaid feature credit.
ALTER TYPE "OrderPurpose" ADD VALUE 'FEATURE';

-- Which paid feature a FEATURE platform order unlocks (null for other purposes).
ALTER TABLE "platform_orders" ADD COLUMN "feature_key" TEXT;

-- Prepaid direct-payment credit lifecycle on FeatureCharge:
--   payVia="direct" + consumed_at NULL  = available credit
--   payVia="direct" + consumed_at set   = already consumed by a feature use
-- Wallet charges leave this NULL (they are consumed the instant they're written).
ALTER TABLE "feature_charges" ADD COLUMN "consumed_at" TIMESTAMP(3);
