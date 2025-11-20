-- ============================================================================
-- Fix AccountOwner RLS Recursion Issue
-- ============================================================================
-- Date: 2025-02-01
-- Description: Fixes infinite recursion between Account and AccountOwner RLS policies
--              by using helper functions with SECURITY DEFINER to bypass RLS
-- ============================================================================

-- ============================================================================
-- CREATE HELPER FUNCTION TO CHECK ACCOUNT OWNERSHIP VIA ACCOUNTOWNER
-- ============================================================================
-- This function uses SECURITY DEFINER to bypass RLS when checking AccountOwner
-- This prevents infinite recursion when AccountOwner policies check Account

CREATE OR REPLACE FUNCTION can_access_account_via_accountowner(p_account_id text)
RETURNS boolean AS $$
BEGIN
    -- This function uses SECURITY DEFINER to bypass RLS when checking AccountOwner
    -- This prevents infinite recursion in RLS policies
    RETURN EXISTS (
        SELECT 1 
        FROM "public"."AccountOwner" ao
        WHERE ao."accountId" = p_account_id
          AND ao."ownerId" = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION can_access_account_via_accountowner(text) IS 
'Checks if the current user can access an account via AccountOwner relationship. Uses SECURITY DEFINER to bypass RLS and prevent recursion.';

-- ============================================================================
-- CREATE HELPER FUNCTION TO CHECK ACCOUNT USERID
-- ============================================================================
-- This function uses SECURITY DEFINER to bypass RLS when checking Account.userId
-- This prevents infinite recursion when AccountOwner policies check Account

CREATE OR REPLACE FUNCTION get_account_user_id(p_account_id text)
RETURNS uuid AS $$
DECLARE
    v_user_id uuid;
BEGIN
    -- This function uses SECURITY DEFINER to bypass RLS when checking Account
    -- This prevents infinite recursion in RLS policies
    SELECT "userId" INTO v_user_id
    FROM "public"."Account"
    WHERE "id" = p_account_id;
    
    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_account_user_id(text) IS 
'Returns the userId of an account. Uses SECURITY DEFINER to bypass RLS and prevent recursion.';

-- ============================================================================
-- FIX ACCOUNTOWNER SELECT POLICY
-- ============================================================================
-- Replace direct Account check with function call to avoid recursion

DROP POLICY IF EXISTS "Users can view account owners" ON "AccountOwner";

CREATE POLICY "Users can view account owners" ON "AccountOwner" FOR SELECT
USING (
    -- Direct ownership check
    "ownerId" = auth.uid()
    -- Check if user owns the account (via function to avoid RLS recursion)
    OR get_account_user_id("accountId") = auth.uid()
);

-- ============================================================================
-- FIX ACCOUNTOWNER UPDATE POLICY
-- ============================================================================

DROP POLICY IF EXISTS "Users can update account owners" ON "AccountOwner";

CREATE POLICY "Users can update account owners" ON "AccountOwner" FOR UPDATE
USING (
    -- Direct ownership check
    "ownerId" = auth.uid()
    -- Check if user owns the account (via function to avoid RLS recursion)
    OR get_account_user_id("accountId") = auth.uid()
);

-- ============================================================================
-- FIX ACCOUNTOWNER DELETE POLICY
-- ============================================================================

DROP POLICY IF EXISTS "Users can delete account owners" ON "AccountOwner";

CREATE POLICY "Users can delete account owners" ON "AccountOwner" FOR DELETE
USING (
    -- Direct ownership check
    "ownerId" = auth.uid()
    -- Check if user owns the account (via function to avoid RLS recursion)
    OR get_account_user_id("accountId") = auth.uid()
);

-- ============================================================================
-- FIX ACCOUNT SELECT POLICY (UPDATE TO USE HELPER FUNCTION)
-- ============================================================================
-- Update Account SELECT policy to use helper function for AccountOwner check

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
    -- AccountOwner check (using helper function to avoid RLS recursion)
    OR can_access_account_via_accountowner("id")
);

-- ============================================================================
-- FIX ACCOUNT UPDATE POLICY
-- ============================================================================
-- Update Account UPDATE policy to use helper function for AccountOwner check

DROP POLICY IF EXISTS "Users can update household accounts" ON "Account";

CREATE POLICY "Users can update household accounts" ON "Account" FOR UPDATE
USING (
    -- Check household access via householdId
    can_access_household_data("householdId", 'write')
    -- Backward compatibility: direct userId match
    OR "userId" = auth.uid()
    -- AccountOwner check (using helper function to avoid RLS recursion)
    OR can_access_account_via_accountowner("id")
    -- Admin check
    OR is_current_user_admin()
)
WITH CHECK (
    -- Check household access via householdId
    can_access_household_data("householdId", 'write')
    -- Backward compatibility: direct userId match
    OR "userId" = auth.uid()
);

-- ============================================================================
-- FIX ACCOUNT DELETE POLICY
-- ============================================================================
-- Update Account DELETE policy to use helper function for AccountOwner check

DROP POLICY IF EXISTS "Users can delete household accounts" ON "Account";

CREATE POLICY "Users can delete household accounts" ON "Account" FOR DELETE
USING (
    -- Check household access via householdId
    can_access_household_data("householdId", 'delete')
    -- Backward compatibility: direct userId match
    OR "userId" = auth.uid()
    -- AccountOwner check (using helper function to avoid RLS recursion)
    OR can_access_account_via_accountowner("id")
    -- Admin check
    OR is_current_user_admin()
);

-- ============================================================================
-- NOTES
-- ============================================================================
-- The fix creates helper functions with SECURITY DEFINER to bypass RLS when
-- checking AccountOwner and Account relationships. This breaks the recursion cycle:
-- 
-- Before: Account policy -> AccountOwner -> Account policy -> ... (infinite loop)
-- After:  Account policy -> can_access_account_via_accountowner() -> AccountOwner (no RLS)
--         AccountOwner policy -> get_account_user_id() -> Account (no RLS)
--
-- This prevents infinite recursion while maintaining the same security checks.

