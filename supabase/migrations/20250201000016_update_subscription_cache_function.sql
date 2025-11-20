-- ============================================================================
-- Update update_user_subscription_cache Function
-- ============================================================================
-- Date: 2025-02-01
-- Description: Updates update_user_subscription_cache to use HouseholdMemberNew
--              and Household-based subscriptions instead of the old HouseholdMember
--              and userId-based subscriptions
-- ============================================================================

-- ============================================================================
-- UPDATE update_user_subscription_cache FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."update_user_subscription_cache"("p_user_id" "uuid") 
RETURNS "void"
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
DECLARE
  v_household_id uuid;
  v_subscription_record record;
BEGIN
  -- Get user's active household (or default personal household)
  SELECT "householdId" INTO v_household_id
  FROM "public"."UserActiveHousehold"
  WHERE "userId" = p_user_id
  LIMIT 1;

  -- Fallback to default (personal) household if no active household set
  IF v_household_id IS NULL THEN
    SELECT "householdId" INTO v_household_id
    FROM "public"."HouseholdMemberNew"
    WHERE "userId" = p_user_id
      AND "isDefault" = true
      AND "status" = 'active'
    LIMIT 1;
  END IF;

  -- Get subscription for household (new architecture)
  IF v_household_id IS NOT NULL THEN
    SELECT 
      "id",
      "planId",
      "status"
    INTO v_subscription_record
    FROM "public"."Subscription"
    WHERE "householdId" = v_household_id
      AND "status" IN ('active', 'trialing')
    ORDER BY "createdAt" DESC
    LIMIT 1;
  END IF;

  -- Fallback: Try to get subscription by userId (backward compatibility)
  IF v_subscription_record IS NULL THEN
    SELECT 
      "id",
      "planId",
      "status"
    INTO v_subscription_record
    FROM "public"."Subscription"
    WHERE "userId" = p_user_id
      AND "status" IN ('active', 'trialing')
    ORDER BY "createdAt" DESC
    LIMIT 1;
  END IF;

  -- Update User table with subscription cache
  IF v_subscription_record IS NOT NULL THEN
    UPDATE "public"."User"
    SET
      "effectivePlanId" = v_subscription_record."planId",
      "effectiveSubscriptionStatus" = v_subscription_record."status",
      "effectiveSubscriptionId" = v_subscription_record."id",
      "subscriptionUpdatedAt" = NOW()
    WHERE "id" = p_user_id;
  ELSE
    -- If no subscription found, clear cache
    UPDATE "public"."User"
    SET
      "effectivePlanId" = NULL,
      "effectiveSubscriptionStatus" = NULL,
      "effectiveSubscriptionId" = NULL,
      "subscriptionUpdatedAt" = NOW()
    WHERE "id" = p_user_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION "public"."update_user_subscription_cache"("p_user_id" "uuid") IS 
'Updates the subscription cache in the User table. Uses HouseholdMemberNew and householdId-based subscriptions. Falls back to userId-based subscriptions for backward compatibility.';

