-- CreateTable
CREATE TABLE "feature_rules" (
    "feature_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_paise" INTEGER NOT NULL,
    "gst_rate_bps" INTEGER NOT NULL DEFAULT 1800,
    "wallet_enabled" BOOLEAN NOT NULL DEFAULT true,
    "direct_enabled" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_rules_pkey" PRIMARY KEY ("feature_key")
);

-- CreateTable
CREATE TABLE "plan_feature_limits" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "feature_key" TEXT NOT NULL,
    "free_limit" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "plan_feature_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_usage" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "feature_key" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "feature_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_charges" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "feature_key" TEXT NOT NULL,
    "base_paise" INTEGER NOT NULL,
    "gst_paise" INTEGER NOT NULL,
    "total_paise" INTEGER NOT NULL,
    "pay_via" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_feature_limits_plan_id_feature_key_key" ON "plan_feature_limits"("plan_id", "feature_key");

-- CreateIndex
CREATE INDEX "feature_usage_tenant_id_idx" ON "feature_usage"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "feature_usage_tenant_id_feature_key_period_key" ON "feature_usage"("tenant_id", "feature_key", "period");

-- CreateIndex
CREATE UNIQUE INDEX "feature_charges_reference_id_key" ON "feature_charges"("reference_id");

-- CreateIndex
CREATE INDEX "feature_charges_tenant_id_created_at_idx" ON "feature_charges"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "plan_feature_limits" ADD CONSTRAINT "plan_feature_limits_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_feature_limits" ADD CONSTRAINT "plan_feature_limits_feature_key_fkey" FOREIGN KEY ("feature_key") REFERENCES "feature_rules"("feature_key") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS for feature-billing tables. Server-only via Prisma.
alter table public.feature_rules        enable row level security;
alter table public.plan_feature_limits  enable row level security;
alter table public.feature_usage        enable row level security;
alter table public.feature_charges      enable row level security;
