-- CreateEnum
CREATE TYPE "BuyerPaymentStatus" AS ENUM ('CREATED', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PAID', 'DUE');

-- CreateTable
CREATE TABLE "payment_pages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount_paise" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_payments" (
    "id" UUID NOT NULL,
    "razorpay_order_id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payment_page_id" UUID NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "status" "BuyerPaymentStatus" NOT NULL DEFAULT 'CREATED',
    "buyer_email" TEXT,
    "buyer_contact" TEXT,
    "razorpay_payment_id" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyer_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_charges" (
    "id" UUID NOT NULL,
    "buyer_payment_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "bps" INTEGER NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PAID',
    "settled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_pages_tenant_id_idx" ON "payment_pages"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_pages_tenant_id_slug_key" ON "payment_pages"("tenant_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_payments_razorpay_order_id_key" ON "buyer_payments"("razorpay_order_id");

-- CreateIndex
CREATE INDEX "buyer_payments_tenant_id_created_at_idx" ON "buyer_payments"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "commission_charges_buyer_payment_id_key" ON "commission_charges"("buyer_payment_id");

-- CreateIndex
CREATE INDEX "commission_charges_tenant_id_status_idx" ON "commission_charges"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "payment_pages" ADD CONSTRAINT "payment_pages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_payments" ADD CONSTRAINT "buyer_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_payments" ADD CONSTRAINT "buyer_payments_payment_page_id_fkey" FOREIGN KEY ("payment_page_id") REFERENCES "payment_pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_charges" ADD CONSTRAINT "commission_charges_buyer_payment_id_fkey" FOREIGN KEY ("buyer_payment_id") REFERENCES "buyer_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS for C7 payment tables. Payment pages, buyer payments, and commission
-- charges are all rendered/mutated server-side (Prisma). The anon/browser path
-- must never read them directly. Enable RLS with NO policies → anon denied.
alter table public.payment_pages       enable row level security;
alter table public.buyer_payments      enable row level security;
alter table public.commission_charges  enable row level security;
