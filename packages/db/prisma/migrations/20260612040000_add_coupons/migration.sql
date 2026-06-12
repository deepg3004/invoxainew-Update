-- Store slice 3 (coupons): seller discount codes + checkout wiring.
-- Adds the coupons table and three columns on buyer_payments
-- (coupon_id / coupon_code / discount_paise). amountPaise on a discounted order
-- stays the POST-discount charged total, so commission (off amountPaise) is
-- already on the discounted total; the subtotal = amount_paise + discount_paise.

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FLAT');

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" INTEGER NOT NULL,
    "min_subtotal_paise" INTEGER,
    "max_redemptions" INTEGER,
    "redeemed_count" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coupons_tenant_id_idx" ON "coupons"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_tenant_id_code_key" ON "coupons"("tenant_id", "code");

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "buyer_payments" ADD COLUMN "coupon_id" UUID;
ALTER TABLE "buyer_payments" ADD COLUMN "coupon_code" TEXT;
ALTER TABLE "buyer_payments" ADD COLUMN "discount_paise" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "buyer_payments" ADD CONSTRAINT "buyer_payments_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS for coupons. Deny-anon lockdown (RLS on, NO policies): the browser/anon
-- role can neither read nor write. The seller app (CRUD) and the storefront
-- checkout (validate + apply) both go through Prisma's owner role (which bypasses
-- RLS), always scoped by tenant_id in the query.
alter table public.coupons enable row level security;
