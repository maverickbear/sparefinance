-- Migration: Remove encrypted columns from Transaction table (Rollback)
-- This migration removes the encryption columns added in Phase 1
-- Note: This migration is safe to run even if columns don't exist

-- Remove encrypted columns (IF EXISTS ensures no error if columns don't exist)
-- Note: PostgreSQL requires separate ALTER TABLE statements for each column
DO $$
BEGIN
  -- Remove amount_encrypted column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'Transaction' 
    AND column_name = 'amount_encrypted'
  ) THEN
    ALTER TABLE "Transaction" DROP COLUMN "amount_encrypted";
  END IF;
  
  -- Remove description_encrypted column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'Transaction' 
    AND column_name = 'description_encrypted'
  ) THEN
    ALTER TABLE "Transaction" DROP COLUMN "description_encrypted";
  END IF;
END $$;

