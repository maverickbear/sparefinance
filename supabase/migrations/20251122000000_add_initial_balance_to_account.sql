-- Add initialBalance column to Account table
-- This allows users to set an initial balance when creating checking or savings accounts

ALTER TABLE "Account" 
ADD COLUMN IF NOT EXISTS "initialBalance" DOUBLE PRECISION;

-- Add comment to explain the column
COMMENT ON COLUMN "Account"."initialBalance" IS 'Initial balance for checking and savings accounts. Used as starting point for balance calculations.';

