-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "suspended_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL,
    "admin_email" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "tenant_id" UUID,
    "amount_paise" INTEGER,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_audit_logs_tenant_id_created_at_idx" ON "admin_audit_logs"("tenant_id", "created_at");


-- RLS for the admin audit log (Phase 3). Server/admin-only via Prisma.
alter table public.admin_audit_logs enable row level security;
