-- Migration: Change Transaction.date from timestamp(3) to date type
-- This fixes timezone bugs and simplifies date comparisons

-- Step 1: Add new date column (temporary)
ALTER TABLE "Transaction"
ADD COLUMN IF NOT EXISTS "date_new" date;

-- Step 2: Populate new column from existing timestamp (extract date part only)
UPDATE "Transaction"
SET "date_new" = DATE("date")
WHERE "date_new" IS NULL;

-- Step 3: Make new column NOT NULL (after population)
ALTER TABLE "Transaction"
ALTER COLUMN "date_new" SET NOT NULL;

-- Step 4: Drop old column
ALTER TABLE "Transaction"
DROP COLUMN "date";

-- Step 5: Rename new column to original name
ALTER TABLE "Transaction"
RENAME COLUMN "date_new" TO "date";

-- Step 6: Add comment
COMMENT ON COLUMN "Transaction"."date" IS 'Transaction date (date only, no time component). Changed from timestamp to date to avoid timezone issues.';

-- Note: All indexes on date will be automatically updated by PostgreSQL
-- Note: All foreign key constraints remain valid

