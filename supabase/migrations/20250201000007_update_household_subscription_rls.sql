-- ============================================================================
-- Update Subscription RLS Policies
-- ============================================================================
-- Date: 2025-02-01
-- Description: Updates Subscription RLS policies for household-based access
--              Users can view subscriptions of their households
--              Only owner/admin can modify subscriptions
-- ============================================================================

-- ============================================================================
-- SUBSCRIPTION POLICIES
-- ============================================================================

-- SELECT: Users can view subscriptions of their households
DROP POLICY IF EXISTS "Users can view own subscriptions" ON "Subscription";
CREATE POLICY "Users can view household subscriptions" ON "Subscription" FOR SELECT
USING (
    "householdId" IN (SELECT household_id FROM get_user_accessible_households())
    OR "userId" = auth.uid() -- Backward compatibility
);

-- INSERT: Only owners/admins can create subscriptions for their households
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON "Subscription";
CREATE POLICY "Users can insert household subscriptions" ON "Subscription" FOR INSERT
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
);

-- UPDATE: Only owners/admins can update subscriptions
DROP POLICY IF EXISTS "Users can update own subscriptions" ON "Subscription";
CREATE POLICY "Users can update household subscriptions" ON "Subscription" FOR UPDATE
USING (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
)
WITH CHECK (
    can_access_household_data("householdId", 'write')
    OR "userId" = auth.uid() -- Backward compatibility
);

-- DELETE: Only owners/admins can delete subscriptions
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON "Subscription";
CREATE POLICY "Users can delete household subscriptions" ON "Subscription" FOR DELETE
USING (
    can_access_household_data("householdId", 'delete')
    OR "userId" = auth.uid() -- Backward compatibility
);

