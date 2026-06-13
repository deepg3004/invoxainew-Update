-- Phase 12: communities / members spaces. Same money model as courses — a PAID
-- order grants a membership (claim-winner in markBuyerPaymentPaid); free
-- communities are joined directly. Additive.

CREATE TYPE "CommunityStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "communities" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price_paise" INTEGER NOT NULL,
    "compare_at_paise" INTEGER,
    "image_url" TEXT,
    "access_url" TEXT,
    "status" "CommunityStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "communities_tenant_id_slug_key" ON "communities" ("tenant_id", "slug");
CREATE INDEX "communities_tenant_id_status_idx" ON "communities" ("tenant_id", "status");

CREATE TABLE "community_posts" (
    "id" UUID NOT NULL,
    "community_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "community_posts_community_id_idx" ON "community_posts" ("community_id");

CREATE TABLE "community_memberships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "community_id" UUID NOT NULL,
    "buyer_profile_id" UUID,
    "buyer_email" TEXT,
    "buyer_payment_id" UUID,
    "source" TEXT NOT NULL DEFAULT 'paid',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "community_memberships_buyer_payment_id_key" ON "community_memberships" ("buyer_payment_id");
CREATE INDEX "community_memberships_tenant_id_community_id_idx" ON "community_memberships" ("tenant_id", "community_id");
CREATE INDEX "community_memberships_community_id_buyer_profile_id_idx" ON "community_memberships" ("community_id", "buyer_profile_id");

ALTER TABLE "buyer_payments" ADD COLUMN "community_id" UUID;

ALTER TABLE "communities" ADD CONSTRAINT "communities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_buyer_payment_id_fkey" FOREIGN KEY ("buyer_payment_id") REFERENCES "buyer_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "buyer_payments" ADD CONSTRAINT "buyer_payments_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS: deny-anon on all three. Published reads + member grants happen server-side
-- via Prisma (owner role); the anon client never touches these tables.
alter table public.communities enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_memberships enable row level security;
