-- Course-completion certificates. Additive: 1 table + 1 boolean column on courses
-- (default false, so existing courses are unchanged). No money path. A certificate
-- is auto-issued once a learner completes every lesson of a certificate-enabled
-- course (issueCertificateIfEligible, idempotent on the (course, buyer) unique).

-- AlterTable
ALTER TABLE "courses" ADD COLUMN "certificate_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "buyer_profile_id" UUID NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "certificates_serial_key" ON "certificates"("serial");
CREATE UNIQUE INDEX "certificates_course_id_buyer_profile_id_key" ON "certificates"("course_id", "buyer_profile_id");
CREATE INDEX "certificates_tenant_id_idx" ON "certificates"("tenant_id");

-- AddForeignKey
ALTER TABLE "certificates"
    ADD CONSTRAINT "certificates_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "certificates"
    ADD CONSTRAINT "certificates_course_id_fkey"
    FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
