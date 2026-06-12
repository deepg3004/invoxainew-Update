-- Seller-facing activity log (append-only). Best-effort writes after actions.
CREATE TABLE "activity_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "activity_logs_tenant_id_created_at_idx" ON "activity_logs"("tenant_id", "created_at");

ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: deny-anon. Seller reads only own (tenant-scoped via Prisma).
alter table public.activity_logs enable row level security;
