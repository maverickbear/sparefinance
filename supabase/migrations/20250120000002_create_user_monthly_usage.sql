-- Migration: Create user_monthly_usage table for aggregated transaction limits
-- This eliminates COUNT(*) queries on every transaction creation

-- Step 1: Create table
CREATE TABLE IF NOT EXISTS "user_monthly_usage" (
  "user_id" uuid NOT NULL,
  "month_date" date NOT NULL,
  "transactions_count" integer NOT NULL DEFAULT 0,
  CONSTRAINT "user_monthly_usage_pkey" PRIMARY KEY ("user_id", "month_date"),
  CONSTRAINT "user_monthly_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Step 2: Create index
CREATE INDEX IF NOT EXISTS "user_monthly_usage_user_month_idx"
ON "user_monthly_usage"("user_id", "month_date");

-- Step 3: Add comment
COMMENT ON TABLE "user_monthly_usage" IS 'Aggregated monthly transaction counts per user. Used for fast limit checking without COUNT(*) queries.';
COMMENT ON COLUMN "user_monthly_usage"."month_date" IS 'First day of the month (e.g., 2025-11-01). Used instead of text YYYY-MM for better ergonomics.';
COMMENT ON COLUMN "user_monthly_usage"."transactions_count" IS 'Number of transactions for this user in this month. For transfers, counts as 1 (not 2) for new transactions.';

-- Step 4: Enable RLS
ALTER TABLE "user_monthly_usage" ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policy
CREATE POLICY "Users can view own monthly usage"
ON "user_monthly_usage"
FOR SELECT
USING ("user_id" = auth.uid());

-- Note: Backfill script will populate this table with historical data
-- Note: Functions to increment counters will be created in next migration

