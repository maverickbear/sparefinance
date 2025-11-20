-- ============================================================================
-- Validate Migration
-- ============================================================================
-- Date: 2025-02-01
-- Description: Validation queries to verify migration was successful
-- ============================================================================

-- ============================================================================
-- 1. VALIDATE ALL USERS HAVE PERSONAL HOUSEHOLDS
-- ============================================================================

DO $$
DECLARE
    users_without_households INTEGER;
BEGIN
    SELECT COUNT(*) INTO users_without_households
    FROM "public"."User" u
    WHERE NOT EXISTS (
        SELECT 1 
        FROM "public"."HouseholdMemberNew" hm
        JOIN "public"."Household" h ON h."id" = hm."householdId"
        WHERE hm."userId" = u."id" 
          AND hm."isDefault" = true
          AND h."type" = 'personal'
    );
    
    IF users_without_households > 0 THEN
        RAISE WARNING 'Found % users without personal households', users_without_households;
    ELSE
        RAISE NOTICE 'All users have personal households';
    END IF;
END $$;

-- ============================================================================
-- 2. VALIDATE ALL DATA HAS householdId
-- ============================================================================

DO $$
DECLARE
    transaction_count INTEGER;
    account_count INTEGER;
    budget_count INTEGER;
    goal_count INTEGER;
    debt_count INTEGER;
    investment_account_count INTEGER;
    planned_payment_count INTEGER;
    user_service_subscription_count INTEGER;
BEGIN
    -- Check Transaction
    SELECT COUNT(*) INTO transaction_count
    FROM "public"."Transaction" 
    WHERE "householdId" IS NULL AND "userId" IS NOT NULL;
    
    IF transaction_count > 0 THEN
        RAISE WARNING 'Found % transactions without householdId', transaction_count;
    END IF;
    
    -- Check Account
    SELECT COUNT(*) INTO account_count
    FROM "public"."Account" 
    WHERE "householdId" IS NULL AND "userId" IS NOT NULL;
    
    IF account_count > 0 THEN
        RAISE WARNING 'Found % accounts without householdId', account_count;
    END IF;
    
    -- Check Budget
    SELECT COUNT(*) INTO budget_count
    FROM "public"."Budget" 
    WHERE "householdId" IS NULL AND "userId" IS NOT NULL;
    
    IF budget_count > 0 THEN
        RAISE WARNING 'Found % budgets without householdId', budget_count;
    END IF;
    
    -- Check Goal
    SELECT COUNT(*) INTO goal_count
    FROM "public"."Goal" 
    WHERE "householdId" IS NULL AND "userId" IS NOT NULL;
    
    IF goal_count > 0 THEN
        RAISE WARNING 'Found % goals without householdId', goal_count;
    END IF;
    
    -- Check Debt
    SELECT COUNT(*) INTO debt_count
    FROM "public"."Debt" 
    WHERE "householdId" IS NULL AND "userId" IS NOT NULL;
    
    IF debt_count > 0 THEN
        RAISE WARNING 'Found % debts without householdId', debt_count;
    END IF;
    
    -- Check InvestmentAccount
    SELECT COUNT(*) INTO investment_account_count
    FROM "public"."InvestmentAccount" 
    WHERE "householdId" IS NULL AND "userId" IS NOT NULL;
    
    IF investment_account_count > 0 THEN
        RAISE WARNING 'Found % investment accounts without householdId', investment_account_count;
    END IF;
    
    -- Check PlannedPayment
    SELECT COUNT(*) INTO planned_payment_count
    FROM "public"."PlannedPayment" 
    WHERE "householdId" IS NULL AND "userId" IS NOT NULL;
    
    IF planned_payment_count > 0 THEN
        RAISE WARNING 'Found % planned payments without householdId', planned_payment_count;
    END IF;
    
    -- Check UserServiceSubscription
    SELECT COUNT(*) INTO user_service_subscription_count
    FROM "public"."UserServiceSubscription" 
    WHERE "householdId" IS NULL AND "userId" IS NOT NULL;
    
    IF user_service_subscription_count > 0 THEN
        RAISE WARNING 'Found % user service subscriptions without householdId', user_service_subscription_count;
    END IF;
    
    RAISE NOTICE 'Data validation complete';
END $$;

-- ============================================================================
-- 3. VALIDATE HOUSEHOLD MEMBERS WERE MIGRATED
-- ============================================================================

DO $$
DECLARE
    household_records INTEGER;
    household_members INTEGER;
BEGIN
    SELECT COUNT(*) INTO household_records
    FROM "public"."Household" 
    WHERE "type" = 'household';
    
    SELECT COUNT(*) INTO household_members
    FROM "public"."HouseholdMemberNew" hm
    JOIN "public"."Household" h ON h."id" = hm."householdId"
    WHERE h."type" = 'household' AND hm."status" = 'active';
    
    RAISE NOTICE 'Found % household records with % active members', household_records, household_members;
END $$;

-- ============================================================================
-- 4. VALIDATE SUBSCRIPTIONS WERE MIGRATED
-- ============================================================================

DO $$
DECLARE
    subscriptions_with_householdid INTEGER;
    subscriptions_without_householdid INTEGER;
BEGIN
    SELECT COUNT(*) INTO subscriptions_with_householdid
    FROM "public"."Subscription" 
    WHERE "householdId" IS NOT NULL;
    
    SELECT COUNT(*) INTO subscriptions_without_householdid
    FROM "public"."Subscription" 
    WHERE "householdId" IS NULL AND "userId" IS NOT NULL;
    
    RAISE NOTICE 'Subscriptions: % with householdId, % without (using userId)', 
        subscriptions_with_householdid, subscriptions_without_householdid;
END $$;

-- ============================================================================
-- 5. VALIDATE USERACTIVEHOUSEHOLD RECORDS
-- ============================================================================

DO $$
DECLARE
    users_without_active_household INTEGER;
BEGIN
    SELECT COUNT(*) INTO users_without_active_household
    FROM "public"."User" u
    WHERE NOT EXISTS (
        SELECT 1 FROM "public"."UserActiveHousehold" uah
        WHERE uah."userId" = u."id"
    );
    
    IF users_without_active_household > 0 THEN
        RAISE WARNING 'Found % users without active household', users_without_active_household;
    ELSE
        RAISE NOTICE 'All users have active households';
    END IF;
END $$;

-- ============================================================================
-- 6. SUMMARY REPORT
-- ============================================================================

SELECT 
    'Migration Validation Summary' as report,
    (SELECT COUNT(*) FROM "public"."Household" WHERE "type" = 'personal') as personal_households,
    (SELECT COUNT(*) FROM "public"."Household" WHERE "type" = 'household') as household_records,
    (SELECT COUNT(*) FROM "public"."HouseholdMemberNew" WHERE "status" = 'active') as active_members,
    (SELECT COUNT(*) FROM "public"."UserActiveHousehold") as users_with_active_household,
    (SELECT COUNT(*) FROM "public"."Subscription" WHERE "householdId" IS NOT NULL) as subscriptions_with_householdid;

