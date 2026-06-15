-- Builder Part 3: admin-authored template marketplace.
-- Global catalog (not tenant-scoped). Free templates copy block JSON into a new
-- AiPage at no cost; premium templates are charged via the Feature Billing engine.

CREATE TABLE "builder_templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "theme_preset" TEXT NOT NULL,
    "is_premium" BOOLEAN NOT NULL DEFAULT false,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "builder_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "builder_templates_is_published_category_sort_order_idx" ON "builder_templates"("is_published", "category", "sort_order");
