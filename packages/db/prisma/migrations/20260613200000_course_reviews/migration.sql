-- Generalise product_reviews to also cover courses (a review is for a product OR a
-- course). Safe: the table is empty. product_id becomes nullable; course_id added.

ALTER TABLE "product_reviews" ALTER COLUMN "product_id" DROP NOT NULL;
ALTER TABLE "product_reviews" ADD COLUMN "course_id" UUID;

ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One review per buyer per course (NULLs are distinct, so product reviews — which
-- have course_id NULL — never collide here).
CREATE UNIQUE INDEX "product_reviews_course_id_buyer_profile_id_key" ON "product_reviews"("course_id", "buyer_profile_id");
CREATE INDEX "product_reviews_course_id_status_idx" ON "product_reviews"("course_id", "status");
