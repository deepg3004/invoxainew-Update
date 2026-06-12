-- Public page-view events for tenant sites (page-level analytics). Append-only,
-- recorded by a best-effort beacon on public pages. No PII.
CREATE TABLE "page_views" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "session_id" TEXT,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_views_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "page_views_tenant_id_created_at_idx" ON "page_views"("tenant_id", "created_at");

ALTER TABLE "page_views" ADD CONSTRAINT "page_views_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: deny-anon. Writes via the /api/pv route (server-side, host-resolved
-- tenant); reads tenant-scoped for the seller's analytics.
alter table public.page_views enable row level security;
