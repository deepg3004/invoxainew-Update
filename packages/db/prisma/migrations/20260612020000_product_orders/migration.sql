-- DropForeignKey
ALTER TABLE "buyer_payments" DROP CONSTRAINT "buyer_payments_payment_page_id_fkey";

-- AlterTable
ALTER TABLE "buyer_payments" ADD COLUMN     "item_title" TEXT,
ADD COLUMN     "product_id" UUID,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "payment_page_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "buyer_payments" ADD CONSTRAINT "buyer_payments_payment_page_id_fkey" FOREIGN KEY ("payment_page_id") REFERENCES "payment_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_payments" ADD CONSTRAINT "buyer_payments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill item_title for existing payment-page orders so order history renders
-- uniformly off item_title regardless of source. New rows always set it.
UPDATE "buyer_payments" bp
SET "item_title" = pp."title"
FROM "payment_pages" pp
WHERE bp."payment_page_id" = pp."id" AND bp."item_title" IS NULL;
