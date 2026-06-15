-- Bio link: add TikTok / LinkedIn / Threads socials + an optional page
-- background colour (audit gaps). All nullable, additive.
ALTER TABLE "bio_links" ADD COLUMN "tiktok" TEXT;
ALTER TABLE "bio_links" ADD COLUMN "linkedin" TEXT;
ALTER TABLE "bio_links" ADD COLUMN "threads" TEXT;
ALTER TABLE "bio_links" ADD COLUMN "bg_color" TEXT;
