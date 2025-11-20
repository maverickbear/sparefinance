-- ============================================================================
-- Update validate_invitation_token Function
-- ============================================================================
-- Date: 2025-02-01
-- Description: Updates validate_invitation_token to use HouseholdMemberNew
--              instead of the old HouseholdMember table
-- ============================================================================

-- ============================================================================
-- UPDATE validate_invitation_token FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."validate_invitation_token"("p_token" "text") 
RETURNS TABLE("id" "uuid", "email" "text", "name" "text", "role" "text", "status" "text", "owner_id" "uuid")
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    hm.id,
    hm.email,
    hm.name,
    hm.role,
    hm.status,
    h."createdBy" as owner_id
  FROM "HouseholdMemberNew" hm
  JOIN "Household" h ON h."id" = hm."householdId"
  WHERE hm."invitationToken" = p_token
    AND hm.status = 'pending';
END;
$$;

COMMENT ON FUNCTION "public"."validate_invitation_token"("p_token" "text") IS 
'Validates an invitation token and returns invitation details. Updated to use HouseholdMemberNew table.';

