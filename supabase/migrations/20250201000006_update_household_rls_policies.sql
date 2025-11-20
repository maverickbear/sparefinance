-- ============================================================================
-- Update RLS Policies for Household-Based Architecture
-- ============================================================================
-- Date: 2025-02-01
-- Description: Updates all RLS policies to use household-based access control
--              with role-based permissions (read: all members, write/delete: owner/admin)
--              Maintains backward compatibility with userId
-- ============================================================================

-- ============================================================================
-- 1. TRANSACTION POLICIES
-- ============================================================================

-- SELECT: All active members can read
DROP POLICY IF EXISTS "Users can view own transactions" ON "Transaction";
DROP POLICY IF EXISTS "Users can view household transactions" ON "Transaction";
CREATE POLICY "Users can view household transactions" ON "Transaction" FOR SELECT
USING (
    "householdId" IN (SELECT household_id FROM get_user_accessible_households())
    OR "userId" = auth.uid() -- Backward compatibility
);

-- INSERT/UPDATE: Only owner/admin can write
DROP POLICY IF EXISTS "Users can insert own transactions" ON "Transaction";
DROP POLICY IF EXISTS "Users can insert household transactions" ON "Transaction";
CREATE POLICY "Users can insert household transactions" ON "Transaction" FOR INSERT
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
);

DROP POLICY IF EXISTS "Users can update own transactions" ON "Transaction";
DROP POLICY IF EXISTS "Users can update household transactions" ON "Transaction";
CREATE POLICY "Users can update household transactions" ON "Transaction" FOR UPDATE
USING (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
)
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
);

-- DELETE: Only owner/admin can delete
DROP POLICY IF EXISTS "Users can delete own transactions" ON "Transaction";
DROP POLICY IF EXISTS "Users can delete household transactions" ON "Transaction";
CREATE POLICY "Users can delete household transactions" ON "Transaction" FOR DELETE
USING (
    can_access_household_data("householdId", 'delete')
    OR "userId" = auth.uid() -- Backward compatibility
);

-- ============================================================================
-- 2. ACCOUNT POLICIES
-- ============================================================================

-- SELECT: All active members can read
-- NOTE: Using inline household check to avoid RLS recursion issues
DROP POLICY IF EXISTS "Users can view own accounts" ON "Account";
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

-- INSERT/UPDATE: Only owner/admin can write
DROP POLICY IF EXISTS "Users can insert own accounts" ON "Account";
DROP POLICY IF EXISTS "Users can insert household accounts" ON "Account";
CREATE POLICY "Users can insert household accounts" ON "Account" FOR INSERT
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
);

DROP POLICY IF EXISTS "Users can update own accounts" ON "Account";
DROP POLICY IF EXISTS "Users can update household accounts" ON "Account";
CREATE POLICY "Users can update household accounts" ON "Account" FOR UPDATE
USING (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
    OR EXISTS (
        SELECT 1 FROM "AccountOwner"
        WHERE "accountId" = "Account"."id" AND "ownerId" = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM "User"
        WHERE "id" = auth.uid() AND "role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])
    )
)
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
);

-- DELETE: Only owner/admin can delete
DROP POLICY IF EXISTS "Users can delete own accounts" ON "Account";
DROP POLICY IF EXISTS "Users can delete household accounts" ON "Account";
CREATE POLICY "Users can delete household accounts" ON "Account" FOR DELETE
USING (
    can_access_household_data("householdId", 'delete')
    OR "userId" = auth.uid() -- Backward compatibility
    OR EXISTS (
        SELECT 1 FROM "AccountOwner"
        WHERE "accountId" = "Account"."id" AND "ownerId" = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM "User"
        WHERE "id" = auth.uid() AND "role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])
    )
);

-- ============================================================================
-- 3. INVESTMENTACCOUNT POLICIES
-- ============================================================================

-- SELECT: All active members can read
DROP POLICY IF EXISTS "Users can view own investment accounts" ON "InvestmentAccount";
DROP POLICY IF EXISTS "Users can view household investment accounts" ON "InvestmentAccount";
CREATE POLICY "Users can view household investment accounts" ON "InvestmentAccount" FOR SELECT
USING (
    "householdId" IN (SELECT household_id FROM get_user_accessible_households())
    OR "userId" = auth.uid() -- Backward compatibility
);

-- INSERT/UPDATE: Only owner/admin can write
DROP POLICY IF EXISTS "Users can insert own investment accounts" ON "InvestmentAccount";
DROP POLICY IF EXISTS "Users can insert household investment accounts" ON "InvestmentAccount";
CREATE POLICY "Users can insert household investment accounts" ON "InvestmentAccount" FOR INSERT
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
);

DROP POLICY IF EXISTS "Users can update own investment accounts" ON "InvestmentAccount";
DROP POLICY IF EXISTS "Users can update household investment accounts" ON "InvestmentAccount";
CREATE POLICY "Users can update household investment accounts" ON "InvestmentAccount" FOR UPDATE
USING (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
)
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
);

-- DELETE: Only owner/admin can delete
DROP POLICY IF EXISTS "Users can delete own investment accounts" ON "InvestmentAccount";
DROP POLICY IF EXISTS "Users can delete household investment accounts" ON "InvestmentAccount";
CREATE POLICY "Users can delete household investment accounts" ON "InvestmentAccount" FOR DELETE
USING (
    can_access_household_data("householdId", 'delete')
    OR "userId" = auth.uid() -- Backward compatibility
);

-- ============================================================================
-- 4. INVESTMENTTRANSACTION POLICIES
-- ============================================================================

-- SELECT: All active members can read
DROP POLICY IF EXISTS "Users can view own investment transactions" ON "InvestmentTransaction";
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

-- INSERT/UPDATE: Only owner/admin can write
DROP POLICY IF EXISTS "Users can insert own investment transactions" ON "InvestmentTransaction";
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

DROP POLICY IF EXISTS "Users can update own investment transactions" ON "InvestmentTransaction";
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

-- DELETE: Only owner/admin can delete
DROP POLICY IF EXISTS "Users can delete own investment transactions" ON "InvestmentTransaction";
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
-- 5. POSITION POLICIES
-- ============================================================================

-- SELECT: All active members can read
DROP POLICY IF EXISTS "Users can view positions for own accounts" ON "Position";
DROP POLICY IF EXISTS "Users can view group positions" ON "Position";
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

-- INSERT/UPDATE/DELETE: Only owner/admin can modify
DROP POLICY IF EXISTS "Users can insert positions for own accounts" ON "Position";
DROP POLICY IF EXISTS "Users can insert group positions" ON "Position";
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

DROP POLICY IF EXISTS "Users can update positions for own accounts" ON "Position";
DROP POLICY IF EXISTS "Users can update group positions" ON "Position";
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

DROP POLICY IF EXISTS "Users can delete positions for own accounts" ON "Position";
DROP POLICY IF EXISTS "Users can delete group positions" ON "Position";
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
-- 6. EXECUTION POLICIES
-- ============================================================================

-- SELECT: All active members can read
DROP POLICY IF EXISTS "Users can view executions for own accounts" ON "Execution";
DROP POLICY IF EXISTS "Users can view group executions" ON "Execution";
DROP POLICY IF EXISTS "Users can view household executions" ON "Execution";
CREATE POLICY "Users can view household executions" ON "Execution" FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM "InvestmentAccount" ia
        WHERE ia."id" = "Execution"."accountId"
          AND ia."householdId" IN (SELECT household_id FROM get_user_accessible_households())
    )
);

-- INSERT/UPDATE/DELETE: Only owner/admin can modify
DROP POLICY IF EXISTS "Users can insert household executions" ON "Execution";
CREATE POLICY "Users can insert household executions" ON "Execution" FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "InvestmentAccount" ia
        WHERE ia."id" = "Execution"."accountId"
          AND can_access_household_data(ia."householdId", 'write')
    )
);

DROP POLICY IF EXISTS "Users can update executions for own accounts" ON "Execution";
DROP POLICY IF EXISTS "Users can update group executions" ON "Execution";
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
-- 7. ORDER POLICIES
-- ============================================================================

-- SELECT: All active members can read
DROP POLICY IF EXISTS "Users can view orders for own accounts" ON "Order";
DROP POLICY IF EXISTS "Users can view group orders" ON "Order";
DROP POLICY IF EXISTS "Users can view household orders" ON "Order";
CREATE POLICY "Users can view household orders" ON "Order" FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM "InvestmentAccount" ia
        WHERE ia."id" = "Order"."accountId"
          AND ia."householdId" IN (SELECT household_id FROM get_user_accessible_households())
    )
);

-- INSERT/UPDATE/DELETE: Only owner/admin can modify
DROP POLICY IF EXISTS "Users can insert household orders" ON "Order";
CREATE POLICY "Users can insert household orders" ON "Order" FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "InvestmentAccount" ia
        WHERE ia."id" = "Order"."accountId"
          AND can_access_household_data(ia."householdId", 'write')
    )
);

DROP POLICY IF EXISTS "Users can update orders for own accounts" ON "Order";
DROP POLICY IF EXISTS "Users can update group orders" ON "Order";
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
-- 8. BUDGET POLICIES
-- ============================================================================

-- SELECT: All active members can read
DROP POLICY IF EXISTS "Users can view own budgets" ON "Budget";
DROP POLICY IF EXISTS "Users can view household budgets" ON "Budget";
CREATE POLICY "Users can view household budgets" ON "Budget" FOR SELECT
USING (
    "householdId" IN (SELECT household_id FROM get_user_accessible_households())
    OR "userId" = auth.uid() -- Backward compatibility
);

-- INSERT/UPDATE: Only owner/admin can write
DROP POLICY IF EXISTS "Users can insert own budgets" ON "Budget";
DROP POLICY IF EXISTS "Users can insert household budgets" ON "Budget";
CREATE POLICY "Users can insert household budgets" ON "Budget" FOR INSERT
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
);

DROP POLICY IF EXISTS "Users can update own budgets" ON "Budget";
DROP POLICY IF EXISTS "Users can update household budgets" ON "Budget";
CREATE POLICY "Users can update household budgets" ON "Budget" FOR UPDATE
USING (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
)
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
);

-- DELETE: Only owner/admin can delete
DROP POLICY IF EXISTS "Users can delete own budgets" ON "Budget";
DROP POLICY IF EXISTS "Users can delete household budgets" ON "Budget";
CREATE POLICY "Users can delete household budgets" ON "Budget" FOR DELETE
USING (
    can_access_household_data("householdId", 'delete')
    OR "userId" = auth.uid() -- Backward compatibility
);

-- BudgetCategory: SELECT based on Budget access
DROP POLICY IF EXISTS "Users can view own budget categories" ON "BudgetCategory";
DROP POLICY IF EXISTS "Users can view group budget categories" ON "BudgetCategory";
DROP POLICY IF EXISTS "Users can view household budget categories" ON "BudgetCategory";
CREATE POLICY "Users can view household budget categories" ON "BudgetCategory" FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM "Budget"
        WHERE "Budget"."id" = "BudgetCategory"."budgetId"
          AND (
            "Budget"."householdId" IN (SELECT household_id FROM get_user_accessible_households())
            OR "Budget"."userId" = auth.uid() -- Backward compatibility
          )
    )
);

-- ============================================================================
-- 9. GOAL POLICIES
-- ============================================================================

-- SELECT: All active members can read
DROP POLICY IF EXISTS "Users can view own goals" ON "Goal";
DROP POLICY IF EXISTS "Users can view household goals" ON "Goal";
CREATE POLICY "Users can view household goals" ON "Goal" FOR SELECT
USING (
    "householdId" IN (SELECT household_id FROM get_user_accessible_households())
    OR "userId" = auth.uid() -- Backward compatibility
);

-- INSERT/UPDATE: Only owner/admin can write
DROP POLICY IF EXISTS "Users can insert own goals" ON "Goal";
DROP POLICY IF EXISTS "Users can insert household goals" ON "Goal";
CREATE POLICY "Users can insert household goals" ON "Goal" FOR INSERT
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
);

DROP POLICY IF EXISTS "Users can update own goals" ON "Goal";
DROP POLICY IF EXISTS "Users can update household goals" ON "Goal";
CREATE POLICY "Users can update household goals" ON "Goal" FOR UPDATE
USING (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
)
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
);

-- DELETE: Only owner/admin can delete
DROP POLICY IF EXISTS "Users can delete own goals" ON "Goal";
DROP POLICY IF EXISTS "Users can delete household goals" ON "Goal";
CREATE POLICY "Users can delete household goals" ON "Goal" FOR DELETE
USING (
    can_access_household_data("householdId", 'delete')
    OR "userId" = auth.uid() -- Backward compatibility
);

-- ============================================================================
-- 10. DEBT POLICIES
-- ============================================================================

-- SELECT: All active members can read
DROP POLICY IF EXISTS "Users can view own debts" ON "Debt";
DROP POLICY IF EXISTS "Users can view household debts" ON "Debt";
CREATE POLICY "Users can view household debts" ON "Debt" FOR SELECT
USING (
    "householdId" IN (SELECT household_id FROM get_user_accessible_households())
    OR "userId" = auth.uid() -- Backward compatibility
);

-- INSERT/UPDATE: Only owner/admin can write
DROP POLICY IF EXISTS "Users can insert own debts" ON "Debt";
DROP POLICY IF EXISTS "Users can insert household debts" ON "Debt";
CREATE POLICY "Users can insert household debts" ON "Debt" FOR INSERT
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
);

DROP POLICY IF EXISTS "Users can update own debts" ON "Debt";
DROP POLICY IF EXISTS "Users can update household debts" ON "Debt";
CREATE POLICY "Users can update household debts" ON "Debt" FOR UPDATE
USING (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
)
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
);

-- DELETE: Only owner/admin can delete
DROP POLICY IF EXISTS "Users can delete own debts" ON "Debt";
DROP POLICY IF EXISTS "Users can delete household debts" ON "Debt";
CREATE POLICY "Users can delete household debts" ON "Debt" FOR DELETE
USING (
    can_access_household_data("householdId", 'delete')
    OR "userId" = auth.uid() -- Backward compatibility
);

-- ============================================================================
-- 11. PLANNEDPAYMENT POLICIES
-- ============================================================================

-- SELECT: All active members can read
DROP POLICY IF EXISTS "Users can view own planned payments" ON "PlannedPayment";
DROP POLICY IF EXISTS "Users can view household planned payments" ON "PlannedPayment";
CREATE POLICY "Users can view household planned payments" ON "PlannedPayment" FOR SELECT
USING (
    "householdId" IN (SELECT household_id FROM get_user_accessible_households())
    OR "userId" = auth.uid() -- Backward compatibility
);

-- INSERT/UPDATE: Only owner/admin can write
DROP POLICY IF EXISTS "Users can insert own planned payments" ON "PlannedPayment";
DROP POLICY IF EXISTS "Users can insert household planned payments" ON "PlannedPayment";
CREATE POLICY "Users can insert household planned payments" ON "PlannedPayment" FOR INSERT
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
);

DROP POLICY IF EXISTS "Users can update own planned payments" ON "PlannedPayment";
DROP POLICY IF EXISTS "Users can update household planned payments" ON "PlannedPayment";
CREATE POLICY "Users can update household planned payments" ON "PlannedPayment" FOR UPDATE
USING (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
)
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
);

-- DELETE: Only owner/admin can delete
DROP POLICY IF EXISTS "Users can delete own planned payments" ON "PlannedPayment";
DROP POLICY IF EXISTS "Users can delete household planned payments" ON "PlannedPayment";
CREATE POLICY "Users can delete household planned payments" ON "PlannedPayment" FOR DELETE
USING (
    can_access_household_data("householdId", 'delete')
    OR "userId" = auth.uid() -- Backward compatibility
);

-- ============================================================================
-- 12. USERSERVICESUBSCRIPTION POLICIES
-- ============================================================================

-- SELECT: All active members can read
DROP POLICY IF EXISTS "Users can view own subscriptions" ON "UserServiceSubscription";
DROP POLICY IF EXISTS "Users can view household service subscriptions" ON "UserServiceSubscription";
CREATE POLICY "Users can view household service subscriptions" ON "UserServiceSubscription" FOR SELECT
USING (
    "householdId" IN (SELECT household_id FROM get_user_accessible_households())
    OR "userId" = auth.uid() -- Backward compatibility
);

-- INSERT/UPDATE: Only owner/admin can write
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON "UserServiceSubscription";
DROP POLICY IF EXISTS "Users can insert household service subscriptions" ON "UserServiceSubscription";
CREATE POLICY "Users can insert household service subscriptions" ON "UserServiceSubscription" FOR INSERT
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
);

DROP POLICY IF EXISTS "Users can update own subscriptions" ON "UserServiceSubscription";
DROP POLICY IF EXISTS "Users can update household service subscriptions" ON "UserServiceSubscription";
CREATE POLICY "Users can update household service subscriptions" ON "UserServiceSubscription" FOR UPDATE
USING (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
)
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
);

-- DELETE: Only owner/admin can delete
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON "UserServiceSubscription";
DROP POLICY IF EXISTS "Users can delete household service subscriptions" ON "UserServiceSubscription";
CREATE POLICY "Users can delete household service subscriptions" ON "UserServiceSubscription" FOR DELETE
USING (
    can_access_household_data("householdId", 'delete')
    OR "userId" = auth.uid() -- Backward compatibility
);

-- ============================================================================
-- 13. SIMPLEINVESTMENTENTRY POLICIES
-- ============================================================================

-- SELECT: All active members can read
DROP POLICY IF EXISTS "Users can view own simple investment entries" ON "SimpleInvestmentEntry";
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

-- INSERT/UPDATE/DELETE: Only owner/admin can modify
DROP POLICY IF EXISTS "Users can insert own simple investment entries" ON "SimpleInvestmentEntry";
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

DROP POLICY IF EXISTS "Users can update own simple investment entries" ON "SimpleInvestmentEntry";
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

DROP POLICY IF EXISTS "Users can delete own simple investment entries" ON "SimpleInvestmentEntry";
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
-- 14. ACCOUNTINVESTMENTVALUE POLICIES
-- ============================================================================

-- SELECT: All active members can read
DROP POLICY IF EXISTS "Users can view own account investment values" ON "AccountInvestmentValue";
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

-- INSERT/UPDATE/DELETE: Only owner/admin can modify
DROP POLICY IF EXISTS "Users can insert own account investment values" ON "AccountInvestmentValue";
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

DROP POLICY IF EXISTS "Users can update own account investment values" ON "AccountInvestmentValue";
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

DROP POLICY IF EXISTS "Users can delete own account investment values" ON "AccountInvestmentValue";
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
-- 15. PLAIDLIABILITY POLICIES
-- ============================================================================

-- SELECT: All active members can read
DROP POLICY IF EXISTS "Users can view their own Plaid liabilities" ON "PlaidLiability";
DROP POLICY IF EXISTS "Users can view household Plaid liabilities" ON "PlaidLiability";
CREATE POLICY "Users can view household Plaid liabilities" ON "PlaidLiability" FOR SELECT
USING (
    "householdId" IN (SELECT household_id FROM get_user_accessible_households())
    OR EXISTS (
        SELECT 1 FROM "Account" a
        WHERE a."id" = "PlaidLiability"."accountId"
          AND (
            a."householdId" IN (SELECT household_id FROM get_user_accessible_households())
            OR EXISTS (
                SELECT 1 FROM "AccountOwner"
                WHERE "accountId" = a."id" AND "ownerId" = auth.uid()
            )
          )
    )
);

-- ============================================================================
-- 16. TRANSACTIONSYNC POLICIES
-- ============================================================================

-- SELECT: All active members can read
DROP POLICY IF EXISTS "Users can view TransactionSync for their accounts" ON "TransactionSync";
DROP POLICY IF EXISTS "Users can view household TransactionSync" ON "TransactionSync";
CREATE POLICY "Users can view household TransactionSync" ON "TransactionSync" FOR SELECT
USING (
    "householdId" IN (SELECT household_id FROM get_user_accessible_households())
    OR EXISTS (
        SELECT 1 FROM "Account" a
        WHERE a."id" = "TransactionSync"."accountId"
          AND (
            a."householdId" IN (SELECT household_id FROM get_user_accessible_households())
            OR EXISTS (
                SELECT 1 FROM "AccountOwner"
                WHERE "accountId" = a."id" AND "ownerId" = auth.uid()
            )
          )
    )
);

