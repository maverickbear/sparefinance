-- Migration: Add isRecurring field to Budget table
-- Date: 2024-12-02
-- Description: Add isRecurring field to Budget table to support automatic monthly recurring budgets

-- Add isRecurring column to Budget table
ALTER TABLE "public"."Budget" 
ADD COLUMN IF NOT EXISTS "isRecurring" boolean DEFAULT true NOT NULL;

-- Add comment to explain the field
COMMENT ON COLUMN "public"."Budget"."isRecurring" IS 'Indicates if the budget is recurring monthly. When true, the budget will be automatically created for future months.';

-- Create index for recurring budgets queries
CREATE INDEX IF NOT EXISTS "idx_budget_recurring" 
  ON "public"."Budget" ("isRecurring", "userId")
  WHERE "isRecurring" = true;

