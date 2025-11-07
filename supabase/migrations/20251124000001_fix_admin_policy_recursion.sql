-- Migration: Fix admin policy recursion issue
-- This removes the problematic policy that causes infinite recursion
-- and recreates it with a proper function that bypasses RLS

-- ============================================
-- Step 1: Drop the problematic policy
-- ============================================

-- Remove the policy that causes recursion
DROP POLICY IF EXISTS "Admins can read all users" ON "User";

-- ============================================
-- Step 2: Create a function to check if current user is admin (bypasses RLS)
-- ============================================

-- Create a function that checks if the current user has role 'admin'
-- This function uses SECURITY DEFINER to bypass RLS when checking the role
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
    AND role = 'admin'
  );
END;
$$;

-- ============================================
-- Step 3: Recreate the policy with the function
-- ============================================

-- Allow users with role 'admin' to read all user profiles
-- This is needed for the households API to return all users when the current user is an admin
CREATE POLICY "Admins can read all users" ON "User"
  FOR SELECT USING (
    -- User is reading their own profile (existing behavior)
    auth.uid() = id
    OR
    -- User is an active member of the household where this user is the owner (existing behavior)
    EXISTS (
      SELECT 1 FROM "HouseholdMember"
      WHERE "HouseholdMember"."ownerId" = "User"."id"
      AND "HouseholdMember"."memberId" = auth.uid()
      AND "HouseholdMember"."status" = 'active'
    )
    OR
    -- Current user has role 'admin' (new behavior - uses function to avoid recursion)
    is_current_user_admin()
  );

-- Note: This policy allows:
-- 1. Users to read their own profile (existing behavior)
-- 2. Active household members to read their owner's basic info (existing behavior)
-- 3. Users with role 'admin' to read all user profiles (new behavior)
--
-- The function is_current_user_admin() uses SECURITY DEFINER to bypass RLS,
-- preventing infinite recursion when checking if the current user is an admin.
--
-- This enables the households API to return all users when the current user is an admin,
-- allowing admins to see and select any household when creating/editing accounts.

