-- Ad tracking: TikTok Pixel id per tenant. Additive, nullable, no data change.
ALTER TABLE "tenant_tracking" ADD COLUMN "tiktok_pixel_id" TEXT;
