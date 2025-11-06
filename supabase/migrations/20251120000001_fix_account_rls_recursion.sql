-- Migration: Fix infinite recursion in Account RLS policies
-- The AccountOwner SELECT policy was checking Account, which created a circular dependency
-- with the Account SELECT policy that checks AccountOwner.

-- ============================================
-- Step 1: Drop and recreate AccountOwner SELECT policy
-- ============================================

-- Drop the existing policy that causes recursion
DROP POLICY IF EXISTS "Users can view account owners" ON "AccountOwner";

-- Recreate the policy without the Account check to break the circular dependency
-- The Account policy will handle checking if the user can see the account itself
CREATE POLICY "Users can view account owners" ON "AccountOwner"
  FOR SELECT USING (
    -- User is the owner
    auth.uid() = "ownerId"
    OR
    -- User is a member of the household (ownerId)
    EXISTS (
      SELECT 1 FROM "HouseholdMember"
      WHERE "HouseholdMember"."ownerId" = "AccountOwner"."ownerId"
      AND "HouseholdMember"."memberId" = auth.uid()
      AND "HouseholdMember"."status" = 'active'
    )
  );

-- Note: We removed the Account check from the SELECT policy to prevent recursion.
-- The Account SELECT policy will still check AccountOwner, but AccountOwner SELECT
-- no longer checks Account, breaking the cycle.
-- 
-- For INSERT/UPDATE/DELETE, we still check Account.userId to ensure only the
-- account owner can modify AccountOwner records, which is safe because those
-- operations don't create the same recursion issue.

