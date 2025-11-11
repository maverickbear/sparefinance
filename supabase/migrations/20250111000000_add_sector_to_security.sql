-- Migration: Add sector column to Security table
-- This migration adds a sector field to categorize securities by industry sector
-- The sector field is nullable to maintain compatibility with existing data

-- Add sector column to Security table
ALTER TABLE "Security" 
ADD COLUMN IF NOT EXISTS "sector" TEXT;

-- Create index on sector for better query performance
CREATE INDEX IF NOT EXISTS "Security_sector_idx" ON "Security"("sector");

-- Add comment to document the column
COMMENT ON COLUMN "Security"."sector" IS 'Industry sector for the security (e.g., Technology, Finance, Healthcare, Consumer, Energy, etc.)';

