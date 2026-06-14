-- Course landing fields (Udemy-style): subtitle + "what you'll learn" + requirements.
-- Additive: new nullable column + two text[] with empty defaults → safe for any
-- currently-running build (old clients don't query them).
ALTER TABLE "courses" ADD COLUMN "subtitle" TEXT;
ALTER TABLE "courses" ADD COLUMN "learn_points" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "courses" ADD COLUMN "requirements" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
