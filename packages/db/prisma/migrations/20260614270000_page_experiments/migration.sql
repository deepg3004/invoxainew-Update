-- Growth G1.6 — A/B tests on payment pages. Additive: 1 enum + 1 table. No changes to
-- existing tables, so it's safe for a running build. Variant counters are bumped by the
-- public /api/exp beacon (advisory, like page-views — not a money surface).

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('RUNNING', 'STOPPED');

-- CreateTable
CREATE TABLE "page_experiments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payment_page_id" UUID NOT NULL,
    "variant_b_title" TEXT NOT NULL,
    "variant_b_description" TEXT,
    "status" "ExperimentStatus" NOT NULL DEFAULT 'RUNNING',
    "a_views" INTEGER NOT NULL DEFAULT 0,
    "b_views" INTEGER NOT NULL DEFAULT 0,
    "a_conversions" INTEGER NOT NULL DEFAULT 0,
    "b_conversions" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "page_experiments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "page_experiments_payment_page_id_key" ON "page_experiments"("payment_page_id");
CREATE INDEX "page_experiments_tenant_id_idx" ON "page_experiments"("tenant_id");

-- AddForeignKey
ALTER TABLE "page_experiments"
    ADD CONSTRAINT "page_experiments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "page_experiments"
    ADD CONSTRAINT "page_experiments_payment_page_id_fkey"
    FOREIGN KEY ("payment_page_id") REFERENCES "payment_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
