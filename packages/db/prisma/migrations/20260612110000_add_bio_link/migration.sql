-- Link-in-bio page (Final Plan §12). One per tenant.

CREATE TABLE "bio_links" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "display_name" TEXT,
    "bio" TEXT,
    "avatar_url" TEXT,
    "instagram" TEXT,
    "youtube" TEXT,
    "twitter" TEXT,
    "facebook" TEXT,
    "whatsapp" TEXT,
    "website" TEXT,
    "links_text" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bio_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bio_links_tenant_id_key" ON "bio_links"("tenant_id");

ALTER TABLE "bio_links" ADD CONSTRAINT "bio_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: deny-anon. Read/written server-side via Prisma, tenant-scoped (seller
-- editor) or by the host-resolved tenant + published flag (public page).
alter table public.bio_links enable row level security;
