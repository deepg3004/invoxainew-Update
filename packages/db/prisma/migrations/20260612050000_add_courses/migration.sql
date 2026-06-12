-- Courses / LMS (Final Plan §10), slice 1: courses + lessons + enrolments.
-- A course is a first-class sellable on the existing buyer-payment rail; the PAID
-- order grants an Enrolment (in markBuyerPaymentPaid, claim-winner only).

-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price_paise" INTEGER NOT NULL,
    "image_url" TEXT,
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "is_preview" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrolments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "buyer_profile_id" UUID,
    "buyer_email" TEXT,
    "buyer_payment_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrolments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "courses_tenant_id_status_idx" ON "courses"("tenant_id", "status");
CREATE UNIQUE INDEX "courses_tenant_id_slug_key" ON "courses"("tenant_id", "slug");
CREATE INDEX "lessons_course_id_idx" ON "lessons"("course_id");
CREATE UNIQUE INDEX "enrolments_buyer_payment_id_key" ON "enrolments"("buyer_payment_id");
CREATE INDEX "enrolments_tenant_id_course_id_idx" ON "enrolments"("tenant_id", "course_id");
CREATE INDEX "enrolments_course_id_buyer_profile_id_idx" ON "enrolments"("course_id", "buyer_profile_id");

-- AlterTable
ALTER TABLE "buyer_payments" ADD COLUMN "course_id" UUID;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_buyer_payment_id_fkey" FOREIGN KEY ("buyer_payment_id") REFERENCES "buyer_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "buyer_payments" ADD CONSTRAINT "buyer_payments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS: deny-anon lockdown (RLS on, NO policies) on all three tables. The seller
-- app (CRUD), the storefront (published reads), the checkout (enrolment grant),
-- and the buyer's learning page all go through Prisma's owner role (bypasses RLS),
-- always scoped by tenant_id / enrolment in the query. Lesson bodies are served
-- only after the enrolment check (preview lessons excepted).
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.enrolments enable row level security;
