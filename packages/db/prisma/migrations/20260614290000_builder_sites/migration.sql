-- Builder (multi-page) — group AI pages into sites with a shared nav. Additive: a new
-- builder_sites table + three NULLABLE/defaulted columns on ai_pages (site_id, nav_label,
-- nav_order). Existing pages stay standalone (site_id null) → safe for a running build.

-- CreateTable
CREATE TABLE "builder_sites" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "builder_sites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "builder_sites_tenant_id_idx" ON "builder_sites"("tenant_id");

-- AddForeignKey
ALTER TABLE "builder_sites"
    ADD CONSTRAINT "builder_sites_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "ai_pages"
    ADD COLUMN "site_id" UUID,
    ADD COLUMN "nav_label" TEXT,
    ADD COLUMN "nav_order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "ai_pages_site_id_idx" ON "ai_pages"("site_id");

-- AddForeignKey
ALTER TABLE "ai_pages"
    ADD CONSTRAINT "ai_pages_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "builder_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
