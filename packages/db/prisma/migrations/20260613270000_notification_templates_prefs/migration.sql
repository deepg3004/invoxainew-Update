-- Phase 14 (slice 3): admin-editable notification templates (platform-global) +
-- per-tenant on/off preferences. Additive; defaults live in code so an empty
-- table = "use defaults / everything enabled".

CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "event_key" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_templates_event_key_channel_key"
  ON "notification_templates" ("event_key", "channel");

CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_key" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_preferences_tenant_id_event_key_channel_key"
  ON "notification_preferences" ("tenant_id", "event_key", "channel");

ALTER TABLE "notification_preferences"
  ADD CONSTRAINT "notification_preferences_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: deny-anon on both. Written/read server-side via Prisma owner role
-- (admin for templates, seller for own preferences).
alter table public.notification_templates enable row level security;
alter table public.notification_preferences enable row level security;
