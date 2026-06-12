-- Manual UPI rail (slice 1: foundation). Additive — nothing produces PENDING /
-- UPI_MANUAL yet, so the live Razorpay path is unchanged.

ALTER TYPE "BuyerPaymentStatus" ADD VALUE IF NOT EXISTS 'PENDING';

CREATE TYPE "PaymentMethod" AS ENUM ('RAZORPAY', 'UPI_MANUAL');

ALTER TABLE "buyer_payments"
  ADD COLUMN "payment_method" "PaymentMethod" NOT NULL DEFAULT 'RAZORPAY',
  ADD COLUMN "upi_ref" TEXT;

CREATE TABLE "seller_upi" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "upi_id" TEXT NOT NULL,
    "display_name" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_upi_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "seller_upi_tenant_id_key" ON "seller_upi"("tenant_id");

ALTER TABLE "seller_upi" ADD CONSTRAINT "seller_upi_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: deny-anon. Seller reads/writes own via Prisma owner role.
alter table public.seller_upi enable row level security;
