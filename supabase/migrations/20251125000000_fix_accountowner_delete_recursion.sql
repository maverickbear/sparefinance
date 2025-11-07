-- Migration: Fix AccountOwner policy recursion issues
-- The AccountOwner policies (INSERT, UPDATE, DELETE) were checking Account or AccountOwner,
-- which created circular dependencies with Account policies that check AccountOwner.

-- ============================================
-- Step 1: Create functions to check if user owns account (bypasses RLS)
-- ============================================

-- Create a function that checks if the current user owns the account via userId
-- This function uses SECURITY DEFINER to bypass RLS when checking the account
CREATE OR REPLACE FUNCTION is_account_owner_by_userid(account_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "Account"
    WHERE "Account"."id" = account_id
    AND "Account"."userId" = auth.uid()
  );
END;
$$;

-- Create a function that checks if the current user is an owner via AccountOwner
-- This function uses SECURITY DEFINER to bypass RLS when checking AccountOwner
CREATE OR REPLACE FUNCTION is_account_owner_via_accountowner(account_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "AccountOwner"
    WHERE "AccountOwner"."accountId" = account_id
    AND "AccountOwner"."ownerId" = auth.uid()
  );
END;
$$;

-- ============================================
-- Step 2: Update AccountOwner INSERT policy to use the functions
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can insert account owners" ON "AccountOwner";

-- Create new policy that uses functions to avoid recursion
CREATE POLICY "Users can insert account owners" ON "AccountOwner"
  FOR INSERT WITH CHECK (
    -- User owns the account directly (userId) OR is an owner via AccountOwner OR has admin role
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
      -- When adding to existing account, require HouseholdMember relationship OR user is admin
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
        -- Admin users can add any valid household
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

-- ============================================
-- Step 3: Update AccountOwner UPDATE policy to use the function
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can update account owners" ON "AccountOwner";

-- Create new policy that uses the function to avoid recursion
CREATE POLICY "Users can update account owners" ON "AccountOwner"
  FOR UPDATE USING (
    -- User owns the account directly (userId) - uses function to avoid recursion
    is_account_owner_by_userid("AccountOwner"."accountId")
    OR
    -- User has admin role - uses existing function
    is_current_user_admin()
  );

-- ============================================
-- Step 4: Update AccountOwner DELETE policy to use the function
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can delete account owners" ON "AccountOwner";

-- Create new policy that uses the function to avoid recursion
-- Note: The function bypasses RLS, preventing infinite recursion
CREATE POLICY "Users can delete account owners" ON "AccountOwner"
  FOR DELETE USING (
    -- User owns the account directly (userId) - uses function to avoid recursion
    is_account_owner_by_userid("AccountOwner"."accountId")
    OR
    -- User has admin role - uses existing function
    is_current_user_admin()
  );

-- Note: These policies allow:
-- 1. Users who own the account via Account.userId to manage AccountOwner records
-- 2. Users with role 'admin' to manage AccountOwner records
-- 3. Users who are owners via AccountOwner to insert new owners (for joint accounts)
--
-- The functions use SECURITY DEFINER to bypass RLS, preventing infinite recursion
-- when checking if the current user owns the account or is an owner via AccountOwner.
--
-- This enables the accounts API to create, update, and delete account owners without recursion errors.

