-- ============================================================================
-- Remove Legacy Functions
-- ============================================================================
-- Date: 2025-02-01
-- Description: Removes legacy SQL functions related to HouseholdMember
--              that are no longer needed after migration to group-based architecture
-- ============================================================================
-- 
-- NOTE: This migration should be run AFTER:
-- 1. All data has been migrated to groups
-- 2. All RLS policies have been updated
-- 3. Application code has been updated to use groups
-- 4. Validation confirms everything is working
-- ============================================================================

-- ============================================================================
-- 1. REMOVE LEGACY FUNCTIONS
-- ============================================================================

-- Remove get_household_owner_id() function
DROP FUNCTION IF EXISTS get_household_owner_id();

-- Remove is_owner_or_household_member() function
DROP FUNCTION IF EXISTS is_owner_or_household_member(uuid);

-- ============================================================================
-- NOTES
-- ============================================================================
-- These functions were used in the old HouseholdMember-based architecture.
-- They are replaced by the new household-based functions:
-- - get_user_accessible_households()
-- - get_user_active_household()
-- - can_access_household_data()
-- - is_household_member()
-- - get_user_household_role()
--
-- The HouseholdMember table (old) is kept for backward compatibility
-- and will be removed in a future migration after full validation.
-- The new HouseholdMemberNew table is the replacement.

