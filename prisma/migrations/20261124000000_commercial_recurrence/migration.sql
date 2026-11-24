ALTER TABLE "Opportunity"
  ADD COLUMN "recurringAmountCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "recurringInterval" VARCHAR(20),
  ADD COLUMN "serviceStartDate" TIMESTAMP(3);
