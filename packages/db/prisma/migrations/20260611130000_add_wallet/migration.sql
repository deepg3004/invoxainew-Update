-- CreateEnum
CREATE TYPE "OrderPurpose" AS ENUM ('SUBSCRIPTION', 'WALLET_TOPUP');

-- CreateEnum
CREATE TYPE "WalletTxnDirection" AS ENUM ('CREDIT', 'DEBIT');

-- DropForeignKey
ALTER TABLE "platform_orders" DROP CONSTRAINT "platform_orders_plan_id_fkey";

-- AlterTable
ALTER TABLE "platform_orders" ADD COLUMN     "purpose" "OrderPurpose" NOT NULL DEFAULT 'SUBSCRIPTION',
ALTER COLUMN "plan_id" DROP NOT NULL,
ALTER COLUMN "billing_cycle" DROP NOT NULL;

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "balance_paise" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "direction" "WalletTxnDirection" NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallets_tenant_id_key" ON "wallets"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_reference_id_key" ON "wallet_transactions"("reference_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_tenant_id_created_at_idx" ON "wallet_transactions"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "platform_orders" ADD CONSTRAINT "platform_orders_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS for C5 wallet tables. These hold the seller's prepaid balance + ledger;
-- the anon/browser path must never touch them. Enable RLS with NO policies →
-- anon/authenticated denied; only server code (Prisma owner role) reads/writes.
alter table public.wallets             enable row level security;
alter table public.wallet_transactions enable row level security;
