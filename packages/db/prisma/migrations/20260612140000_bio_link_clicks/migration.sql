-- Bio-link click analytics (append-only). Recorded by the /bio/r redirect for
-- targets that are in the tenant's own published bio.
CREATE TABLE "bio_link_clicks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "target_url" TEXT NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bio_link_clicks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bio_link_clicks_tenant_id_created_at_idx" ON "bio_link_clicks"("tenant_id", "created_at");

ALTER TABLE "bio_link_clicks" ADD CONSTRAINT "bio_link_clicks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: deny-anon. Writes via the redirect (server-side, validated against the
-- tenant's published bio); reads tenant-scoped for seller stats.
alter table public.bio_link_clicks enable row level security;
