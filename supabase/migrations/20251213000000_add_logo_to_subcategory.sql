-- Add logo column to Subcategory table
-- This allows subcategories to have associated logos/images

ALTER TABLE "Subcategory" 
ADD COLUMN IF NOT EXISTS "logo" TEXT;

-- Add comment to document the column
COMMENT ON COLUMN "Subcategory"."logo" IS 'URL or path to the logo/image for this subcategory';

