-- 1-on-1 bookings / consultations. Additive: 1 enum + 3 tables + 1 nullable FK on
-- buyer_payments. SAME money rail as workshops. A PAID order claims the slot +
-- grants a Booking (markBuyerPaymentPaid). No changes to existing data.

-- CreateEnum
CREATE TYPE "BookingTypeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "booking_types" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price_paise" INTEGER NOT NULL,
    "compare_at_paise" INTEGER,
    "image_url" TEXT,
    "meeting_url" TEXT,
    "duration_mins" INTEGER,
    "status" "BookingTypeStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "booking_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_slots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "booking_type_id" UUID NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "booking_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "booking_type_id" UUID NOT NULL,
    "slot_id" UUID,
    "starts_at" TIMESTAMP(3),
    "buyer_profile_id" UUID,
    "buyer_email" TEXT,
    "buyer_payment_id" UUID,
    "source" TEXT NOT NULL DEFAULT 'paid',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "buyer_payments" ADD COLUMN "booking_slot_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "booking_types_tenant_id_slug_key" ON "booking_types"("tenant_id", "slug");
CREATE INDEX "booking_types_tenant_id_status_idx" ON "booking_types"("tenant_id", "status");
CREATE INDEX "booking_slots_booking_type_id_status_idx" ON "booking_slots"("booking_type_id", "status");
CREATE UNIQUE INDEX "bookings_slot_id_key" ON "bookings"("slot_id");
CREATE UNIQUE INDEX "bookings_buyer_payment_id_key" ON "bookings"("buyer_payment_id");
CREATE INDEX "bookings_tenant_id_booking_type_id_idx" ON "bookings"("tenant_id", "booking_type_id");
CREATE INDEX "bookings_booking_type_id_buyer_profile_id_idx" ON "bookings"("booking_type_id", "buyer_profile_id");
CREATE INDEX "buyer_payments_booking_slot_id_idx" ON "buyer_payments"("booking_slot_id");

-- AddForeignKey
ALTER TABLE "booking_types"
    ADD CONSTRAINT "booking_types_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_slots"
    ADD CONSTRAINT "booking_slots_booking_type_id_fkey"
    FOREIGN KEY ("booking_type_id") REFERENCES "booking_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_booking_type_id_fkey"
    FOREIGN KEY ("booking_type_id") REFERENCES "booking_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_slot_id_fkey"
    FOREIGN KEY ("slot_id") REFERENCES "booking_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_buyer_payment_id_fkey"
    FOREIGN KEY ("buyer_payment_id") REFERENCES "buyer_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "buyer_payments"
    ADD CONSTRAINT "buyer_payments_booking_slot_id_fkey"
    FOREIGN KEY ("booking_slot_id") REFERENCES "booking_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
