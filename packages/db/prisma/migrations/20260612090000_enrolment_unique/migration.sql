-- Course double-buy guard (correctness): at most one enrolment per (course,
-- buyer). A buyer is identified by profile (signed in) OR email (guest), so two
-- partial unique indexes cover both cases without conflating null keys — many
-- guests share a NULL buyer_profile_id, and a signed-in buyer may have a NULL
-- buyer_email, so neither column can carry a single global unique.
--
-- markBuyerPaymentPaid creates the enrolment with createMany(skipDuplicates),
-- which emits ON CONFLICT DO NOTHING — so a concurrent second purchase of the
-- same course by the same buyer settles (commission still taken) but does NOT
-- create a duplicate enrolment row, and never aborts the payment transaction.

CREATE UNIQUE INDEX "enrolments_course_profile_key"
  ON "enrolments" ("course_id", "buyer_profile_id")
  WHERE "buyer_profile_id" IS NOT NULL;

CREATE UNIQUE INDEX "enrolments_course_email_key"
  ON "enrolments" ("course_id", "buyer_email")
  WHERE "buyer_email" IS NOT NULL;
