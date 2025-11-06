-- Add phoneNumber field to User table
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;

-- Add index for phoneNumber (optional, useful if you'll search by phone)
CREATE INDEX IF NOT EXISTS "User_phoneNumber_idx" ON "User"("phoneNumber") WHERE "phoneNumber" IS NOT NULL;

