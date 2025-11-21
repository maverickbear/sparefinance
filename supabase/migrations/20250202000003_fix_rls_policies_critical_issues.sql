-- ============================================================================
-- Fix Critical RLS Policy Issues
-- ============================================================================
-- Date: 2025-02-02
-- Description: Fixes critical RLS policy issues identified in analysis:
--              1. Add missing policies for UserBlockHistory
--              2. Fix Account UPDATE WITH CHECK to include AccountOwner and admin
--              3. Add household policies for TransactionSync DELETE/INSERT/UPDATE
--              4. Remove redundant policies for Execution and Order
-- ============================================================================

-- ============================================================================
-- 1. ADD POLICIES FOR UserBlockHistory
-- ============================================================================
-- Critical: Table has RLS enabled but no policies, blocking all access

-- SELECT: Admins can view all, users can view their own history
CREATE POLICY "Admins can view all block history" ON "public"."UserBlockHistory"
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM "public"."User"
        WHERE "User"."id" = auth.uid()
          AND "User"."role" IN ('admin', 'super_admin')
    )
);

CREATE POLICY "Users can view own block history" ON "public"."UserBlockHistory"
FOR SELECT
USING ("userId" = auth.uid());

-- INSERT: Only admins can insert (via service_role or admin check)
CREATE POLICY "Admins can insert block history" ON "public"."UserBlockHistory"
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM "public"."User"
        WHERE "User"."id" = auth.uid()
          AND "User"."role" IN ('admin', 'super_admin')
    )
    OR auth.role() = 'service_role'
);

-- UPDATE: No one can update (history should be immutable)
-- No policy needed - default RLS behavior blocks all updates

-- DELETE: No one can delete (history should be immutable)
-- No policy needed - default RLS behavior blocks all deletes

COMMENT ON POLICY "Admins can view all block history" ON "public"."UserBlockHistory" IS 
'Allows admins to view all user block history for auditing purposes';

COMMENT ON POLICY "Users can view own block history" ON "public"."UserBlockHistory" IS 
'Allows users to view their own block/unblock history';

COMMENT ON POLICY "Admins can insert block history" ON "public"."UserBlockHistory" IS 
'Allows admins and service_role to insert block history records';

-- ============================================================================
-- 2. FIX Account UPDATE WITH CHECK
-- ============================================================================
-- Issue: USING allows AccountOwner access, but WITH CHECK doesn't
-- This allows users to see accounts but not update them via AccountOwner

DROP POLICY IF EXISTS "Users can update household accounts" ON "public"."Account";

CREATE POLICY "Users can update household accounts" ON "public"."Account"
FOR UPDATE
USING (
    "public"."can_access_household_data"("householdId", 'write'::"text")
    OR "userId" = auth.uid()
    OR "public"."can_access_account_via_accountowner"("id")
    OR "public"."is_current_user_admin"()
)
WITH CHECK (
    "public"."can_access_household_data"("householdId", 'write'::"text")
    OR "userId" = auth.uid()
    OR "public"."can_access_account_via_accountowner"("id")
    OR "public"."is_current_user_admin"()
);

COMMENT ON POLICY "Users can update household accounts" ON "public"."Account" IS 
'Allows users to update accounts via household access, direct ownership, AccountOwner relationship, or admin role. WITH CHECK now matches USING to prevent access issues.';

-- ============================================================================
-- 3. ADD HOUSEHOLD POLICIES FOR TransactionSync
-- ============================================================================
-- Issue: SELECT has household policy, but DELETE/INSERT/UPDATE only have "own accounts"
-- This prevents household members from managing TransactionSync records

-- DELETE: Add household policy
DROP POLICY IF EXISTS "Users can delete TransactionSync for their accounts" ON "public"."TransactionSync";

CREATE POLICY "Users can delete household TransactionSync" ON "public"."TransactionSync"
FOR DELETE
USING (
    -- Household access
    (
        "householdId" IN (
            SELECT household_id
            FROM "public"."get_user_accessible_households"()
        )
    )
    -- Backward compatibility: own accounts
    OR EXISTS (
        SELECT 1
        FROM "public"."Account" "a"
        WHERE "a"."id" = "TransactionSync"."accountId"
          AND "a"."userId" = auth.uid()
    )
    -- AccountOwner access
    OR EXISTS (
        SELECT 1
        FROM "public"."Account" "a"
        WHERE "a"."id" = "TransactionSync"."accountId"
          AND EXISTS (
              SELECT 1
              FROM "public"."AccountOwner" "ao"
              WHERE "ao"."accountId" = "a"."id"
                AND "ao"."ownerId" = auth.uid()
          )
    )
);

-- INSERT: Add household policy
DROP POLICY IF EXISTS "Users can insert TransactionSync for their accounts" ON "public"."TransactionSync";

CREATE POLICY "Users can insert household TransactionSync" ON "public"."TransactionSync"
FOR INSERT
WITH CHECK (
    -- Household access (write permission required)
    (
        "householdId" IS NOT NULL
        AND "householdId" IN (
            SELECT household_id
            FROM "public"."get_user_admin_household_ids"()
        )
    )
    -- Backward compatibility: own accounts
    OR EXISTS (
        SELECT 1
        FROM "public"."Account" "a"
        WHERE "a"."id" = "TransactionSync"."accountId"
          AND "a"."userId" = auth.uid()
    )
    -- AccountOwner access (write permission)
    OR EXISTS (
        SELECT 1
        FROM "public"."Account" "a"
        WHERE "a"."id" = "TransactionSync"."accountId"
          AND EXISTS (
              SELECT 1
              FROM "public"."AccountOwner" "ao"
              WHERE "ao"."accountId" = "a"."id"
                AND "ao"."ownerId" = auth.uid()
          )
          AND "public"."can_access_household_data"("a"."householdId", 'write'::"text")
    )
);

-- UPDATE: Add household policy
DROP POLICY IF EXISTS "Users can update TransactionSync for their accounts" ON "public"."TransactionSync";

CREATE POLICY "Users can update household TransactionSync" ON "public"."TransactionSync"
FOR UPDATE
USING (
    -- Household access
    (
        "householdId" IN (
            SELECT household_id
            FROM "public"."get_user_accessible_households"()
        )
    )
    -- Backward compatibility: own accounts
    OR EXISTS (
        SELECT 1
        FROM "public"."Account" "a"
        WHERE "a"."id" = "TransactionSync"."accountId"
          AND "a"."userId" = auth.uid()
    )
    -- AccountOwner access
    OR EXISTS (
        SELECT 1
        FROM "public"."Account" "a"
        WHERE "a"."id" = "TransactionSync"."accountId"
          AND EXISTS (
              SELECT 1
              FROM "public"."AccountOwner" "ao"
              WHERE "ao"."accountId" = "a"."id"
                AND "ao"."ownerId" = auth.uid()
          )
    )
)
WITH CHECK (
    -- Same conditions as USING
    (
        "householdId" IN (
            SELECT household_id
            FROM "public"."get_user_accessible_households"()
        )
    )
    OR EXISTS (
        SELECT 1
        FROM "public"."Account" "a"
        WHERE "a"."id" = "TransactionSync"."accountId"
          AND "a"."userId" = auth.uid()
    )
    OR EXISTS (
        SELECT 1
        FROM "public"."Account" "a"
        WHERE "a"."id" = "TransactionSync"."accountId"
          AND EXISTS (
              SELECT 1
              FROM "public"."AccountOwner" "ao"
              WHERE "ao"."accountId" = "a"."id"
                AND "ao"."ownerId" = auth.uid()
          )
    )
);

COMMENT ON POLICY "Users can delete household TransactionSync" ON "public"."TransactionSync" IS 
'Allows users to delete TransactionSync records via household access, own accounts, or AccountOwner relationship';

COMMENT ON POLICY "Users can insert household TransactionSync" ON "public"."TransactionSync" IS 
'Allows admins/owners to insert TransactionSync records for household accounts, own accounts, or AccountOwner accounts';

COMMENT ON POLICY "Users can update household TransactionSync" ON "public"."TransactionSync" IS 
'Allows users to update TransactionSync records via household access, own accounts, or AccountOwner relationship';

-- ============================================================================
-- 4. REMOVE REDUNDANT POLICIES FOR Execution
-- ============================================================================
-- Issue: Both "own accounts" and "household" policies exist
-- The "household" policy already covers "own accounts" cases
-- Keeping only "household" policies reduces redundancy

DROP POLICY IF EXISTS "Users can delete executions for own accounts" ON "public"."Execution";
DROP POLICY IF EXISTS "Users can insert executions for own accounts" ON "public"."Execution";
-- Note: UPDATE policy for Execution doesn't have "own accounts" version, so no need to drop

COMMENT ON POLICY "Users can delete household executions" ON "public"."Execution" IS 
'Allows users to delete Execution records via household access. Replaces redundant "own accounts" policy.';

COMMENT ON POLICY "Users can insert household executions" ON "public"."Execution" IS 
'Allows users to insert Execution records via household access. Replaces redundant "own accounts" policy.';

-- ============================================================================
-- 5. REMOVE REDUNDANT POLICIES FOR Order
-- ============================================================================
-- Issue: Both "own accounts" and "household" policies exist for DELETE and INSERT
-- The "household" policy already covers "own accounts" cases

DROP POLICY IF EXISTS "Users can delete orders for own accounts" ON "public"."Order";
DROP POLICY IF EXISTS "Users can insert orders for own accounts" ON "public"."Order";
-- Note: UPDATE policy for Order doesn't have "own accounts" version, so no need to drop

COMMENT ON POLICY "Users can delete household orders" ON "public"."Order" IS 
'Allows users to delete Order records via household access. Replaces redundant "own accounts" policy.';

COMMENT ON POLICY "Users can insert household orders" ON "public"."Order" IS 
'Allows users to insert Order records via household access. Replaces redundant "own accounts" policy.';

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. UserBlockHistory: Policies added for SELECT (admins + own), INSERT (admins only)
--    UPDATE and DELETE intentionally blocked (history is immutable)
--
-- 2. Account UPDATE: WITH CHECK now matches USING to prevent access issues
--
-- 3. TransactionSync: All operations now support household access consistently
--
-- 4. Execution/Order: Removed redundant "own accounts" policies to reduce overhead
--    The "household" policies already cover these cases
--
-- All changes maintain backward compatibility with userId-based access

