-- ============================================================================
-- Allow Household Members to View Each Other's User Information
-- ============================================================================
-- Date: 2025-02-01
-- Description: Updates User table RLS policy to allow members of the same
--              household to view each other's user information (name, email, avatarUrl, etc.)
-- ============================================================================

-- ============================================================================
-- UPDATE USER TABLE RLS POLICY
-- ============================================================================

-- Drop the existing policy that only allows users to view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON "public"."User";

-- Create new policy that allows:
-- 1. Users to view their own profile
-- 2. Users to view profiles of other users in the same household(s)
CREATE POLICY "Users can view own and household member profiles" ON "public"."User" 
FOR SELECT 
USING (
    -- Users can always view their own profile
    "id" = auth.uid()
    OR
    -- Users can view profiles of other users in the same household(s)
    EXISTS (
        SELECT 1
        FROM "public"."HouseholdMemberNew" hm1
        INNER JOIN "public"."HouseholdMemberNew" hm2 
            ON hm1."householdId" = hm2."householdId"
        WHERE hm1."userId" = auth.uid()
          AND hm2."userId" = "User"."id"
          AND hm1."status" = 'active'
          AND hm2."status" = 'active'
    )
);

COMMENT ON POLICY "Users can view own and household member profiles" ON "public"."User" IS 
'Allows users to view their own profile and profiles of other active members in the same household(s)';

