-- Migration: Add transaction improvements (amount_numeric, date type change, description_search)
-- This migration adds performance and correctness improvements to the Transaction table

-- Step 1: Add amount_numeric column (nullable initially, will be backfilled)
ALTER TABLE "Transaction"
ADD COLUMN IF NOT EXISTS "amount_numeric" numeric(15,2);

-- Step 2: Add description_search column (nullable initially, will be backfilled)
ALTER TABLE "Transaction"
ADD COLUMN IF NOT EXISTS "description_search" text;

-- Step 3: Create index on amount_numeric for reports (SUM, AVG, ORDER BY)
CREATE INDEX IF NOT EXISTS "Transaction_amount_numeric_idx" 
ON "Transaction"("amount_numeric") 
WHERE "amount_numeric" IS NOT NULL;

-- Step 4: Enable pg_trgm extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Step 5: Create GIN index on description_search for substring search (ILIKE)
-- Note: CONCURRENTLY removed because migrations run inside a transaction block
-- This is fine for initial migration. If you need to add this index to a large table
-- in production later, you can create it separately with CONCURRENTLY.
CREATE INDEX IF NOT EXISTS "transaction_description_search_trgm_idx"
ON "Transaction"
USING GIN ("description_search" gin_trgm_ops)
WHERE "description_search" IS NOT NULL;

-- Step 6: Add comment explaining the new columns
COMMENT ON COLUMN "Transaction"."amount_numeric" IS 'Non-encrypted numeric amount for reports and aggregations. Populated from encrypted amount field.';
COMMENT ON COLUMN "Transaction"."description_search" IS 'Normalized description for search and category learning. Lowercase, no special characters, normalized whitespace.';

-- Note: Backfill scripts will be run separately to populate these columns
-- Note: Date type change will be done in a separate migration to avoid conflicts

