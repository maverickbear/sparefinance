-- Migration: Fix Critical Database Issues
-- Date: 2024-11-16
-- Description: Applies critical fixes identified in the database analysis
-- Reference: docs/ANALISE_BANCO.md and docs/SPARE_FINANCE_ANALISE_COMPLETA.md

-- ============================================================================
-- CRITICAL FIX 1: Set userId columns to NOT NULL
-- ============================================================================

-- These fields should never be NULL as they represent ownership
-- Ensuring data integrity and proper RLS policy functioning

-- 1.1 InvestmentAccount.userId
DO $$
BEGIN
  -- First, check if there are any NULL values
  IF EXISTS (SELECT 1 FROM "InvestmentAccount" WHERE "userId" IS NULL) THEN
    RAISE NOTICE 'Found NULL userId values in InvestmentAccount. Manual intervention required.';
    -- Optionally, delete orphaned records or assign to a default user
    -- DELETE FROM "InvestmentAccount" WHERE "userId" IS NULL;
  ELSE
    -- Safe to add NOT NULL constraint
    ALTER TABLE "InvestmentAccount" ALTER COLUMN "userId" SET NOT NULL;
    RAISE NOTICE 'InvestmentAccount.userId set to NOT NULL';
  END IF;
END $$;

-- 1.2 Budget.userId
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Budget" WHERE "userId" IS NULL) THEN
    RAISE NOTICE 'Found NULL userId values in Budget. Manual intervention required.';
    -- DELETE FROM "Budget" WHERE "userId" IS NULL;
  ELSE
    ALTER TABLE "Budget" ALTER COLUMN "userId" SET NOT NULL;
    RAISE NOTICE 'Budget.userId set to NOT NULL';
  END IF;
END $$;

-- 1.3 Debt.userId
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Debt" WHERE "userId" IS NULL) THEN
    RAISE NOTICE 'Found NULL userId values in Debt. Manual intervention required.';
    -- DELETE FROM "Debt" WHERE "userId" IS NULL;
  ELSE
    ALTER TABLE "Debt" ALTER COLUMN "userId" SET NOT NULL;
    RAISE NOTICE 'Debt.userId set to NOT NULL';
  END IF;
END $$;

-- 1.4 Goal.userId
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Goal" WHERE "userId" IS NULL) THEN
    RAISE NOTICE 'Found NULL userId values in Goal. Manual intervention required.';
    -- DELETE FROM "Goal" WHERE "userId" IS NULL;
  ELSE
    ALTER TABLE "Goal" ALTER COLUMN "userId" SET NOT NULL;
    RAISE NOTICE 'Goal.userId set to NOT NULL';
  END IF;
END $$;

-- ============================================================================
-- CRITICAL FIX 2: Rename Foreign Key Constraints for Consistency
-- ============================================================================

-- 2.1 Rename Macro_userId_fkey to Group_userId_fkey (table name changed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Macro_userId_fkey'
  ) THEN
    ALTER TABLE "Group" RENAME CONSTRAINT "Macro_userId_fkey" TO "Group_userId_fkey";
    RAISE NOTICE 'Renamed Macro_userId_fkey to Group_userId_fkey';
  END IF;
END $$;

-- 2.2 Rename Budget_groupId_fkey to Budget_macroId_fkey (correct column name)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Budget_groupId_fkey'
  ) THEN
    ALTER TABLE "Budget" RENAME CONSTRAINT "Budget_groupId_fkey" TO "Budget_macroId_fkey";
    RAISE NOTICE 'Renamed Budget_groupId_fkey to Budget_macroId_fkey';
  END IF;
END $$;

-- ============================================================================
-- IMPROVEMENT 1: Add Missing Indexes for Performance
-- ============================================================================

-- These indexes improve query performance for common operations

-- Index for filtering transactions by date range (very common query)
CREATE INDEX IF NOT EXISTS "idx_transaction_date" 
  ON "Transaction" ("date" DESC);

-- Index for user-specific queries with date filtering
CREATE INDEX IF NOT EXISTS "idx_transaction_userid_date" 
  ON "Transaction" ("userId", "date" DESC) 
  WHERE "userId" IS NOT NULL;

-- Index for account balance calculations
-- Only create if type column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'Transaction' 
    AND column_name = 'type'
  ) THEN
    CREATE INDEX IF NOT EXISTS "idx_transaction_accountid_date_type" 
      ON "Transaction" ("accountId", "date", "type");
    RAISE NOTICE 'Created idx_transaction_accountid_date_type index';
  ELSE
    RAISE NOTICE 'Skipping idx_transaction_accountid_date_type - type column does not exist';
  END IF;
END $$;

-- Index for budget tracking queries
CREATE INDEX IF NOT EXISTS "idx_budget_userid_period" 
  ON "Budget" ("userId", "period");

-- Index for goal queries
CREATE INDEX IF NOT EXISTS "idx_goal_userid_iscompleted" 
  ON "Goal" ("userId", "isCompleted");

-- Index for debt queries
CREATE INDEX IF NOT EXISTS "idx_debt_userid_ispaidoff" 
  ON "Debt" ("userId", "isPaidOff");

-- ============================================================================
-- IMPROVEMENT 2: Add Validation Constraints
-- ============================================================================

-- Ensure amounts are positive where applicable
DO $$
BEGIN
  -- Budget amounts should be positive
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'budget_amount_positive'
  ) THEN
    ALTER TABLE "Budget" 
      ADD CONSTRAINT "budget_amount_positive" 
      CHECK ("amount" > 0);
    RAISE NOTICE 'Added budget_amount_positive constraint';
  END IF;

  -- Goal target amounts should be positive
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'goal_targetamount_positive'
  ) THEN
    ALTER TABLE "Goal" 
      ADD CONSTRAINT "goal_targetamount_positive" 
      CHECK ("targetAmount" > 0);
    RAISE NOTICE 'Added goal_targetamount_positive constraint';
  END IF;

  -- Debt initial amount should be positive
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'debt_initialamount_positive'
  ) THEN
    ALTER TABLE "Debt" 
      ADD CONSTRAINT "debt_initialamount_positive" 
      CHECK ("initialAmount" >= 0);
    RAISE NOTICE 'Added debt_initialamount_positive constraint';
  END IF;
END $$;

-- ============================================================================
-- IMPROVEMENT 3: Update Statistics for Query Planner
-- ============================================================================

-- Update table statistics to help PostgreSQL optimize queries
ANALYZE "Transaction";
ANALYZE "Account";
ANALYZE "Budget";
ANALYZE "Goal";
ANALYZE "Debt";
ANALYZE "InvestmentAccount";

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Run these queries to verify the migration was successful:
-- 
-- 1. Check for NULL userId values:
-- SELECT 'InvestmentAccount' as table, COUNT(*) as null_count FROM "InvestmentAccount" WHERE "userId" IS NULL
-- UNION ALL
-- SELECT 'Budget', COUNT(*) FROM "Budget" WHERE "userId" IS NULL
-- UNION ALL
-- SELECT 'Debt', COUNT(*) FROM "Debt" WHERE "userId" IS NULL
-- UNION ALL
-- SELECT 'Goal', COUNT(*) FROM "Goal" WHERE "userId" IS NULL;
--
-- 2. Verify constraints:
-- SELECT conname, contype FROM pg_constraint WHERE conname LIKE '%userId%' OR conname LIKE '%_positive';
--
-- 3. Verify indexes:
-- SELECT indexname FROM pg_indexes WHERE tablename IN ('Transaction', 'Budget', 'Goal', 'Debt');

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================================

-- To rollback this migration (use with caution):
-- 
-- ALTER TABLE "InvestmentAccount" ALTER COLUMN "userId" DROP NOT NULL;
-- ALTER TABLE "Budget" ALTER COLUMN "userId" DROP NOT NULL;
-- ALTER TABLE "Debt" ALTER COLUMN "userId" DROP NOT NULL;
-- ALTER TABLE "Goal" ALTER COLUMN "userId" DROP NOT NULL;
--
-- ALTER TABLE "Group" RENAME CONSTRAINT "Group_userId_fkey" TO "Macro_userId_fkey";
-- ALTER TABLE "Budget" RENAME CONSTRAINT "Budget_macroId_fkey" TO "Budget_groupId_fkey";
--
-- DROP INDEX IF EXISTS "idx_transaction_date";
-- DROP INDEX IF EXISTS "idx_transaction_userid_date";
-- DROP INDEX IF EXISTS "idx_transaction_accountid_date_type";
-- DROP INDEX IF EXISTS "idx_budget_userid_period";
-- DROP INDEX IF EXISTS "idx_goal_userid_iscompleted";
-- DROP INDEX IF EXISTS "idx_debt_userid_ispaidoff";
--
-- ALTER TABLE "Budget" DROP CONSTRAINT IF EXISTS "budget_amount_positive";
-- ALTER TABLE "Goal" DROP CONSTRAINT IF EXISTS "goal_targetamount_positive";
-- ALTER TABLE "Debt" DROP CONSTRAINT IF EXISTS "debt_initialamount_positive";

