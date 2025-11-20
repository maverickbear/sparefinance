-- ============================================================================
-- Update Subscription Cache Functions to Use HouseholdMemberNew
-- ============================================================================
-- Date: 2025-02-01
-- Description: Updates subscription cache functions to use HouseholdMemberNew
--              and householdId-based architecture instead of old HouseholdMember
-- ============================================================================

-- ============================================================================
-- 1. UPDATE update_household_members_subscription_cache FUNCTION
-- ============================================================================
-- Changes from ownerId-based to householdId-based
-- Now updates all members of a household when subscription changes
-- Note: We need to DROP the old function first because we're changing the parameter name

DROP FUNCTION IF EXISTS "public"."update_household_members_subscription_cache"("p_owner_id" "uuid");

CREATE OR REPLACE FUNCTION "public"."update_household_members_subscription_cache"("p_household_id" "uuid") 
RETURNS "void"
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
DECLARE
  v_member_record record;
BEGIN
  -- Update all active household members of this household
  FOR v_member_record IN
    SELECT "userId"
    FROM "public"."HouseholdMemberNew"
    WHERE "householdId" = p_household_id
      AND "status" = 'active'
      AND "userId" IS NOT NULL
  LOOP
    PERFORM "public"."update_user_subscription_cache"(v_member_record."userId");
  END LOOP;
END;
$$;

COMMENT ON FUNCTION "public"."update_household_members_subscription_cache"("p_household_id" "uuid") IS 
'Updates subscription cache for all active members of a household when the household subscription changes. Uses HouseholdMemberNew.';

-- ============================================================================
-- 2. UPDATE trigger_update_subscription_cache FUNCTION
-- ============================================================================
-- Now uses householdId instead of userId for updating member caches

CREATE OR REPLACE FUNCTION "public"."trigger_update_subscription_cache"() 
RETURNS "trigger"
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
DECLARE
  v_household_id uuid;
BEGIN
  -- Only process if status is active or trialing
  IF NEW."status" IN ('active', 'trialing') THEN
    -- Update cache for the subscription owner (if userId-based subscription)
    IF NEW."userId" IS NOT NULL THEN
      PERFORM "public"."update_user_subscription_cache"(NEW."userId");
      
      -- Also update all household members if this is a userId-based subscription
      -- Get householdId from user's active household
      SELECT "householdId" INTO v_household_id
      FROM "public"."UserActiveHousehold"
      WHERE "userId" = NEW."userId"
      LIMIT 1;
      
      -- Fallback to default household
      IF v_household_id IS NULL THEN
        SELECT "householdId" INTO v_household_id
        FROM "public"."HouseholdMemberNew"
        WHERE "userId" = NEW."userId"
          AND "isDefault" = true
          AND "status" = 'active'
        LIMIT 1;
      END IF;
      
      IF v_household_id IS NOT NULL THEN
        PERFORM "public"."update_household_members_subscription_cache"(v_household_id);
      END IF;
    END IF;
    
    -- Update cache for all household members if this is a householdId-based subscription
    IF NEW."householdId" IS NOT NULL THEN
      -- Update all members of this household
      PERFORM "public"."update_household_members_subscription_cache"(NEW."householdId");
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION "public"."trigger_update_subscription_cache"() IS 
'Updates subscription cache when subscription changes. Supports both userId-based (backward compatibility) and householdId-based subscriptions.';

-- ============================================================================
-- 3. REMOVE TRIGGER ON OLD HouseholdMember TABLE
-- ============================================================================
-- Remove trigger from old table FIRST (before dropping the function it depends on)
-- This trigger uses trigger_update_member_subscription_cache function

DROP TRIGGER IF EXISTS "household_member_cache_update_trigger" ON "public"."HouseholdMember";

-- ============================================================================
-- 4. REMOVE trigger_update_member_subscription_cache FUNCTION
-- ============================================================================
-- This function is no longer needed because:
-- 1. It was only used for the old HouseholdMember table
-- 2. Cache updates are now handled by trigger_update_subscription_cache
-- 3. When a member joins/leaves, we can manually call update_user_subscription_cache
-- Note: We can now drop this function because we've already removed the trigger

DROP FUNCTION IF EXISTS "public"."trigger_update_member_subscription_cache"();

