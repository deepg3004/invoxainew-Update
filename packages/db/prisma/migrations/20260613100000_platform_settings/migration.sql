-- Global platform settings (string key/value) — admin-managed config that used
-- to be env-only: invoice legal name / GSTIN / address / GST rate, plus branding
-- (logo + favicon URLs). PLATFORM-GLOBAL, admin-only. Not for secrets.
CREATE TABLE "platform_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- RLS: deny-anon, same lockdown as pricing_settings. Only the admin app touches
-- these rows (via the Prisma owner role, after requireAdmin) — no anon policy.
alter table public.platform_settings enable row level security;
