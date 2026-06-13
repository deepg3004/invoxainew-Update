-- Order bump: flag a product as a one-tap checkout add-on. Additive.
ALTER TABLE "products"
  ADD COLUMN "bump_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "bump_blurb" TEXT;
