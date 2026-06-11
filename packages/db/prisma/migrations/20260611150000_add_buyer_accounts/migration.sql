-- AlterTable
ALTER TABLE "buyer_payments" ADD COLUMN     "buyer_profile_id" UUID;

-- CreateTable
CREATE TABLE "buyer_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buyer_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "buyer_accounts_tenant_id_idx" ON "buyer_accounts"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_accounts_tenant_id_profile_id_key" ON "buyer_accounts"("tenant_id", "profile_id");

-- CreateIndex
CREATE INDEX "buyer_payments_tenant_id_buyer_profile_id_idx" ON "buyer_payments"("tenant_id", "buyer_profile_id");

-- AddForeignKey
ALTER TABLE "buyer_accounts" ADD CONSTRAINT "buyer_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_accounts" ADD CONSTRAINT "buyer_accounts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS for C8 buyer accounts. The Buyer Corner is rendered server-side (Prisma),
-- scoped to the logged-in buyer + tenant. Anon/browser path must never read it.
alter table public.buyer_accounts enable row level security;
