-- CreateEnum
CREATE TYPE "CommunityMessageStatus" AS ENUM ('VISIBLE', 'HIDDEN');

-- CreateTable
CREATE TABLE "community_messages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "community_id" UUID NOT NULL,
    "buyer_profile_id" UUID NOT NULL,
    "author_name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "parent_id" UUID,
    "status" "CommunityMessageStatus" NOT NULL DEFAULT 'VISIBLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "community_messages_community_id_status_created_at_idx" ON "community_messages" ("community_id", "status", "created_at");
CREATE INDEX "community_messages_tenant_id_idx" ON "community_messages" ("tenant_id");
CREATE INDEX "community_messages_parent_id_idx" ON "community_messages" ("parent_id");

-- AddForeignKey
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "community_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: deny-anon. Reads/writes happen server-side via Prisma (owner role) only
-- after a membership check; the anon client never touches this table.
alter table public.community_messages enable row level security;
