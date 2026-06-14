-- Affiliates / referrals (repo parity). Additive: a new enum + table, plus three
-- NULLABLE/defaulted columns on buyer_payments → safe for any running build.
-- Affiliate commission is RECORDED only (seller↔partner, off-platform); it never
-- touches the buyer charge, the seller gateway, or the InvoxAI wallet commission.

-- CreateEnum
CREATE TYPE "AffiliateStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateTable
CREATE TABLE "affiliates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "commission_bps" INTEGER NOT NULL DEFAULT 1000,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "status" "AffiliateStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "affiliates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "affiliates_tenant_id_idx" ON "affiliates"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliates_tenant_id_code_key" ON "affiliates"("tenant_id", "code");

-- AddForeignKey
ALTER TABLE "affiliates"
    ADD CONSTRAINT "affiliates_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "buyer_payments"
    ADD COLUMN "affiliate_id" UUID,
    ADD COLUMN "affiliate_code" TEXT,
    ADD COLUMN "affiliate_commission_paise" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "buyer_payments_affiliate_id_idx" ON "buyer_payments"("affiliate_id");

-- AddForeignKey
ALTER TABLE "buyer_payments"
    ADD CONSTRAINT "buyer_payments_affiliate_id_fkey"
    FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
