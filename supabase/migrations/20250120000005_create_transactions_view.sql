-- Migration: Create view for reports that excludes transfers
-- This prevents transfers from inflating income/expense totals

-- Step 1: Create view
CREATE OR REPLACE VIEW "vw_transactions_for_reports" AS
SELECT *
FROM "Transaction"
WHERE "transferFromId" IS NULL
  AND "transferToId" IS NULL
  AND "type" IN ('expense', 'income');

-- Step 2: Add comment
COMMENT ON VIEW "vw_transactions_for_reports" IS 'Transactions for reports, excluding transfers. Use this view for income/expense calculations to avoid double-counting transfers.';

-- Step 3: Grant access (RLS policies on Transaction table will apply)
-- No explicit grants needed as RLS handles access control

