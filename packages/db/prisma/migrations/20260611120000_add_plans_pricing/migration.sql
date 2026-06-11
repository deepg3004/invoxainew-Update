-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_monthly" INTEGER NOT NULL DEFAULT 0,
    "price_yearly" INTEGER NOT NULL DEFAULT 0,
    "commission_bps" INTEGER NOT NULL DEFAULT 0,
    "max_products" INTEGER,
    "max_ai_pages" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_settings" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value_paise" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_key_key" ON "plans"("key");

-- CreateIndex
CREATE INDEX "plans_is_active_sort_order_idx" ON "plans"("is_active", "sort_order");


-- RLS for C3 platform-pricing tables (plans, pricing_settings).
--
-- These rows are PLATFORM-GLOBAL, not tenant- or user-owned. The browser/anon
-- path must never read or write them. We enable RLS with NO policies, which
-- denies all access to the anon/authenticated roles. Server code uses Prisma
-- (DB owner role), which BYPASSES RLS, so the admin app still works. A public
-- "active plans" read policy can be added later if a public pricing page needs
-- direct anon reads (today it would render server-side via Prisma instead).
alter table public.plans            enable row level security;
alter table public.pricing_settings enable row level security;
