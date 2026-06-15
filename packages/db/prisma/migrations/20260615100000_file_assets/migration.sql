-- Media library (cloud storage). Additive: 1 table. The catalog of files a seller
-- uploads; the objects themselves live in the private downloads bucket. This row is
-- the source of truth for storage usage. No money path.

-- CreateTable
CREATE TABLE "file_assets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "content_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "file_assets_key_key" ON "file_assets"("key");
CREATE INDEX "file_assets_tenant_id_created_at_idx" ON "file_assets"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "file_assets"
    ADD CONSTRAINT "file_assets_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
