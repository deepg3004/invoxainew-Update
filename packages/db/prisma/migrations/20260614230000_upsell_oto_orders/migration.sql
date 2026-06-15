-- Growth G1.1 (Part 2) — wire post-purchase OTO orders. Additive: two NULLABLE
-- columns on buyer_payments linking an OTO order to its parent order + the Upsell
-- accepted, plus a UNIQUE on (parent_payment_id, upsell_id) so accepting an OTO is
-- idempotent (a buyer gets at most one OTO order per parent×upsell; a refreshed
-- success page can't create duplicate charges). Both columns are NULL for every
-- normal order, and Postgres treats (NULL, NULL) rows as distinct under a UNIQUE
-- index, so existing/normal orders are unconstrained. Safe for a running build.

-- AlterTable
ALTER TABLE "buyer_payments"
    ADD COLUMN "parent_payment_id" UUID,
    ADD COLUMN "upsell_id" UUID;

-- CreateIndex (idempotency guard on OTO acceptance)
CREATE UNIQUE INDEX "buyer_payments_parent_payment_id_upsell_id_key"
    ON "buyer_payments"("parent_payment_id", "upsell_id");

-- CreateIndex
CREATE INDEX "buyer_payments_upsell_id_idx" ON "buyer_payments"("upsell_id");

-- AddForeignKey (self-relation: OTO order → parent order)
ALTER TABLE "buyer_payments"
    ADD CONSTRAINT "buyer_payments_parent_payment_id_fkey"
    FOREIGN KEY ("parent_payment_id") REFERENCES "buyer_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey (OTO order → the upsell it accepted)
ALTER TABLE "buyer_payments"
    ADD CONSTRAINT "buyer_payments_upsell_id_fkey"
    FOREIGN KEY ("upsell_id") REFERENCES "upsells"("id") ON DELETE SET NULL ON UPDATE CASCADE;
