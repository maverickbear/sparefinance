-- Add userId column to Subcategory table
-- This allows us to identify which subcategories were created by users vs system

ALTER TABLE "Subcategory" 
ADD COLUMN IF NOT EXISTS "userId" UUID;

-- Create index for userId
CREATE INDEX IF NOT EXISTS "Subcategory_userId_idx" ON "Subcategory"("userId");

-- Add foreign key constraint to User table
ALTER TABLE "Subcategory" 
ADD CONSTRAINT "Subcategory_userId_fkey" 
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- All existing subcategories are system defaults (userId = NULL)
-- This is already the default behavior, so no update needed

