-- ============================================================================
-- Migrate Data to Households
-- ============================================================================
-- Date: 2025-02-01
-- Description: Script to migrate existing data from userId-based to household-based
--              IMPORTANT: This script should be executed manually after review
-- ============================================================================
-- 
-- INSTRUCTIONS:
-- 1. Review this script carefully before execution
-- 2. Backup your database before running
-- 3. Execute in a transaction to allow rollback if needed
-- 4. Verify results after execution
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: CREATE PERSONAL HOUSEHOLDS FOR ALL USERS
-- ============================================================================

-- Create a personal household for each existing user
INSERT INTO "public"."Household" ("id", "name", "type", "createdBy", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid() as "id",
    COALESCE("name", "email", 'Minha Conta') as "name",
    'personal' as "type",
    "id" as "createdBy",
    COALESCE("createdAt", NOW()) as "createdAt",
    COALESCE("updatedAt", NOW()) as "updatedAt"
FROM "public"."User"
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."HouseholdMemberNew" hm
    JOIN "public"."Household" h ON h."id" = hm."householdId"
    WHERE hm."userId" = "User"."id" 
      AND hm."isDefault" = true
      AND h."type" = 'personal'
);

-- Create HouseholdMemberNew records for personal households (owner role, active, default)
INSERT INTO "public"."HouseholdMemberNew" ("householdId", "userId", "role", "status", "isDefault", "joinedAt", "createdAt", "updatedAt")
SELECT 
    h."id" as "householdId",
    u."id" as "userId",
    'owner' as "role",
    'active' as "status",
    true as "isDefault",
    NOW() as "joinedAt",
    NOW() as "createdAt",
    NOW() as "updatedAt"
FROM "public"."User" u
JOIN "public"."Household" h ON h."createdBy" = u."id" AND h."type" = 'personal'
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."HouseholdMemberNew" hm
    WHERE hm."householdId" = h."id" AND hm."userId" = u."id"
);

-- Create UserActiveHousehold records (set personal household as active)
INSERT INTO "public"."UserActiveHousehold" ("userId", "householdId", "updatedAt")
SELECT 
    u."id" as "userId",
    h."id" as "householdId",
    NOW() as "updatedAt"
FROM "public"."User" u
JOIN "public"."Household" h ON h."createdBy" = u."id" AND h."type" = 'personal'
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."UserActiveHousehold" uah
    WHERE uah."userId" = u."id"
)
ON CONFLICT ("userId") DO NOTHING;

-- ============================================================================
-- STEP 2: MIGRATE EXISTING DATA TO PERSONAL HOUSEHOLDS
-- ============================================================================

-- Migrate Transaction data
UPDATE "public"."Transaction" t
SET "householdId" = (
    SELECT h."id"
    FROM "public"."Household" h
    JOIN "public"."HouseholdMemberNew" hm ON hm."householdId" = h."id"
    WHERE hm."userId" = t."userId" 
      AND hm."isDefault" = true
      AND h."type" = 'personal'
    LIMIT 1
)
WHERE t."householdId" IS NULL AND t."userId" IS NOT NULL;

-- Migrate Account data
UPDATE "public"."Account" a
SET "householdId" = (
    SELECT h."id"
    FROM "public"."Household" h
    JOIN "public"."HouseholdMemberNew" hm ON hm."householdId" = h."id"
    WHERE hm."userId" = a."userId" 
      AND hm."isDefault" = true
      AND h."type" = 'personal'
    LIMIT 1
)
WHERE a."householdId" IS NULL AND a."userId" IS NOT NULL;

-- Migrate InvestmentAccount data
UPDATE "public"."InvestmentAccount" ia
SET "householdId" = (
    SELECT h."id"
    FROM "public"."Household" h
    JOIN "public"."HouseholdMemberNew" hm ON hm."householdId" = h."id"
    WHERE hm."userId" = ia."userId" 
      AND hm."isDefault" = true
      AND h."type" = 'personal'
    LIMIT 1
)
WHERE ia."householdId" IS NULL AND ia."userId" IS NOT NULL;

-- Migrate Budget data
UPDATE "public"."Budget" b
SET "householdId" = (
    SELECT h."id"
    FROM "public"."Household" h
    JOIN "public"."HouseholdMemberNew" hm ON hm."householdId" = h."id"
    WHERE hm."userId" = b."userId" 
      AND hm."isDefault" = true
      AND h."type" = 'personal'
    LIMIT 1
)
WHERE b."householdId" IS NULL AND b."userId" IS NOT NULL;

-- Migrate Goal data
UPDATE "public"."Goal" g
SET "householdId" = (
    SELECT h."id"
    FROM "public"."Household" h
    JOIN "public"."HouseholdMemberNew" hm ON hm."householdId" = h."id"
    WHERE hm."userId" = g."userId" 
      AND hm."isDefault" = true
      AND h."type" = 'personal'
    LIMIT 1
)
WHERE g."householdId" IS NULL AND g."userId" IS NOT NULL;

-- Migrate Debt data
UPDATE "public"."Debt" d
SET "householdId" = (
    SELECT h."id"
    FROM "public"."Household" h
    JOIN "public"."HouseholdMemberNew" hm ON hm."householdId" = h."id"
    WHERE hm."userId" = d."userId" 
      AND hm."isDefault" = true
      AND h."type" = 'personal'
    LIMIT 1
)
WHERE d."householdId" IS NULL AND d."userId" IS NOT NULL;

-- Migrate PlannedPayment data
UPDATE "public"."PlannedPayment" pp
SET "householdId" = (
    SELECT h."id"
    FROM "public"."Household" h
    JOIN "public"."HouseholdMemberNew" hm ON hm."householdId" = h."id"
    WHERE hm."userId" = pp."userId" 
      AND hm."isDefault" = true
      AND h."type" = 'personal'
    LIMIT 1
)
WHERE pp."householdId" IS NULL AND pp."userId" IS NOT NULL;

-- Migrate UserServiceSubscription data
UPDATE "public"."UserServiceSubscription" uss
SET "householdId" = (
    SELECT h."id"
    FROM "public"."Household" h
    JOIN "public"."HouseholdMemberNew" hm ON hm."householdId" = h."id"
    WHERE hm."userId" = uss."userId" 
      AND hm."isDefault" = true
      AND h."type" = 'personal'
    LIMIT 1
)
WHERE uss."householdId" IS NULL AND uss."userId" IS NOT NULL;

-- ============================================================================
-- STEP 3: MIGRATE HOUSEHOLDMEMBER TO HOUSEHOLD GROUPS
-- ============================================================================

-- Create household groups for owners who have active members (excluding self-referential)
INSERT INTO "public"."Household" ("id", "name", "type", "createdBy", "createdAt", "updatedAt")
SELECT DISTINCT
    gen_random_uuid() as "id",
    COALESCE('Casa ' || u."name", 'Casa ' || u."email", 'Casa') as "name",
    'household' as "type",
    hm."ownerId" as "createdBy",
    COALESCE(hm."createdAt", NOW()) as "createdAt",
    COALESCE(hm."updatedAt", NOW()) as "updatedAt"
FROM "public"."HouseholdMember" hm
JOIN "public"."User" u ON u."id" = hm."ownerId"
WHERE hm."status" = 'active'
  AND hm."ownerId" != hm."memberId"  -- Exclude self-referential records
  AND NOT EXISTS (
      SELECT 1 FROM "public"."Household" g
      WHERE g."createdBy" = hm."ownerId" AND g."type" = 'household'
  );

-- Create HouseholdMemberNew for owners in household records
INSERT INTO "public"."HouseholdMemberNew" ("householdId", "userId", "role", "status", "isDefault", "joinedAt", "createdAt", "updatedAt")
SELECT DISTINCT
    h."id" as "householdId",
    hm."ownerId" as "userId",
    'owner' as "role",
    'active' as "status",
    false as "isDefault",
    COALESCE(hm."createdAt", NOW()) as "joinedAt",
    NOW() as "createdAt",
    NOW() as "updatedAt"
FROM "public"."HouseholdMember" hm
JOIN "public"."Household" h ON h."createdBy" = hm."ownerId" AND h."type" = 'household'
WHERE hm."status" = 'active'
  AND hm."ownerId" != hm."memberId"
  AND NOT EXISTS (
      SELECT 1 FROM "public"."HouseholdMemberNew" hmn
      WHERE hmn."householdId" = h."id" AND hmn."userId" = hm."ownerId"
  );

-- Create HouseholdMemberNew for members in household records
INSERT INTO "public"."HouseholdMemberNew" ("householdId", "userId", "role", "status", "isDefault", "joinedAt", "createdAt", "updatedAt")
SELECT DISTINCT
    h."id" as "householdId",
    hm."memberId" as "userId",
    COALESCE(hm."role", 'member') as "role",
    'active' as "status",
    false as "isDefault",
    COALESCE(hm."acceptedAt", hm."createdAt", NOW()) as "joinedAt",
    NOW() as "createdAt",
    NOW() as "updatedAt"
FROM "public"."HouseholdMember" hm
JOIN "public"."Household" h ON h."createdBy" = hm."ownerId" AND h."type" = 'household'
WHERE hm."status" = 'active'
  AND hm."memberId" IS NOT NULL
  AND hm."ownerId" != hm."memberId"
  AND NOT EXISTS (
      SELECT 1 FROM "public"."HouseholdMemberNew" hmn
      WHERE hmn."householdId" = h."id" AND hmn."userId" = hm."memberId"
  );

-- Migrate owner's data to household
UPDATE "public"."Transaction" t
SET "householdId" = (
    SELECT h."id"
    FROM "public"."Household" h
    JOIN "public"."HouseholdMember" hm ON hm."ownerId" = t."userId"
    WHERE h."createdBy" = hm."ownerId" 
      AND h."type" = 'household'
      AND hm."status" = 'active'
      AND hm."ownerId" != hm."memberId"
    LIMIT 1
)
WHERE t."householdId" IS NULL 
  AND t."userId" IN (
      SELECT DISTINCT "ownerId" FROM "public"."HouseholdMember"
      WHERE "status" = 'active' AND "ownerId" != "memberId"
  );

-- Similar updates for other tables (Account, Budget, etc.) for household groups
-- Note: This is a simplified version. You may want to migrate specific data
-- or keep personal and household data separate based on your business logic.

-- ============================================================================
-- STEP 4: MIGRATE SUBSCRIPTIONS
-- ============================================================================

-- Migrate subscriptions to personal households
UPDATE "public"."Subscription" s
SET "householdId" = (
    SELECT h."id"
    FROM "public"."Household" h
    JOIN "public"."HouseholdMemberNew" hm ON hm."householdId" = h."id"
    WHERE hm."userId" = s."userId" 
      AND hm."isDefault" = true
      AND h."type" = 'personal'
    LIMIT 1
)
WHERE s."householdId" IS NULL AND s."userId" IS NOT NULL;

-- ============================================================================
-- COMMIT TRANSACTION
-- ============================================================================

-- Uncomment the line below to commit the transaction
-- COMMIT;

-- If you need to rollback, use:
-- ROLLBACK;

-- ============================================================================
-- VALIDATION QUERIES (Run after migration)
-- ============================================================================

-- Check that all users have personal households
-- SELECT u."id", u."email", COUNT(h."id") as household_count
-- FROM "public"."User" u
-- LEFT JOIN "public"."HouseholdMemberNew" hm ON hm."userId" = u."id" AND hm."isDefault" = true
-- LEFT JOIN "public"."Household" h ON h."id" = hm."householdId" AND h."type" = 'personal'
-- GROUP BY u."id", u."email"
-- HAVING COUNT(h."id") = 0;

-- Check that all data has householdId
-- SELECT 'Transaction' as table_name, COUNT(*) as null_householdid_count
-- FROM "public"."Transaction" WHERE "householdId" IS NULL AND "userId" IS NOT NULL
-- UNION ALL
-- SELECT 'Account', COUNT(*) FROM "public"."Account" WHERE "householdId" IS NULL AND "userId" IS NOT NULL
-- UNION ALL
-- SELECT 'Budget', COUNT(*) FROM "public"."Budget" WHERE "householdId" IS NULL AND "userId" IS NOT NULL;

-- Check household records were created
-- SELECT COUNT(*) as household_records FROM "public"."Household" WHERE "type" = 'household';

-- Check subscriptions were migrated
-- SELECT COUNT(*) as subscriptions_with_householdid FROM "public"."Subscription" WHERE "householdId" IS NOT NULL;

