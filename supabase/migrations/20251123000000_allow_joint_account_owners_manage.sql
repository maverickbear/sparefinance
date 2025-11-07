-- Migration: Allow joint account owners to manage accounts
-- This migration updates RLS policies to allow any owner (via AccountOwner) 
-- or users with role "admin" to update, delete accounts and manage account owners

-- ============================================
-- Step 1: Update Account UPDATE policy
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can update own accounts" ON "Account";

-- Create new policy that allows any owner (via AccountOwner) or admin users to update
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
    -- User has admin role
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = auth.uid()
      AND "User"."role" = 'admin'
    )
  );

-- ============================================
-- Step 2: Update Account DELETE policy
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can delete own accounts" ON "Account";

-- Create new policy that allows any owner (via AccountOwner) or admin users to delete
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
    -- User has admin role
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = auth.uid()
      AND "User"."role" = 'admin'
    )
  );

-- ============================================
-- Step 3: Update AccountOwner INSERT policy
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can insert account owners" ON "AccountOwner";

-- Create new policy that allows any owner or admin users to add new owners
CREATE POLICY "Users can insert account owners" ON "AccountOwner"
  FOR INSERT WITH CHECK (
    -- User owns the account directly (userId) OR is an owner via AccountOwner OR has admin role
    (
      EXISTS (
        SELECT 1 FROM "Account"
        WHERE "Account"."id" = "AccountOwner"."accountId"
        AND "Account"."userId" = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM "AccountOwner" AS "ExistingOwner"
        WHERE "ExistingOwner"."accountId" = "AccountOwner"."accountId"
        AND "ExistingOwner"."ownerId" = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM "User"
        WHERE "User"."id" = auth.uid()
        AND "User"."role" = 'admin'
      )
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
        EXISTS (
          SELECT 1 FROM "Account"
          WHERE "Account"."id" = "AccountOwner"."accountId"
          AND "Account"."userId" = auth.uid()
        )
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
          EXISTS (
            SELECT 1 FROM "AccountOwner" AS "ExistingOwner"
            WHERE "ExistingOwner"."accountId" = "AccountOwner"."accountId"
            AND "ExistingOwner"."ownerId" = auth.uid()
          )
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
          EXISTS (
            SELECT 1 FROM "User"
            WHERE "User"."id" = auth.uid()
            AND "User"."role" = 'admin'
          )
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
-- Step 4: Update AccountOwner UPDATE policy
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can update account owners" ON "AccountOwner";

-- Create new policy that allows account creator or admin users to update owners
-- Note: We check Account.userId to avoid recursion (AccountOwner checking AccountOwner)
CREATE POLICY "Users can update account owners" ON "AccountOwner"
  FOR UPDATE USING (
    -- User owns the account directly (userId)
    EXISTS (
      SELECT 1 FROM "Account"
      WHERE "Account"."id" = "AccountOwner"."accountId"
      AND "Account"."userId" = auth.uid()
    )
    OR
    -- User has admin role
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = auth.uid()
      AND "User"."role" = 'admin'
    )
  );

-- ============================================
-- Step 5: Update AccountOwner DELETE policy
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can delete account owners" ON "AccountOwner";

-- Create new policy that allows account creator or admin users to delete owners
-- Note: We check Account.userId to avoid recursion (AccountOwner checking AccountOwner)
-- Note: The application code should prevent deleting the last owner
CREATE POLICY "Users can delete account owners" ON "AccountOwner"
  FOR DELETE USING (
    -- User owns the account directly (userId)
    EXISTS (
      SELECT 1 FROM "Account"
      WHERE "Account"."id" = "AccountOwner"."accountId"
      AND "Account"."userId" = auth.uid()
    )
    OR
    -- User has admin role
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = auth.uid()
      AND "User"."role" = 'admin'
    )
  );

