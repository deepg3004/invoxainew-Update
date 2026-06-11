-- AlterTable
ALTER TABLE "payment_events" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_error" TEXT,
ADD COLUMN     "processed_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "payment_events_processed_at_idx" ON "payment_events"("processed_at");


-- Existing accepted events predate this column and were already handled — mark
-- them processed so the new retry sweep doesn't reprocess historical events.
UPDATE "payment_events" SET "processed_at" = "created_at" WHERE "processed_at" IS NULL;
