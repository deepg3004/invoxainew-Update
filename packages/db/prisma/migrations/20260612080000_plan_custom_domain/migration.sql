-- Custom domains slice 2: gate the feature per plan.
-- Additive: a boolean flag, default false (existing plans stay non-premium until
-- an admin enables it).

ALTER TABLE "plans" ADD COLUMN "custom_domain_allowed" BOOLEAN NOT NULL DEFAULT false;
