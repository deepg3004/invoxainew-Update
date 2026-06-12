-- Lead-capture forms + submissions (Final Plan §12 / CRM).

-- CreateEnum
CREATE TYPE "LeadFormStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "lead_forms" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "button_label" TEXT NOT NULL DEFAULT 'Submit',
    "success_message" TEXT,
    "collect_phone" BOOLEAN NOT NULL DEFAULT true,
    "collect_message" BOOLEAN NOT NULL DEFAULT true,
    "status" "LeadFormStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_forms_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lead_forms_tenant_id_status_idx" ON "lead_forms"("tenant_id", "status");
CREATE UNIQUE INDEX "lead_forms_tenant_id_slug_key" ON "lead_forms"("tenant_id", "slug");

-- CreateTable
CREATE TABLE "lead_submissions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_submissions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lead_submissions_tenant_id_created_at_idx" ON "lead_submissions"("tenant_id", "created_at");
CREATE INDEX "lead_submissions_form_id_created_at_idx" ON "lead_submissions"("form_id", "created_at");

-- AddForeignKey
ALTER TABLE "lead_forms" ADD CONSTRAINT "lead_forms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_submissions" ADD CONSTRAINT "lead_submissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_submissions" ADD CONSTRAINT "lead_submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "lead_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: deny-anon lockdown. All reads/writes go through Prisma server-side, always
-- scoped by tenant_id (seller CRUD + submissions list) or by the host-resolved
-- tenant + published form (public submit). No policies → owner-role (Prisma) only.
alter table public.lead_forms enable row level security;
alter table public.lead_submissions enable row level security;
