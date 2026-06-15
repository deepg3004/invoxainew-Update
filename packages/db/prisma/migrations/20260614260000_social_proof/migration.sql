-- Growth G1.5 — social-proof popups. Additive: one NOT NULL/defaulted boolean on
-- tenant_tracking toggling the public "someone just bought …" popups (on by default).
-- The popup events themselves are DERIVED from recent paid orders at read time
-- (masked, no PII) — no events table. Safe for a running build.

-- AlterTable
ALTER TABLE "tenant_tracking"
    ADD COLUMN "social_proof_enabled" BOOLEAN NOT NULL DEFAULT true;
