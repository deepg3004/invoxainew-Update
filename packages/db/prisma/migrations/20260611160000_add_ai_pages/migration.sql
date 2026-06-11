-- CreateTable
CREATE TABLE "ai_pages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "charge_ref" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_pages_charge_ref_key" ON "ai_pages"("charge_ref");

-- CreateIndex
CREATE INDEX "ai_pages_tenant_id_idx" ON "ai_pages"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_pages_tenant_id_slug_key" ON "ai_pages"("tenant_id", "slug");

-- AddForeignKey
ALTER TABLE "ai_pages" ADD CONSTRAINT "ai_pages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS for C9 AI pages. Rendered server-side (Prisma); anon/browser denied.
alter table public.ai_pages enable row level security;
