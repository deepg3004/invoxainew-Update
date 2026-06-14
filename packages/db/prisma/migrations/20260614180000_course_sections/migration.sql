-- Course sections/modules (Udemy-style curriculum grouping). Additive: a new
-- table + a nullable lessons.section_id FK (SET NULL on delete) → safe for any
-- running build (lessons stay valid; ungrouped = null).
CREATE TABLE "course_sections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "course_sections_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "course_sections_course_id_idx" ON "course_sections"("course_id");
ALTER TABLE "course_sections"
    ADD CONSTRAINT "course_sections_course_id_fkey"
    FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lessons" ADD COLUMN "section_id" UUID;
ALTER TABLE "lessons"
    ADD CONSTRAINT "lessons_section_id_fkey"
    FOREIGN KEY ("section_id") REFERENCES "course_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
