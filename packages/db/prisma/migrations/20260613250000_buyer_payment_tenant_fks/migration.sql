-- Defense-in-depth: enforce at the DATABASE that a BuyerPayment's product /
-- payment page / course reference belongs to the SAME tenant as the payment.
-- The app layer already guarantees this (checkout actions resolve the product
-- within the host-resolved tenant), but a composite foreign key makes a
-- cross-tenant reference impossible to even represent.
--
-- These are ADDITIVE composite FKs alongside the existing single-column FKs.
-- MATCH SIMPLE (Postgres default) means a NULL ref column exempts the row, so the
-- existing nullable columns + their ON DELETE SET NULL behaviour keep working:
-- when a product/page/course is deleted, the single-column FK nulls the ref first,
-- and this NO ACTION composite FK is satisfied at end of statement. Verified
-- against live data first: 0 existing rows violate any of these constraints.
--
-- Raw-SQL-only (not modelled in schema.prisma), like the RLS and partial-unique
-- migrations — composite FKs to a non-PK target can't be expressed in the schema.

-- Composite FK targets must be backed by a UNIQUE constraint on (tenant_id, id).
CREATE UNIQUE INDEX IF NOT EXISTS "products_tenant_id_id_key"
  ON "products" ("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_pages_tenant_id_id_key"
  ON "payment_pages" ("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "courses_tenant_id_id_key"
  ON "courses" ("tenant_id", "id");

ALTER TABLE "buyer_payments"
  ADD CONSTRAINT "buyer_payments_tenant_product_fkey"
    FOREIGN KEY ("tenant_id", "product_id")
    REFERENCES "products" ("tenant_id", "id")
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT "buyer_payments_tenant_payment_page_fkey"
    FOREIGN KEY ("tenant_id", "payment_page_id")
    REFERENCES "payment_pages" ("tenant_id", "id")
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT "buyer_payments_tenant_course_fkey"
    FOREIGN KEY ("tenant_id", "course_id")
    REFERENCES "courses" ("tenant_id", "id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;
