-- Migration: Add super_admin role support
-- This migration adds support for the 'super_admin' role in the User table
-- The super_admin role inherits all permissions from 'admin' and is used for
-- Spare Finance administrators who need access to additional features
--
-- IMPORTANT: super_admin is only for users created manually/administratively
-- It cannot be assigned via household invitations (only 'admin' and 'member' can)

-- ============================================
-- Step 1: Update is_current_user_admin() function to include super_admin
-- ============================================

-- Update the function to also return true for users with role 'super_admin'
-- This ensures super_admin has all admin permissions in RLS policies
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "User"
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
END;
$$;

-- ============================================
-- Step 2: Update policies that check role = 'admin' directly
-- ============================================

-- Update Account UPDATE policy to include super_admin
DROP POLICY IF EXISTS "Users can update own accounts" ON "Account";

CREATE POLICY "Users can update own accounts" ON "Account"
  FOR UPDATE USING (
    -- User owns the account directly (userId)
    auth.uid() = "userId"
    OR
    -- User is an owner via AccountOwner
    EXISTS (
      SELECT 1 FROM "AccountOwner"
      WHERE "AccountOwner"."accountId" = "Account"."id"
      AND "AccountOwner"."ownerId" = auth.uid()
    )
    OR
    -- User has admin or super_admin role
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = auth.uid()
      AND "User"."role" IN ('admin', 'super_admin')
    )
  );

-- Update Account DELETE policy to include super_admin
DROP POLICY IF EXISTS "Users can delete own accounts" ON "Account";

CREATE POLICY "Users can delete own accounts" ON "Account"
  FOR DELETE USING (
    -- User owns the account directly (userId)
    auth.uid() = "userId"
    OR
    -- User is an owner via AccountOwner
    EXISTS (
      SELECT 1 FROM "AccountOwner"
      WHERE "AccountOwner"."accountId" = "Account"."id"
      AND "AccountOwner"."ownerId" = auth.uid()
    )
    OR
    -- User has admin or super_admin role
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = auth.uid()
      AND "User"."role" IN ('admin', 'super_admin')
    )
  );

-- Update AccountOwner INSERT policy to include super_admin
DROP POLICY IF EXISTS "Users can insert account owners" ON "AccountOwner";

CREATE POLICY "Users can insert account owners" ON "AccountOwner"
  FOR INSERT WITH CHECK (
    -- User owns the account directly (userId) OR is an owner via AccountOwner OR has admin/super_admin role
    (
      is_account_owner_by_userid("AccountOwner"."accountId")
      OR
      is_account_owner_via_accountowner("AccountOwner"."accountId")
      OR
      is_current_user_admin()
    )
    AND
    -- The ownerId must be a valid user (exists in User table)
    -- When creating account (Account.userId = auth.uid()), allow any valid household
    -- When adding to existing account, require relationship via HouseholdMember
    (
      -- Always allow adding yourself
      auth.uid() = "AccountOwner"."ownerId"
      OR
      -- When creating account, allow any valid household
      (
        is_account_owner_by_userid("AccountOwner"."accountId")
        AND
        EXISTS (
          SELECT 1 FROM "User"
          WHERE "User"."id" = "AccountOwner"."ownerId"
        )
      )
      OR
      -- When adding to existing account, require HouseholdMember relationship OR user is admin/super_admin
      (
        (
          is_account_owner_via_accountowner("AccountOwner"."accountId")
          AND
          (
            EXISTS (
              SELECT 1 FROM "HouseholdMember"
              WHERE "HouseholdMember"."ownerId" = auth.uid()
              AND "HouseholdMember"."memberId" = "AccountOwner"."ownerId"
              AND "HouseholdMember"."status" = 'active'
            )
            OR
            EXISTS (
              SELECT 1 FROM "HouseholdMember"
              WHERE "HouseholdMember"."ownerId" = "AccountOwner"."ownerId"
              AND "HouseholdMember"."memberId" = auth.uid()
              AND "HouseholdMember"."status" = 'active'
            )
          )
        )
        OR
        -- Admin/super_admin users can add any valid household
        (
          is_current_user_admin()
          AND
          EXISTS (
            SELECT 1 FROM "User"
            WHERE "User"."id" = "AccountOwner"."ownerId"
          )
        )
      )
    )
  );

-- Update AccountOwner UPDATE policy (already uses is_current_user_admin(), so no change needed)
-- But we'll document it in comments

-- Update AccountOwner DELETE policy (already uses is_current_user_admin(), so no change needed)
-- But we'll document it in comments

-- Note: The is_current_user_admin() function now includes super_admin,
-- so policies using it automatically support super_admin without changes.

-- ============================================
-- Documentation
-- ============================================

-- Role hierarchy:
-- - 'super_admin': Spare Finance administrators (highest level)
-- - 'admin': Household owners and admin members
-- - 'member': Regular household members
--
-- super_admin inherits all permissions from admin:
-- - Can read all users (via is_current_user_admin() in User SELECT policy)
-- - Can update/delete any account (via Account policies)
-- - Can manage account owners (via AccountOwner policies)
-- - All other admin permissions
--
-- super_admin cannot be assigned via household invitations
-- It must be set manually in the database for specific users

