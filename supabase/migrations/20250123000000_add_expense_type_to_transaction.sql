-- Add expenseType field to Transaction table
-- This field indicates if an expense is fixed or variable
-- Only applies to expense transactions (type = 'expense')

ALTER TABLE "Transaction" 
ADD COLUMN "expenseType" TEXT;

-- Add comment to clarify usage
COMMENT ON COLUMN "Transaction"."expenseType" IS 'Indicates if expense is fixed or variable. Only applies to expense transactions. Values: "fixed" or "variable"';

