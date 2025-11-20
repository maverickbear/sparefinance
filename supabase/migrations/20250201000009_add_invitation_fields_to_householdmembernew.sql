-- ============================================================================
-- Add Invitation Fields to HouseholdMemberNew
-- ============================================================================
-- Date: 2025-02-01
-- Description: Adds fields to support pending invitations in HouseholdMemberNew
--              This allows the table to handle invitations for users who don't exist yet
-- ============================================================================

-- Add invitation fields to HouseholdMemberNew
ALTER TABLE "public"."HouseholdMemberNew"
ADD COLUMN IF NOT EXISTS "email" text,
ADD COLUMN IF NOT EXISTS "name" text,
ADD COLUMN IF NOT EXISTS "invitationToken" text,
ADD COLUMN IF NOT EXISTS "invitedAt" timestamp(3) without time zone,
ADD COLUMN IF NOT EXISTS "acceptedAt" timestamp(3) without time zone;

-- Make userId nullable for pending invitations (when user doesn't exist yet)
ALTER TABLE "public"."HouseholdMemberNew"
ALTER COLUMN "userId" DROP NOT NULL;

-- Add unique constraint on invitationToken
CREATE UNIQUE INDEX IF NOT EXISTS "HouseholdMemberNew_invitationToken_idx" 
ON "public"."HouseholdMemberNew"("invitationToken") 
WHERE "invitationToken" IS NOT NULL;

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS "HouseholdMemberNew_email_idx" 
ON "public"."HouseholdMemberNew"("email") 
WHERE "email" IS NOT NULL;

-- Update constraint: userId OR email must be present for pending invitations
ALTER TABLE "public"."HouseholdMemberNew"
ADD CONSTRAINT "HouseholdMemberNew_userId_or_email_check" 
CHECK (
  ("userId" IS NOT NULL) OR ("email" IS NOT NULL AND "status" = 'pending')
);

-- Update unique constraint to allow multiple pending invitations with same email
-- (different households can invite the same email)
-- First drop the constraint, then recreate the index with WHERE clause
ALTER TABLE "public"."HouseholdMemberNew"
DROP CONSTRAINT IF EXISTS "HouseholdMemberNew_householdId_userId_key";

-- Recreate as a partial unique index (only for non-null userId)
CREATE UNIQUE INDEX IF NOT EXISTS "HouseholdMemberNew_householdId_userId_key" 
ON "public"."HouseholdMemberNew"("householdId", "userId") 
WHERE "userId" IS NOT NULL;

-- Add comment
COMMENT ON COLUMN "public"."HouseholdMemberNew"."email" IS 'Email for pending invitations (when userId is null)';
COMMENT ON COLUMN "public"."HouseholdMemberNew"."name" IS 'Name for pending invitations';
COMMENT ON COLUMN "public"."HouseholdMemberNew"."invitationToken" IS 'Token for invitation acceptance';
COMMENT ON COLUMN "public"."HouseholdMemberNew"."invitedAt" IS 'When the invitation was sent';
COMMENT ON COLUMN "public"."HouseholdMemberNew"."acceptedAt" IS 'When the invitation was accepted';

