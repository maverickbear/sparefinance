-- ============================================================================
-- Remove Legacy HouseholdMember Table
-- ============================================================================
-- Date: 2025-02-01
-- Description: Removes the old HouseholdMember table and all its dependencies
--              after migration to HouseholdMemberNew is complete
-- ============================================================================
-- 
-- WARNING: This migration should only be run after:
-- 1. All data has been migrated to HouseholdMemberNew
-- 2. All functions have been updated to use HouseholdMemberNew
-- 3. All RLS policies have been updated
-- 4. Application code has been updated
-- 5. Validation confirms everything is working
-- ============================================================================

-- ============================================================================
-- 1. VERIFY DATA MIGRATION (COMMENTED - UNCOMMENT TO CHECK)
-- ============================================================================
-- Before running this migration, verify that all data has been migrated:
-- 
-- DO $$
-- DECLARE
--   old_count integer;
--   new_count integer;
-- BEGIN
--   SELECT COUNT(*) INTO old_count FROM "public"."HouseholdMember";
--   SELECT COUNT(*) INTO new_count FROM "public"."HouseholdMemberNew";
--   
--   IF old_count > 0 THEN
--     RAISE WARNING 'HouseholdMember table still has % records. Verify migration before removing.', old_count;
--   END IF;
--   
--   RAISE NOTICE 'Old HouseholdMember records: %, New HouseholdMemberNew records: %', old_count, new_count;
-- END $$;

-- ============================================================================
-- 2. REMOVE TRIGGER (ALREADY REMOVED IN PREVIOUS MIGRATION, BUT KEEP FOR SAFETY)
-- ============================================================================

DROP TRIGGER IF EXISTS "household_member_cache_update_trigger" ON "public"."HouseholdMember";

-- ============================================================================
-- 3. REMOVE RLS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view household members" ON "public"."HouseholdMember";
DROP POLICY IF EXISTS "Users can insert household members" ON "public"."HouseholdMember";
DROP POLICY IF EXISTS "Users can update household members" ON "public"."HouseholdMember";
DROP POLICY IF EXISTS "Users can delete household members" ON "public"."HouseholdMember";

-- ============================================================================
-- 4. REMOVE INDEXES
-- ============================================================================

DROP INDEX IF EXISTS "public"."HouseholdMember_email_idx";
DROP INDEX IF EXISTS "public"."HouseholdMember_memberId_idx";
DROP INDEX IF EXISTS "public"."HouseholdMember_ownerId_idx";
DROP INDEX IF EXISTS "public"."HouseholdMember_status_idx";
DROP INDEX IF EXISTS "public"."idx_householdmember_memberid_status";
DROP INDEX IF EXISTS "public"."idx_householdmember_ownerid";

-- ============================================================================
-- 5. REMOVE FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE "public"."HouseholdMember" 
  DROP CONSTRAINT IF EXISTS "HouseholdMember_memberId_fkey";

ALTER TABLE "public"."HouseholdMember" 
  DROP CONSTRAINT IF EXISTS "HouseholdMember_ownerId_fkey";

-- ============================================================================
-- 6. REMOVE UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE "public"."HouseholdMember" 
  DROP CONSTRAINT IF EXISTS "HouseholdMember_invitationToken_key";

ALTER TABLE "public"."HouseholdMember" 
  DROP CONSTRAINT IF EXISTS "HouseholdMember_pkey";

-- ============================================================================
-- 7. REMOVE CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE "public"."HouseholdMember" 
  DROP CONSTRAINT IF EXISTS "HouseholdMember_status_check";

-- ============================================================================
-- 8. DISABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE "public"."HouseholdMember" DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 9. REVOKE PERMISSIONS
-- ============================================================================

REVOKE ALL ON TABLE "public"."HouseholdMember" FROM "anon";
REVOKE ALL ON TABLE "public"."HouseholdMember" FROM "authenticated";
REVOKE ALL ON TABLE "public"."HouseholdMember" FROM "service_role";

-- ============================================================================
-- 10. DROP TABLE
-- ============================================================================

DROP TABLE IF EXISTS "public"."HouseholdMember";

-- ============================================================================
-- NOTES
-- ============================================================================
-- This migration removes the old HouseholdMember table that used ownerId/memberId pattern.
-- The new HouseholdMemberNew table uses householdId/userId pattern and is the current architecture.
--
-- All data should have been migrated in migration 20250201000003_migrate_data_to_households.sql
-- All functions have been updated in migration 20250201000018_update_subscription_cache_functions_household.sql
-- All RLS policies have been updated in migration 20250201000011_remove_legacy_householdmember_references.sql

