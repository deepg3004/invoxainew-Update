-- Form power-ups (audit batch 4): notify the seller on submission + optional
-- redirect-after-submit URL. Additive.
ALTER TABLE "lead_forms" ADD COLUMN "notify_on_submit" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "lead_forms" ADD COLUMN "redirect_url" TEXT;
