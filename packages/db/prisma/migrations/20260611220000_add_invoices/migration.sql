-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "ref_type" TEXT NOT NULL,
    "ref_id" UUID NOT NULL,
    "description_line" TEXT NOT NULL,
    "base_paise" INTEGER NOT NULL,
    "tax_paise" INTEGER NOT NULL,
    "total_paise" INTEGER NOT NULL,
    "gst_rate_bps" INTEGER NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_counters" (
    "fy" TEXT NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("fy")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_issued_at_idx" ON "invoices"("tenant_id", "issued_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_ref_type_ref_id_key" ON "invoices"("ref_type", "ref_id");


-- RLS for invoices (Phase 1.3). Server-only via Prisma.
alter table public.invoices enable row level security;
alter table public.invoice_counters enable row level security;
