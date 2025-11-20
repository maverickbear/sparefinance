-- ============================================================================
-- Fix AccountOwner INSERT RLS Policy - Remove HouseholdMember Reference
-- ============================================================================
-- Date: 2025-02-01
-- Description: Fixes infinite recursion in AccountOwner INSERT policy by
--              removing references to old HouseholdMember table and using
--              HouseholdMemberNew instead
-- ============================================================================

-- ============================================================================
-- CREATE HELPER FUNCTION TO CHECK HOUSEHOLD MEMBERSHIP
-- ============================================================================
-- This function checks if two users are in the same household using HouseholdMemberNew

CREATE OR REPLACE FUNCTION are_users_in_same_household(p_user1_id uuid, p_user2_id uuid)
RETURNS boolean AS $$
BEGIN
    -- This function uses SECURITY DEFINER to bypass RLS when checking household membership
    -- This prevents infinite recursion in RLS policies
    RETURN EXISTS (
        SELECT 1
        FROM "public"."HouseholdMemberNew" hm1
        JOIN "public"."HouseholdMemberNew" hm2 ON hm1."householdId" = hm2."householdId"
        WHERE hm1."userId" = p_user1_id
          AND hm2."userId" = p_user2_id
          AND hm1."status" = 'active'
          AND hm2."status" = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION are_users_in_same_household(uuid, uuid) IS 
'Checks if two users are active members of the same household. Uses SECURITY DEFINER to bypass RLS and prevent recursion.';

-- ============================================================================
-- FIX ACCOUNTOWNER INSERT POLICY
-- ============================================================================
-- Replace HouseholdMember references with HouseholdMemberNew and helper function

DROP POLICY IF EXISTS "Users can insert account owners" ON "AccountOwner";

CREATE POLICY "Users can insert account owners" ON "AccountOwner" FOR INSERT
WITH CHECK (
    -- User must be account owner or admin
    (
        "public"."is_account_owner_by_userid"("accountId") 
        OR "public"."is_account_owner_via_accountowner"("accountId") 
        OR "public"."is_current_user_admin"()
    )
    AND (
        -- Case 1: User is adding themselves as owner
        ("auth"."uid"() = "ownerId")
        OR
        -- Case 2: User owns the account and the target user exists
        (
            "public"."is_account_owner_by_userid"("accountId") 
            AND EXISTS (
                SELECT 1 
                FROM "public"."User"
                WHERE "User"."id" = "AccountOwner"."ownerId"
            )
        )
        OR
        -- Case 3: User and target are in the same household (using new table)
        (
            "public"."is_account_owner_via_accountowner"("accountId")
            AND "public"."are_users_in_same_household"("auth"."uid"(), "AccountOwner"."ownerId")
        )
        OR
        -- Case 4: Admin can add any user
        (
            "public"."is_current_user_admin"()
            AND EXISTS (
                SELECT 1 
                FROM "public"."User"
                WHERE "User"."id" = "AccountOwner"."ownerId"
            )
        )
    )
);

-- ============================================================================
-- NOTES
-- ============================================================================
-- The fix removes all references to the old HouseholdMember table and replaces
-- them with HouseholdMemberNew and a helper function that uses SECURITY DEFINER
-- to bypass RLS. This prevents infinite recursion while maintaining the same
-- security checks.

