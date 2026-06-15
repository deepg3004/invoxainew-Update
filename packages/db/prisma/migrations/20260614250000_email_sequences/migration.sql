-- Growth G1.3 — email/DM drip sequences. Additive: 3 enums + 3 tables. No changes to
-- existing tables, so it's safe for a running build. Part 1 manages sequences+steps;
-- Part 2 (next) writes enrollments via the worker. Carries no money.

-- CreateEnum
CREATE TYPE "SequenceTrigger" AS ENUM ('PURCHASE', 'LEAD', 'MANUAL');
CREATE TYPE "SequenceChannel" AS ENUM ('EMAIL');
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "email_sequences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" "SequenceTrigger" NOT NULL,
    "trigger_product_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "email_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence_steps" (
    "id" UUID NOT NULL,
    "sequence_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "delay_hours" INTEGER NOT NULL,
    "channel" "SequenceChannel" NOT NULL DEFAULT 'EMAIL',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sequence_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence_enrollments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sequence_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "next_run_at" TIMESTAMP(3) NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sequence_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_sequences_tenant_id_active_idx" ON "email_sequences"("tenant_id", "active");
CREATE INDEX "email_sequences_trigger_active_idx" ON "email_sequences"("trigger", "active");
CREATE INDEX "email_sequences_trigger_product_id_idx" ON "email_sequences"("trigger_product_id");
CREATE INDEX "sequence_steps_sequence_id_sort_order_idx" ON "sequence_steps"("sequence_id", "sort_order");
CREATE UNIQUE INDEX "sequence_enrollments_sequence_id_email_key" ON "sequence_enrollments"("sequence_id", "email");
CREATE INDEX "sequence_enrollments_status_next_run_at_idx" ON "sequence_enrollments"("status", "next_run_at");
CREATE INDEX "sequence_enrollments_tenant_id_idx" ON "sequence_enrollments"("tenant_id");

-- AddForeignKey
ALTER TABLE "email_sequences"
    ADD CONSTRAINT "email_sequences_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_sequences"
    ADD CONSTRAINT "email_sequences_trigger_product_id_fkey"
    FOREIGN KEY ("trigger_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sequence_steps"
    ADD CONSTRAINT "sequence_steps_sequence_id_fkey"
    FOREIGN KEY ("sequence_id") REFERENCES "email_sequences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sequence_enrollments"
    ADD CONSTRAINT "sequence_enrollments_sequence_id_fkey"
    FOREIGN KEY ("sequence_id") REFERENCES "email_sequences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
