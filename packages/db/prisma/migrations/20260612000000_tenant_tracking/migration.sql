-- CreateTable
CREATE TABLE "tenant_tracking" (
    "tenant_id" UUID NOT NULL,
    "meta_pixel_id" TEXT,
    "ga4_measurement_id" TEXT,
    "google_ads_id" TEXT,
    "gtm_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_tracking_pkey" PRIMARY KEY ("tenant_id")
);

-- AddForeignKey
ALTER TABLE "tenant_tracking" ADD CONSTRAINT "tenant_tracking_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS for tenant tracking. Read server-side (Prisma) to inject pixels.
alter table public.tenant_tracking enable row level security;
