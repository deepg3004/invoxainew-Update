-- Manual UPI auto-confirm: unique-amount nonce session + expiry + cancel.
-- Additive. New columns are nullable / defaulted; the Razorpay path is untouched.
--
-- NOTE: neither partial index below references the NEW enum values (EXPIRED /
-- CANCELLED) — they filter on the already-committed PENDING / UPI_MANUAL values —
-- so adding the enum values and creating the indexes in one migration is safe
-- (Postgres only forbids USING a freshly-added enum value in the same txn).

ALTER TYPE "BuyerPaymentStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "BuyerPaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "buyer_payments"
  ADD COLUMN "pay_amount_paise" INTEGER,
  ADD COLUMN "expires_at" TIMESTAMP(3);

ALTER TABLE "seller_upi"
  ADD COLUMN "auto_confirm" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "auto_confirm_max_paise" INTEGER,
  ADD COLUMN "session_ttl_minutes" INTEGER NOT NULL DEFAULT 10;

-- At most one LIVE (PENDING) UPI session per tenant may hold a given payable
-- amount, so an incoming UPI credit of that exact amount maps to one order.
-- NULL pay_amount_paise (Razorpay / pre-existing rows) are distinct, so unaffected.
CREATE UNIQUE INDEX "buyer_payments_active_upi_amount"
  ON "buyer_payments" ("tenant_id", "pay_amount_paise")
  WHERE "status" = 'PENDING' AND "payment_method" = 'UPI_MANUAL';

-- A submitted UPI reference can belong to at most one order per tenant (blocks
-- duplicate-reference reuse). Only set rows are constrained; expired/unsubmitted
-- sessions keep upi_ref NULL and are exempt.
CREATE UNIQUE INDEX "buyer_payments_tenant_upi_ref"
  ON "buyer_payments" ("tenant_id", "upi_ref")
  WHERE "upi_ref" IS NOT NULL;
