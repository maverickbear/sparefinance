-- ============================================================================
-- Create Household RLS Functions
-- ============================================================================
-- Date: 2025-02-01
-- Description: Creates helper functions for Row Level Security based on households
--              and role-based access control
-- ============================================================================

-- ============================================================================
-- 1. FUNCTION: get_user_accessible_households()
-- ============================================================================
-- Returns all household IDs that the current user can access (as active member)

CREATE OR REPLACE FUNCTION get_user_accessible_households()
RETURNS TABLE(household_id uuid) AS $$
BEGIN
    RETURN QUERY
    SELECT hm."householdId"
    FROM "public"."HouseholdMemberNew" hm
    WHERE hm."userId" = auth.uid()
      AND hm."status" = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_accessible_households() IS 
'Returns all household IDs that the current user can access as an active member';

-- ============================================================================
-- 2. FUNCTION: get_user_active_household()
-- ============================================================================
-- Returns the currently active household ID for the current user

CREATE OR REPLACE FUNCTION get_user_active_household()
RETURNS uuid AS $$
DECLARE
    active_household_id uuid;
BEGIN
    SELECT "householdId" INTO active_household_id
    FROM "public"."UserActiveHousehold"
    WHERE "userId" = auth.uid()
    LIMIT 1;
    
    -- If no active household set, return default (personal) household
    IF active_household_id IS NULL THEN
        SELECT hm."householdId" INTO active_household_id
        FROM "public"."HouseholdMemberNew" hm
        JOIN "public"."Household" h ON h."id" = hm."householdId"
        WHERE hm."userId" = auth.uid()
          AND hm."isDefault" = true
          AND h."type" = 'personal'
          AND hm."status" = 'active'
        LIMIT 1;
    END IF;
    
    RETURN active_household_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_active_household() IS 
'Returns the currently active household ID for the current user, or their default personal household';

-- ============================================================================
-- 3. FUNCTION: can_access_household_data()
-- ============================================================================
-- Checks if the current user can perform an operation on a household's data
-- Operations: 'read', 'write', 'delete'
-- Rules:
--   - read: All active members can read
--   - write: Only owner/admin can write
--   - delete: Only owner/admin can delete

CREATE OR REPLACE FUNCTION can_access_household_data(
    p_household_id uuid,
    p_operation text
)
RETURNS boolean AS $$
DECLARE
    user_role text;
    user_status text;
BEGIN
    -- If householdId is NULL, allow access (backward compatibility with userId)
    IF p_household_id IS NULL THEN
        RETURN true;
    END IF;
    
    -- Get user's role and status in this household
    SELECT hm."role", hm."status"
    INTO user_role, user_status
    FROM "public"."HouseholdMemberNew" hm
    WHERE hm."householdId" = p_household_id
      AND hm."userId" = auth.uid();
    
    -- User is not a member of this household
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- User must be active
    IF user_status != 'active' THEN
        RETURN false;
    END IF;
    
    -- Check operation permissions
    CASE p_operation
        WHEN 'read' THEN
            -- All active members can read
            RETURN true;
        
        WHEN 'write' THEN
            -- Only owner/admin can write
            RETURN user_role IN ('owner', 'admin');
        
        WHEN 'delete' THEN
            -- Only owner/admin can delete
            RETURN user_role IN ('owner', 'admin');
        
        ELSE
            -- Unknown operation, deny access
            RETURN false;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION can_access_household_data(uuid, text) IS 
'Checks if the current user can perform an operation (read/write/delete) on a household''s data based on their role';

-- ============================================================================
-- 4. FUNCTION: is_household_member()
-- ============================================================================
-- Simple check if user is an active member of a household

CREATE OR REPLACE FUNCTION is_household_member(p_household_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM "public"."HouseholdMemberNew" hm
        WHERE hm."householdId" = p_household_id
          AND hm."userId" = auth.uid()
          AND hm."status" = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_household_member(uuid) IS 
'Returns true if the current user is an active member of the specified household';

-- ============================================================================
-- 5. FUNCTION: get_user_household_role()
-- ============================================================================
-- Returns the user's role in a specific household

CREATE OR REPLACE FUNCTION get_user_household_role(p_household_id uuid)
RETURNS text AS $$
DECLARE
    user_role text;
BEGIN
    SELECT hm."role"
    INTO user_role
    FROM "public"."HouseholdMemberNew" hm
    WHERE hm."householdId" = p_household_id
      AND hm."userId" = auth.uid()
      AND hm."status" = 'active';
    
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_household_role(uuid) IS 
'Returns the current user''s role in the specified household, or NULL if not a member';

