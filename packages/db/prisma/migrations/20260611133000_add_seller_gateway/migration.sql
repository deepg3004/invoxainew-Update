-- CreateEnum
CREATE TYPE "GatewayProvider" AS ENUM ('RAZORPAY');

-- CreateEnum
CREATE TYPE "GatewayMode" AS ENUM ('TEST', 'LIVE');

-- CreateEnum
CREATE TYPE "GatewayStatus" AS ENUM ('CONNECTED', 'DISCONNECTED');

-- CreateTable
CREATE TABLE "seller_gateways" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" "GatewayProvider" NOT NULL DEFAULT 'RAZORPAY',
    "key_id" TEXT NOT NULL,
    "secret_enc" TEXT NOT NULL,
    "mode" "GatewayMode" NOT NULL,
    "status" "GatewayStatus" NOT NULL DEFAULT 'CONNECTED',
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_gateways_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seller_gateways_tenant_id_key" ON "seller_gateways"("tenant_id");

-- AddForeignKey
ALTER TABLE "seller_gateways" ADD CONSTRAINT "seller_gateways_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS for C6 seller gateway table. Holds the seller's OWN gateway credentials
-- (secret stored encrypted). The anon/browser path must never read it. Enable
-- RLS with NO policies → anon/authenticated denied; server (Prisma) only.
alter table public.seller_gateways enable row level security;
