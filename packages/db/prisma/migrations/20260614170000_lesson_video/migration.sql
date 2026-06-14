-- Video lessons (Udemy-style): optional video URL + duration on a lesson.
-- Additive: two new nullable columns → safe for any running build.
ALTER TABLE "lessons" ADD COLUMN "video_url" TEXT;
ALTER TABLE "lessons" ADD COLUMN "duration_sec" INTEGER;
