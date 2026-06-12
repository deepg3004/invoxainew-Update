-- Gated post-purchase access link for products (communities / digital delivery).
-- Revealed to the buyer only on a PAID order; never selected onto public pages
-- for rendering. Additive/nullable.
ALTER TABLE "products" ADD COLUMN "access_url" TEXT;
