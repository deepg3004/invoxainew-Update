-- Seller's GST state code (2-digit), for invoice place-of-supply + IGST/CGST.
ALTER TABLE "tenants" ADD COLUMN "state_code" TEXT;
