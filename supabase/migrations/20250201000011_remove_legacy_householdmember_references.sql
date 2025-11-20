-- ============================================================================
-- Remove Legacy HouseholdMember References from RLS Policies
-- ============================================================================
-- Date: 2025-02-01
-- Description: Removes all references to the old HouseholdMember table from RLS policies
--              and replaces them with householdId-based checks using HouseholdMemberNew
--              NOTE: This migration updates policies created by 20250201000006
--              It uses DROP POLICY IF EXISTS to ensure it works even if policies already exist
-- ============================================================================

-- ============================================================================
-- 1. FIX INVESTMENTTRANSACTION POLICIES
-- ============================================================================

-- SELECT: Replace HouseholdMember check with householdId check
DROP POLICY IF EXISTS "Users can view household investment transactions" ON "InvestmentTransaction";
CREATE POLICY "Users can view household investment transactions" ON "InvestmentTransaction" FOR SELECT
USING (
    "householdId" IN (SELECT household_id FROM get_user_accessible_households())
    OR EXISTS (
        SELECT 1 FROM "Account" a
        WHERE a."id" = "InvestmentTransaction"."accountId"
          AND a."type" = 'investment'::"text"
          AND a."householdId" IN (SELECT household_id FROM get_user_accessible_households())
    )
);

-- INSERT: Replace HouseholdMember check with householdId check
DROP POLICY IF EXISTS "Users can insert household investment transactions" ON "InvestmentTransaction";
CREATE POLICY "Users can insert household investment transactions" ON "InvestmentTransaction" FOR INSERT
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR EXISTS (
        SELECT 1 FROM "Account" a
        WHERE a."id" = "InvestmentTransaction"."accountId"
          AND a."type" = 'investment'::"text"
          AND can_access_household_data(a."householdId", 'write')
    )
);

-- UPDATE: Replace HouseholdMember check with householdId check
DROP POLICY IF EXISTS "Users can update household investment transactions" ON "InvestmentTransaction";
CREATE POLICY "Users can update household investment transactions" ON "InvestmentTransaction" FOR UPDATE
USING (
    can_access_household_data("householdId", 'write')
    OR EXISTS (
        SELECT 1 FROM "Account" a
        WHERE a."id" = "InvestmentTransaction"."accountId"
          AND a."type" = 'investment'::"text"
          AND can_access_household_data(a."householdId", 'write')
    )
)
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR EXISTS (
        SELECT 1 FROM "Account" a
        WHERE a."id" = "InvestmentTransaction"."accountId"
          AND a."type" = 'investment'::"text"
          AND can_access_household_data(a."householdId", 'write')
    )
);

-- DELETE: Replace HouseholdMember check with householdId check
DROP POLICY IF EXISTS "Users can delete household investment transactions" ON "InvestmentTransaction";
CREATE POLICY "Users can delete household investment transactions" ON "InvestmentTransaction" FOR DELETE
USING (
    can_access_household_data("householdId", 'delete')
    OR EXISTS (
        SELECT 1 FROM "Account" a
        WHERE a."id" = "InvestmentTransaction"."accountId"
          AND a."type" = 'investment'::"text"
          AND can_access_household_data(a."householdId", 'delete')
    )
);

-- ============================================================================
-- 2. FIX POSITION POLICIES
-- ============================================================================

-- SELECT: Replace HouseholdMember check with householdId check
DROP POLICY IF EXISTS "Users can view household positions" ON "Position";
CREATE POLICY "Users can view household positions" ON "Position" FOR SELECT
USING (
    "householdId" IN (SELECT household_id FROM get_user_accessible_households())
    OR EXISTS (
        SELECT 1 FROM "InvestmentAccount" ia
        WHERE ia."id" = "Position"."accountId"
          AND ia."householdId" IN (SELECT household_id FROM get_user_accessible_households())
    )
);

-- INSERT: Replace HouseholdMember check with householdId check
DROP POLICY IF EXISTS "Users can insert household positions" ON "Position";
CREATE POLICY "Users can insert household positions" ON "Position" FOR INSERT
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR EXISTS (
        SELECT 1 FROM "InvestmentAccount" ia
        WHERE ia."id" = "Position"."accountId"
          AND can_access_household_data(ia."householdId", 'write')
    )
);

-- UPDATE: Replace HouseholdMember check with householdId check
DROP POLICY IF EXISTS "Users can update household positions" ON "Position";
CREATE POLICY "Users can update household positions" ON "Position" FOR UPDATE
USING (
    can_access_household_data("householdId", 'write')
    OR EXISTS (
        SELECT 1 FROM "InvestmentAccount" ia
        WHERE ia."id" = "Position"."accountId"
          AND can_access_household_data(ia."householdId", 'write')
    )
)
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR EXISTS (
        SELECT 1 FROM "InvestmentAccount" ia
        WHERE ia."id" = "Position"."accountId"
          AND can_access_household_data(ia."householdId", 'write')
    )
);

-- DELETE: Replace HouseholdMember check with householdId check
DROP POLICY IF EXISTS "Users can delete household positions" ON "Position";
CREATE POLICY "Users can delete household positions" ON "Position" FOR DELETE
USING (
    can_access_household_data("householdId", 'delete')
    OR EXISTS (
        SELECT 1 FROM "InvestmentAccount" ia
        WHERE ia."id" = "Position"."accountId"
          AND can_access_household_data(ia."householdId", 'delete')
    )
);

-- ============================================================================
-- 3. FIX EXECUTION POLICIES
-- ============================================================================

-- SELECT: Replace HouseholdMember check with householdId check
DROP POLICY IF EXISTS "Users can view household executions" ON "Execution";
CREATE POLICY "Users can view household executions" ON "Execution" FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM "InvestmentAccount" ia
        WHERE ia."id" = "Execution"."accountId"
          AND ia."householdId" IN (SELECT household_id FROM get_user_accessible_households())
    )
);

-- INSERT: Replace HouseholdMember check with householdId check
DROP POLICY IF EXISTS "Users can insert household executions" ON "Execution";
CREATE POLICY "Users can insert household executions" ON "Execution" FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "InvestmentAccount" ia
        WHERE ia."id" = "Execution"."accountId"
          AND can_access_household_data(ia."householdId", 'write')
    )
);

-- UPDATE: Replace HouseholdMember check with householdId check
DROP POLICY IF EXISTS "Users can update household executions" ON "Execution";
CREATE POLICY "Users can update household executions" ON "Execution" FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM "InvestmentAccount" ia
        WHERE ia."id" = "Execution"."accountId"
          AND can_access_household_data(ia."householdId", 'write')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "InvestmentAccount" ia
        WHERE ia."id" = "Execution"."accountId"
          AND can_access_household_data(ia."householdId", 'write')
    )
);

-- DELETE: Replace HouseholdMember check with householdId check
DROP POLICY IF EXISTS "Users can delete household executions" ON "Execution";
CREATE POLICY "Users can delete household executions" ON "Execution" FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM "InvestmentAccount" ia
        WHERE ia."id" = "Execution"."accountId"
          AND can_access_household_data(ia."householdId", 'delete')
    )
);

-- ============================================================================
-- 4. FIX ORDER POLICIES
-- ============================================================================

-- SELECT: Replace HouseholdMember check with householdId check
DROP POLICY IF EXISTS "Users can view household orders" ON "Order";
CREATE POLICY "Users can view household orders" ON "Order" FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM "InvestmentAccount" ia
        WHERE ia."id" = "Order"."accountId"
          AND ia."householdId" IN (SELECT household_id FROM get_user_accessible_households())
    )
);

-- INSERT: Replace HouseholdMember check with householdId check
DROP POLICY IF EXISTS "Users can insert household orders" ON "Order";
CREATE POLICY "Users can insert household orders" ON "Order" FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "InvestmentAccount" ia
        WHERE ia."id" = "Order"."accountId"
          AND can_access_household_data(ia."householdId", 'write')
    )
);

-- UPDATE: Replace HouseholdMember check with householdId check
DROP POLICY IF EXISTS "Users can update household orders" ON "Order";
CREATE POLICY "Users can update household orders" ON "Order" FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM "InvestmentAccount" ia
        WHERE ia."id" = "Order"."accountId"
          AND can_access_household_data(ia."householdId", 'write')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "InvestmentAccount" ia
        WHERE ia."id" = "Order"."accountId"
          AND can_access_household_data(ia."householdId", 'write')
    )
);

-- DELETE: Replace HouseholdMember check with householdId check
DROP POLICY IF EXISTS "Users can delete household orders" ON "Order";
CREATE POLICY "Users can delete household orders" ON "Order" FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM "InvestmentAccount" ia
        WHERE ia."id" = "Order"."accountId"
          AND can_access_household_data(ia."householdId", 'delete')
    )
);

-- ============================================================================
-- 5. FIX SIMPLEINVESTMENTENTRY POLICIES
-- ============================================================================

-- SELECT: Replace HouseholdMember check with householdId check
DROP POLICY IF EXISTS "Users can view household simple investment entries" ON "SimpleInvestmentEntry";
CREATE POLICY "Users can view household simple investment entries" ON "SimpleInvestmentEntry" FOR SELECT
USING (
    "householdId" IN (SELECT household_id FROM get_user_accessible_households())
    OR EXISTS (
        SELECT 1 FROM "Account" a
        WHERE a."id" = "SimpleInvestmentEntry"."accountId"
          AND a."householdId" IN (SELECT household_id FROM get_user_accessible_households())
    )
);

-- INSERT: Replace HouseholdMember check with householdId check
DROP POLICY IF EXISTS "Users can insert household simple investment entries" ON "SimpleInvestmentEntry";
CREATE POLICY "Users can insert household simple investment entries" ON "SimpleInvestmentEntry" FOR INSERT
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR EXISTS (
        SELECT 1 FROM "Account" a
        WHERE a."id" = "SimpleInvestmentEntry"."accountId"
          AND can_access_household_data(a."householdId", 'write')
    )
);

-- UPDATE: Replace HouseholdMember check with householdId check
DROP POLICY IF EXISTS "Users can update household simple investment entries" ON "SimpleInvestmentEntry";
CREATE POLICY "Users can update household simple investment entries" ON "SimpleInvestmentEntry" FOR UPDATE
USING (
    can_access_household_data("householdId", 'write')
    OR EXISTS (
        SELECT 1 FROM "Account" a
        WHERE a."id" = "SimpleInvestmentEntry"."accountId"
          AND can_access_household_data(a."householdId", 'write')
    )
)
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR EXISTS (
        SELECT 1 FROM "Account" a
        WHERE a."id" = "SimpleInvestmentEntry"."accountId"
          AND can_access_household_data(a."householdId", 'write')
    )
);

-- DELETE: Replace HouseholdMember check with householdId check
DROP POLICY IF EXISTS "Users can delete household simple investment entries" ON "SimpleInvestmentEntry";
CREATE POLICY "Users can delete household simple investment entries" ON "SimpleInvestmentEntry" FOR DELETE
USING (
    can_access_household_data("householdId", 'delete')
    OR EXISTS (
        SELECT 1 FROM "Account" a
        WHERE a."id" = "SimpleInvestmentEntry"."accountId"
          AND can_access_household_data(a."householdId", 'delete')
    )
);

-- ============================================================================
-- 6. FIX ACCOUNTINVESTMENTVALUE POLICIES
-- ============================================================================

-- SELECT: Replace HouseholdMember check with householdId check
DROP POLICY IF EXISTS "Users can view household account investment values" ON "AccountInvestmentValue";
CREATE POLICY "Users can view household account investment values" ON "AccountInvestmentValue" FOR SELECT
USING (
    "householdId" IN (SELECT household_id FROM get_user_accessible_households())
    OR EXISTS (
        SELECT 1 FROM "Account" a
        WHERE a."id" = "AccountInvestmentValue"."accountId"
          AND a."householdId" IN (SELECT household_id FROM get_user_accessible_households())
    )
);

-- INSERT: Replace HouseholdMember check with householdId check
DROP POLICY IF EXISTS "Users can insert household account investment values" ON "AccountInvestmentValue";
CREATE POLICY "Users can insert household account investment values" ON "AccountInvestmentValue" FOR INSERT
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR EXISTS (
        SELECT 1 FROM "Account" a
        WHERE a."id" = "AccountInvestmentValue"."accountId"
          AND can_access_household_data(a."householdId", 'write')
    )
);

-- UPDATE: Replace HouseholdMember check with householdId check
DROP POLICY IF EXISTS "Users can update household account investment values" ON "AccountInvestmentValue";
CREATE POLICY "Users can update household account investment values" ON "AccountInvestmentValue" FOR UPDATE
USING (
    can_access_household_data("householdId", 'write')
    OR EXISTS (
        SELECT 1 FROM "Account" a
        WHERE a."id" = "AccountInvestmentValue"."accountId"
          AND can_access_household_data(a."householdId", 'write')
    )
)
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR EXISTS (
        SELECT 1 FROM "Account" a
        WHERE a."id" = "AccountInvestmentValue"."accountId"
          AND can_access_household_data(a."householdId", 'write')
    )
);

-- DELETE: Replace HouseholdMember check with householdId check
DROP POLICY IF EXISTS "Users can delete household account investment values" ON "AccountInvestmentValue";
CREATE POLICY "Users can delete household account investment values" ON "AccountInvestmentValue" FOR DELETE
USING (
    can_access_household_data("householdId", 'delete')
    OR EXISTS (
        SELECT 1 FROM "Account" a
        WHERE a."id" = "AccountInvestmentValue"."accountId"
          AND can_access_household_data(a."householdId", 'delete')
    )
);

-- ============================================================================
-- NOTES
-- ============================================================================
-- All references to the old HouseholdMember table have been replaced with
-- householdId-based checks using HouseholdMemberNew and the helper functions
-- get_user_accessible_households() and can_access_household_data().
-- This ensures compatibility with the new household-based architecture while
-- maintaining backward compatibility with userId-based checks.

