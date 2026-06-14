-- Phase A #2: course lesson-progress tracking.
-- Additive: a new table only. No change to existing tables/data → safe for any
-- currently-running build (old clients simply don't query it).

CREATE TABLE "lesson_progress" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "buyer_profile_id" UUID NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lesson_progress_lesson_id_buyer_profile_id_key"
    ON "lesson_progress"("lesson_id", "buyer_profile_id");

CREATE INDEX "lesson_progress_course_id_buyer_profile_id_idx"
    ON "lesson_progress"("course_id", "buyer_profile_id");

ALTER TABLE "lesson_progress"
    ADD CONSTRAINT "lesson_progress_lesson_id_fkey"
    FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
