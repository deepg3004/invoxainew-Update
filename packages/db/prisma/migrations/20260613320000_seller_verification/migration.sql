-- Phase 16: seller verification (trust badge). Denormalised onto tenants so the
-- storefront badge needs no extra query. Additive.

CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

ALTER TABLE "tenants"
  ADD COLUMN "verification_status" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN "verification_note" TEXT,
  ADD COLUMN "verification_review_note" TEXT,
  ADD COLUMN "verification_submitted_at" TIMESTAMP(3),
  ADD COLUMN "verified_at" TIMESTAMP(3);
