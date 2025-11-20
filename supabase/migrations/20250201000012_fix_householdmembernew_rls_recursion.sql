-- ============================================================================
-- Fix HouseholdMemberNew RLS Recursion Issue
-- ============================================================================
-- Date: 2025-02-01
-- Description: Fixes infinite recursion in HouseholdMemberNew RLS policies
--              by using a function with SECURITY DEFINER to bypass RLS
-- ============================================================================

-- ============================================================================
-- CREATE HELPER FUNCTION TO CHECK HOUSEHOLD MEMBERSHIP (BYPASSES RLS)
-- ============================================================================

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
-- CREATE HELPER FUNCTION TO CHECK IF USER IS OWNER/ADMIN (BYPASSES RLS)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_admin_household_ids()
RETURNS TABLE(household_id uuid) AS $$
BEGIN
    -- This function uses SECURITY DEFINER to bypass RLS when checking admin/owner status
    RETURN QUERY
    SELECT hm."householdId" as household_id
    FROM "public"."HouseholdMemberNew" hm
    WHERE hm."userId" = auth.uid()
      AND hm."role" IN ('owner', 'admin')
      AND hm."status" = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_user_admin_household_ids() IS 
'Returns all household IDs where the current user is an owner or admin. Uses SECURITY DEFINER to bypass RLS and prevent recursion.';

-- ============================================================================
-- FIX HOUSEHOLDMEMBERNEW SELECT POLICY
-- ============================================================================

DROP POLICY IF EXISTS "Users can view household members" ON "public"."HouseholdMemberNew";

CREATE POLICY "Users can view household members" ON "public"."HouseholdMemberNew"
FOR SELECT
USING (
    -- Use function to get household IDs (bypasses RLS recursion)
    "householdId" IN (SELECT household_id FROM get_user_household_ids())
    -- Users can always see their own membership records
    OR "userId" = auth.uid()
);

-- ============================================================================
-- FIX HOUSEHOLDMEMBERNEW INSERT POLICY
-- ============================================================================

DROP POLICY IF EXISTS "Users can be added to households" ON "public"."HouseholdMemberNew";

CREATE POLICY "Users can be added to households" ON "public"."HouseholdMemberNew"
FOR INSERT
WITH CHECK (
    -- Users can add themselves
    "userId" = auth.uid() 
    -- Or owners/admins can add others to their households
    OR "householdId" IN (SELECT household_id FROM get_user_admin_household_ids())
);

-- ============================================================================
-- FIX HOUSEHOLDMEMBERNEW UPDATE POLICY
-- ============================================================================

DROP POLICY IF EXISTS "Owners and admins can update household members" ON "public"."HouseholdMemberNew";

CREATE POLICY "Owners and admins can update household members" ON "public"."HouseholdMemberNew"
FOR UPDATE
USING (
    -- Owners/admins can update members in their households
    "householdId" IN (SELECT household_id FROM get_user_admin_household_ids())
    -- Users can update their own membership records (e.g., accept invitation)
    OR "userId" = auth.uid()
);

-- ============================================================================
-- FIX HOUSEHOLDMEMBERNEW DELETE POLICY
-- ============================================================================

DROP POLICY IF EXISTS "Owners and admins can remove household members" ON "public"."HouseholdMemberNew";

CREATE POLICY "Owners and admins can remove household members" ON "public"."HouseholdMemberNew"
FOR DELETE
USING (
    -- Owners/admins can remove members from their households
    "householdId" IN (SELECT household_id FROM get_user_admin_household_ids())
    -- Users can remove themselves
    OR "userId" = auth.uid()
);

-- ============================================================================
-- FIX HOUSEHOLD SELECT POLICY (also uses HouseholdMemberNew)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their households" ON "public"."Household";

CREATE POLICY "Users can view their households" ON "public"."Household"
FOR SELECT
USING (
    -- Use function to get household IDs (bypasses RLS recursion)
    "id" IN (SELECT household_id FROM get_user_household_ids())
    -- Users can always see households they created
    OR "createdBy" = auth.uid()
);

-- ============================================================================
-- FIX USERACTIVEHOUSEHOLD POLICY (also uses HouseholdMemberNew)
-- ============================================================================

DROP POLICY IF EXISTS "Users can set their active household" ON "public"."UserActiveHousehold";

CREATE POLICY "Users can set their active household" ON "public"."UserActiveHousehold"
FOR ALL
USING ("userId" = auth.uid())
WITH CHECK (
    "userId" = auth.uid()
    -- Use function to verify user is a member (bypasses RLS recursion)
    AND "householdId" IN (SELECT household_id FROM get_user_household_ids())
);

