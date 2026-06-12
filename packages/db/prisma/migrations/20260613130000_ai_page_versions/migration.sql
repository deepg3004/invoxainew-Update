-- AI builder version history: a content snapshot per save (latest ~20 kept).
CREATE TABLE "ai_page_versions" (
    "id" UUID NOT NULL,
    "ai_page_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_page_versions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_page_versions_ai_page_id_created_at_idx" ON "ai_page_versions"("ai_page_id", "created_at");

ALTER TABLE "ai_page_versions" ADD CONSTRAINT "ai_page_versions_ai_page_id_fkey" FOREIGN KEY ("ai_page_id") REFERENCES "ai_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: deny-anon. Only the seller editor reads/writes, tenant-scoped via Prisma.
alter table public.ai_page_versions enable row level security;
