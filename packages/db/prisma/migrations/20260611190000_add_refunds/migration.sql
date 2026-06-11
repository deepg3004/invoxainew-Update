-- AlterTable
ALTER TABLE "buyer_payments" ADD COLUMN     "refunded_paise" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "razorpay_refund_id" TEXT NOT NULL,
    "buyer_payment_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "commission_reversed_paise" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refunds_razorpay_refund_id_key" ON "refunds"("razorpay_refund_id");

-- CreateIndex
CREATE INDEX "refunds_tenant_id_created_at_idx" ON "refunds"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_buyer_payment_id_fkey" FOREIGN KEY ("buyer_payment_id") REFERENCES "buyer_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS for refunds (Phase 1). Server-only via Prisma.
alter table public.refunds enable row level security;
