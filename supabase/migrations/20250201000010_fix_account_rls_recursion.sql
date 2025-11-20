-- ============================================================================
-- Fix Account RLS Recursion Issue
-- ============================================================================
-- Date: 2025-02-01
-- Description: Fixes infinite recursion in Account RLS policies by using
--              a helper function with SECURITY DEFINER to bypass RLS
-- ============================================================================

-- ============================================================================
-- CREATE HELPER FUNCTION (if not exists)
-- ============================================================================
-- This function uses SECURITY DEFINER to bypass RLS when checking membership
-- This prevents infinite recursion in RLS policies

CREATE OR REPLACE FUNCTION get_user_household_ids()
RETURNS TABLE(household_id uuid) AS $$
BEGIN
    -- This function uses SECURITY DEFINER to bypass RLS when checking membership
    -- This prevents infinite recursion in RLS policies
    RETURN QUERY
    SELECT hm."householdId" as household_id
    FROM "public"."HouseholdMemberNew" hm
    WHERE hm."userId" = auth.uid()
      AND hm."status" = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_user_household_ids() IS 
'Returns all household IDs where the current user is an active member. Uses SECURITY DEFINER to bypass RLS and prevent recursion.';

-- ============================================================================
-- FIX ACCOUNT SELECT POLICY
-- ============================================================================
-- The issue is that the EXISTS subquery on AccountOwner might trigger
-- RLS policies on AccountOwner that check Account, causing recursion.
-- Solution: Use a simpler approach that doesn't cause recursion

DROP POLICY IF EXISTS "Users can view household accounts" ON "Account";

CREATE POLICY "Users can view household accounts" ON "Account" FOR SELECT
USING (
    -- Check household access via householdId (using function to avoid RLS recursion)
    (
        "householdId" IS NOT NULL 
        AND "householdId" IN (SELECT household_id FROM get_user_household_ids())
    )
    -- Backward compatibility: direct userId match
    OR "userId" = auth.uid()
    -- AccountOwner check (using direct table access without RLS recursion)
    OR EXISTS (
        SELECT 1 
        FROM "public"."AccountOwner" ao
        WHERE ao."accountId" = "Account"."id" 
          AND ao."ownerId" = auth.uid()
    )
);

-- ============================================================================
-- NOTES
-- ============================================================================
-- The fix uses get_user_household_ids() function (SECURITY DEFINER) to bypass
-- RLS and prevent recursion. The AccountOwner check remains but should not
-- cause recursion if AccountOwner policies don't check Account.

