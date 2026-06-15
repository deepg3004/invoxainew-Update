-- Growth G1.2 — abandoned-checkout recovery. Additive: one NULLABLE column on
-- buyer_payments marking when the recovery email was sent (null = not yet nudged).
-- The sweep claims it atomically (UPDATE ... WHERE recovery_email_at IS NULL) so two
-- concurrent cron runs can't double-send. Safe for a running build — null for all
-- existing rows, no behaviour change to the money path.

-- AlterTable
ALTER TABLE "buyer_payments" ADD COLUMN "recovery_email_at" TIMESTAMP(3);
