-- Campaign attribution: UTM params on buyer payments, captured on landing and
-- stamped at checkout. All nullable/additive — no impact on pricing/commission.
ALTER TABLE "buyer_payments"
  ADD COLUMN "utm_source"   TEXT,
  ADD COLUMN "utm_medium"   TEXT,
  ADD COLUMN "utm_campaign" TEXT,
  ADD COLUMN "utm_content"  TEXT,
  ADD COLUMN "utm_term"     TEXT;
