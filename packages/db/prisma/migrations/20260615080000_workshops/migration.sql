-- Live workshops — a new sellable type on the SAME money rail as communities. Additive:
-- 1 enum + 2 tables + 1 nullable FK column on buyer_payments. No changes to existing
-- data, so it's safe for a running build. A PAID workshop order grants a
-- WorkshopRegistration in markBuyerPaymentPaid (claim-winner only).

-- CreateEnum
CREATE TYPE "WorkshopStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "workshops" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price_paise" INTEGER NOT NULL,
    "compare_at_paise" INTEGER,
    "image_url" TEXT,
    "join_url" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "duration_mins" INTEGER,
    "max_seats" INTEGER,
    "status" "WorkshopStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workshops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workshop_registrations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "workshop_id" UUID NOT NULL,
    "buyer_profile_id" UUID,
    "buyer_email" TEXT,
    "buyer_payment_id" UUID,
    "source" TEXT NOT NULL DEFAULT 'paid',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workshop_registrations_pkey" PRIMARY KEY ("id")
);

-- AlterTable: workshop FK on buyer_payments (nullable, mirrors community_id)
ALTER TABLE "buyer_payments" ADD COLUMN "workshop_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "workshops_tenant_id_slug_key" ON "workshops"("tenant_id", "slug");
CREATE INDEX "workshops_tenant_id_status_idx" ON "workshops"("tenant_id", "status");
CREATE UNIQUE INDEX "workshop_registrations_buyer_payment_id_key" ON "workshop_registrations"("buyer_payment_id");
CREATE INDEX "workshop_registrations_tenant_id_workshop_id_idx" ON "workshop_registrations"("tenant_id", "workshop_id");
CREATE INDEX "workshop_registrations_workshop_id_buyer_profile_id_idx" ON "workshop_registrations"("workshop_id", "buyer_profile_id");
CREATE INDEX "buyer_payments_workshop_id_idx" ON "buyer_payments"("workshop_id");

-- AddForeignKey
ALTER TABLE "workshops"
    ADD CONSTRAINT "workshops_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workshop_registrations"
    ADD CONSTRAINT "workshop_registrations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workshop_registrations"
    ADD CONSTRAINT "workshop_registrations_workshop_id_fkey"
    FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workshop_registrations"
    ADD CONSTRAINT "workshop_registrations_buyer_payment_id_fkey"
    FOREIGN KEY ("buyer_payment_id") REFERENCES "buyer_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "buyer_payments"
    ADD CONSTRAINT "buyer_payments_workshop_id_fkey"
    FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE SET NULL ON UPDATE CASCADE;
