-- Migration: Create AccountOwner table for multiple owners per account
-- This migration allows accounts to have multiple household owners

-- ============================================
-- Step 1: Create AccountOwner Table
-- ============================================

CREATE TABLE IF NOT EXISTS "AccountOwner" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "accountId" TEXT NOT NULL REFERENCES "Account"("id") ON DELETE CASCADE,
  "ownerId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  UNIQUE("accountId", "ownerId")
);

-- ============================================
-- Step 2: Create Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS "AccountOwner_accountId_idx" ON "AccountOwner"("accountId");
CREATE INDEX IF NOT EXISTS "AccountOwner_ownerId_idx" ON "AccountOwner"("ownerId");

-- ============================================
-- Step 3: Enable Row Level Security
-- ============================================

ALTER TABLE "AccountOwner" ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 4: Create RLS Policies
-- ============================================

-- Users can view account owners for accounts they own or are members of
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
    OR
    -- User owns the account (via Account.userId)
    EXISTS (
      SELECT 1 FROM "Account"
      WHERE "Account"."id" = "AccountOwner"."accountId"
      AND "Account"."userId" = auth.uid()
    )
  );

-- Users can insert account owners if they own the account
CREATE POLICY "Users can insert account owners" ON "AccountOwner"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Account"
      WHERE "Account"."id" = "AccountOwner"."accountId"
      AND "Account"."userId" = auth.uid()
    )
    AND
    -- The ownerId must be the user themselves or a household they own or are a member of
    (
      auth.uid() = "AccountOwner"."ownerId"
      OR
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
  );

-- Users can update account owners if they own the account
CREATE POLICY "Users can update account owners" ON "AccountOwner"
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM "Account"
      WHERE "Account"."id" = "AccountOwner"."accountId"
      AND "Account"."userId" = auth.uid()
    )
  );

-- Users can delete account owners if they own the account
CREATE POLICY "Users can delete account owners" ON "AccountOwner"
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM "Account"
      WHERE "Account"."id" = "AccountOwner"."accountId"
      AND "Account"."userId" = auth.uid()
    )
  );

-- ============================================
-- Step 5: Update Account RLS Policies
-- ============================================

-- Update Account SELECT policy to include accounts owned by user's household
DROP POLICY IF EXISTS "Users can view own accounts" ON "Account";
CREATE POLICY "Users can view own accounts" ON "Account"
  FOR SELECT USING (
    -- User owns the account directly
    auth.uid() = "userId"
    OR
    -- User is an owner via AccountOwner
    EXISTS (
      SELECT 1 FROM "AccountOwner"
      WHERE "AccountOwner"."accountId" = "Account"."id"
      AND "AccountOwner"."ownerId" = auth.uid()
    )
    OR
    -- User is a member of a household that owns the account
    EXISTS (
      SELECT 1 FROM "AccountOwner"
      INNER JOIN "HouseholdMember" ON "HouseholdMember"."ownerId" = "AccountOwner"."ownerId"
      WHERE "AccountOwner"."accountId" = "Account"."id"
      AND "HouseholdMember"."memberId" = auth.uid()
      AND "HouseholdMember"."status" = 'active'
    )
  );

-- ============================================
-- Step 6: Migrate existing accounts
-- ============================================

-- For existing accounts, create AccountOwner entries based on userId
INSERT INTO "AccountOwner" ("accountId", "ownerId", "createdAt", "updatedAt")
SELECT 
  "id" as "accountId",
  "userId" as "ownerId",
  "createdAt",
  "updatedAt"
FROM "Account"
WHERE "userId" IS NOT NULL
ON CONFLICT ("accountId", "ownerId") DO NOTHING;

