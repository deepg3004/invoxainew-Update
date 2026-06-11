-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('NEW', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- AlterTable
ALTER TABLE "buyer_payments" ADD COLUMN     "fulfillment_status" "FulfillmentStatus" NOT NULL DEFAULT 'NEW',
ADD COLUMN     "tracking_note" TEXT;

