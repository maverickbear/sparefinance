-- ============================================================================
-- Add householdId to Data Tables
-- ============================================================================
-- Date: 2025-02-01
-- Description: Adds householdId column to all data tables for household-based architecture
--              Maintains userId for backward compatibility during migration
-- ============================================================================

-- ============================================================================
-- 1. ADD householdId TO TRANSACTION
-- ============================================================================

ALTER TABLE "public"."Transaction" 
ADD COLUMN IF NOT EXISTS "householdId" uuid;

ALTER TABLE "public"."Transaction"
ADD CONSTRAINT "Transaction_householdId_fkey" 
FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "Transaction_householdId_idx" ON "public"."Transaction"("householdId");

-- ============================================================================
-- 2. ADD householdId TO ACCOUNT
-- ============================================================================

ALTER TABLE "public"."Account" 
ADD COLUMN IF NOT EXISTS "householdId" uuid;

ALTER TABLE "public"."Account"
ADD CONSTRAINT "Account_householdId_fkey" 
FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "Account_householdId_idx" ON "public"."Account"("householdId");

-- ============================================================================
-- 3. ADD householdId TO INVESTMENTACCOUNT
-- ============================================================================

ALTER TABLE "public"."InvestmentAccount" 
ADD COLUMN IF NOT EXISTS "householdId" uuid;

ALTER TABLE "public"."InvestmentAccount"
ADD CONSTRAINT "InvestmentAccount_householdId_fkey" 
FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "InvestmentAccount_householdId_idx" ON "public"."InvestmentAccount"("householdId");

-- ============================================================================
-- 4. ADD householdId TO BUDGET
-- ============================================================================

ALTER TABLE "public"."Budget" 
ADD COLUMN IF NOT EXISTS "householdId" uuid;

ALTER TABLE "public"."Budget"
ADD CONSTRAINT "Budget_householdId_fkey" 
FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "Budget_householdId_idx" ON "public"."Budget"("householdId");

-- ============================================================================
-- 5. ADD householdId TO GOAL
-- ============================================================================

ALTER TABLE "public"."Goal" 
ADD COLUMN IF NOT EXISTS "householdId" uuid;

ALTER TABLE "public"."Goal"
ADD CONSTRAINT "Goal_householdId_fkey" 
FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "Goal_householdId_idx" ON "public"."Goal"("householdId");

-- ============================================================================
-- 6. ADD householdId TO DEBT
-- ============================================================================

ALTER TABLE "public"."Debt" 
ADD COLUMN IF NOT EXISTS "householdId" uuid;

ALTER TABLE "public"."Debt"
ADD CONSTRAINT "Debt_householdId_fkey" 
FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "Debt_householdId_idx" ON "public"."Debt"("householdId");

-- ============================================================================
-- 7. ADD householdId TO PLANNEDPAYMENT
-- ============================================================================

ALTER TABLE "public"."PlannedPayment" 
ADD COLUMN IF NOT EXISTS "householdId" uuid;

ALTER TABLE "public"."PlannedPayment"
ADD CONSTRAINT "PlannedPayment_householdId_fkey" 
FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "PlannedPayment_householdId_idx" ON "public"."PlannedPayment"("householdId");

-- ============================================================================
-- 8. ADD householdId TO USERSERVICESUBSCRIPTION
-- ============================================================================

ALTER TABLE "public"."UserServiceSubscription" 
ADD COLUMN IF NOT EXISTS "householdId" uuid;

ALTER TABLE "public"."UserServiceSubscription"
ADD CONSTRAINT "UserServiceSubscription_householdId_fkey" 
FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "UserServiceSubscription_householdId_idx" ON "public"."UserServiceSubscription"("householdId");

-- ============================================================================
-- 9. ADD householdId TO POSITION
-- ============================================================================

ALTER TABLE "public"."Position" 
ADD COLUMN IF NOT EXISTS "householdId" uuid;

ALTER TABLE "public"."Position"
ADD CONSTRAINT "Position_householdId_fkey" 
FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "Position_householdId_idx" ON "public"."Position"("householdId");

-- ============================================================================
-- 10. ADD householdId TO INVESTMENTTRANSACTION
-- ============================================================================

ALTER TABLE "public"."InvestmentTransaction" 
ADD COLUMN IF NOT EXISTS "householdId" uuid;

ALTER TABLE "public"."InvestmentTransaction"
ADD CONSTRAINT "InvestmentTransaction_householdId_fkey" 
FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "InvestmentTransaction_householdId_idx" ON "public"."InvestmentTransaction"("householdId");

-- ============================================================================
-- 11. ADD householdId TO EXECUTION
-- ============================================================================

ALTER TABLE "public"."Execution" 
ADD COLUMN IF NOT EXISTS "householdId" uuid;

ALTER TABLE "public"."Execution"
ADD CONSTRAINT "Execution_householdId_fkey" 
FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "Execution_householdId_idx" ON "public"."Execution"("householdId");

-- ============================================================================
-- 12. ADD householdId TO ORDER
-- ============================================================================

ALTER TABLE "public"."Order" 
ADD COLUMN IF NOT EXISTS "householdId" uuid;

ALTER TABLE "public"."Order"
ADD CONSTRAINT "Order_householdId_fkey" 
FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "Order_householdId_idx" ON "public"."Order"("householdId");

-- ============================================================================
-- 13. ADD householdId TO SIMPLEINVESTMENTENTRY
-- ============================================================================

ALTER TABLE "public"."SimpleInvestmentEntry" 
ADD COLUMN IF NOT EXISTS "householdId" uuid;

ALTER TABLE "public"."SimpleInvestmentEntry"
ADD CONSTRAINT "SimpleInvestmentEntry_householdId_fkey" 
FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "SimpleInvestmentEntry_householdId_idx" ON "public"."SimpleInvestmentEntry"("householdId");

-- ============================================================================
-- 14. ADD householdId TO ACCOUNTINVESTMENTVALUE
-- ============================================================================

ALTER TABLE "public"."AccountInvestmentValue" 
ADD COLUMN IF NOT EXISTS "householdId" uuid;

ALTER TABLE "public"."AccountInvestmentValue"
ADD CONSTRAINT "AccountInvestmentValue_householdId_fkey" 
FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "AccountInvestmentValue_householdId_idx" ON "public"."AccountInvestmentValue"("householdId");

-- ============================================================================
-- 15. ADD householdId TO PLAIDLIABILITY
-- ============================================================================

ALTER TABLE "public"."PlaidLiability" 
ADD COLUMN IF NOT EXISTS "householdId" uuid;

ALTER TABLE "public"."PlaidLiability"
ADD CONSTRAINT "PlaidLiability_householdId_fkey" 
FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "PlaidLiability_householdId_idx" ON "public"."PlaidLiability"("householdId");

-- ============================================================================
-- 16. ADD householdId TO TRANSACTIONSYNC
-- ============================================================================

ALTER TABLE "public"."TransactionSync" 
ADD COLUMN IF NOT EXISTS "householdId" uuid;

ALTER TABLE "public"."TransactionSync"
ADD CONSTRAINT "TransactionSync_householdId_fkey" 
FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "TransactionSync_householdId_idx" ON "public"."TransactionSync"("householdId");

-- ============================================================================
-- NOTES
-- ============================================================================
-- All householdId columns are nullable to support backward compatibility during migration.
-- After migration is complete and validated, these can be made NOT NULL.
-- userId columns are maintained for backward compatibility.

