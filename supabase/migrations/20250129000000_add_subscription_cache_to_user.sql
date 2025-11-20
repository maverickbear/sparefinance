-- Migration: Add subscription cache fields to User table
-- Date: 2025-01-29
-- Description: Adds denormalized subscription fields to User table for better performance
-- These fields are kept in sync via triggers when owner's subscription changes

-- ============================================================================
-- ADD SUBSCRIPTION CACHE FIELDS TO USER TABLE
-- ============================================================================

ALTER TABLE "public"."User"
ADD COLUMN IF NOT EXISTS "effectivePlanId" text,
ADD COLUMN IF NOT EXISTS "effectiveSubscriptionStatus" text,
ADD COLUMN IF NOT EXISTS "effectiveSubscriptionId" text,
ADD COLUMN IF NOT EXISTS "subscriptionUpdatedAt" timestamp(3) without time zone;

-- Add comments
COMMENT ON COLUMN "public"."User"."effectivePlanId" IS 'Cached plan ID - for household members, this is the owner''s plan. For owners, this is their own plan.';
COMMENT ON COLUMN "public"."User"."effectiveSubscriptionStatus" IS 'Cached subscription status - active, trialing, cancelled, etc.';
COMMENT ON COLUMN "public"."User"."effectiveSubscriptionId" IS 'Cached subscription ID for reference';
COMMENT ON COLUMN "public"."User"."subscriptionUpdatedAt" IS 'Timestamp when subscription cache was last updated';

-- ============================================================================
-- CREATE FUNCTION TO UPDATE SUBSCRIPTION CACHE FOR USER
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."update_user_subscription_cache"(
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id uuid;
  v_effective_user_id uuid;
  v_subscription_record record;
BEGIN
  -- Check if user is a household member
  SELECT "ownerId" INTO v_owner_id
  FROM "public"."HouseholdMember"
  WHERE "memberId" = p_user_id
    AND "status" = 'active'
    AND "ownerId" != p_user_id  -- Exclude self-referential records
  LIMIT 1;

  -- Determine effective user ID (owner if member, self if owner)
  IF v_owner_id IS NOT NULL THEN
    v_effective_user_id := v_owner_id;
  ELSE
    v_effective_user_id := p_user_id;
  END IF;

  -- Get subscription for effective user
  SELECT 
    "id",
    "planId",
    "status"
  INTO v_subscription_record
  FROM "public"."Subscription"
  WHERE "userId" = v_effective_user_id
    AND "status" IN ('active', 'trialing')
  ORDER BY "createdAt" DESC
  LIMIT 1;

  -- Update User table with subscription cache
  UPDATE "public"."User"
  SET
    "effectivePlanId" = v_subscription_record."planId",
    "effectiveSubscriptionStatus" = v_subscription_record."status",
    "effectiveSubscriptionId" = v_subscription_record."id",
    "subscriptionUpdatedAt" = NOW()
  WHERE "id" = p_user_id;

  -- If no subscription found, clear cache
  IF v_subscription_record IS NULL THEN
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

COMMENT ON FUNCTION "public"."update_user_subscription_cache" IS 'Updates subscription cache fields in User table for a specific user. For household members, uses owner''s subscription.';

-- ============================================================================
-- CREATE FUNCTION TO UPDATE ALL HOUSEHOLD MEMBERS WHEN OWNER SUBSCRIPTION CHANGES
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."update_household_members_subscription_cache"(
  p_owner_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member_record record;
BEGIN
  -- Update all active household members of this owner
  FOR v_member_record IN
    SELECT "memberId"
    FROM "public"."HouseholdMember"
    WHERE "ownerId" = p_owner_id
      AND "status" = 'active'
      AND "memberId" IS NOT NULL
      AND "memberId" != p_owner_id  -- Exclude self-referential records
  LOOP
    PERFORM "public"."update_user_subscription_cache"(v_member_record."memberId");
  END LOOP;
END;
$$;

COMMENT ON FUNCTION "public"."update_household_members_subscription_cache" IS 'Updates subscription cache for all household members when owner''s subscription changes.';

-- ============================================================================
-- CREATE TRIGGER TO UPDATE CACHE WHEN SUBSCRIPTION CHANGES
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."trigger_update_subscription_cache"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only process if status is active or trialing
  IF NEW."status" IN ('active', 'trialing') THEN
    -- Update cache for the subscription owner
    IF NEW."userId" IS NOT NULL THEN
      PERFORM "public"."update_user_subscription_cache"(NEW."userId");
      
      -- Also update all household members if this is an owner's subscription
      PERFORM "public"."update_household_members_subscription_cache"(NEW."userId");
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on Subscription table
DROP TRIGGER IF EXISTS "subscription_cache_update_trigger" ON "public"."Subscription";
CREATE TRIGGER "subscription_cache_update_trigger"
  AFTER INSERT OR UPDATE OF "userId", "planId", "status" ON "public"."Subscription"
  FOR EACH ROW
  EXECUTE PROCEDURE "public"."trigger_update_subscription_cache"();

-- ============================================================================
-- CREATE TRIGGER TO UPDATE CACHE WHEN HOUSEHOLD MEMBER STATUS CHANGES
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."trigger_update_member_subscription_cache"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When a member becomes active, update their cache
  IF NEW."status" = 'active' AND NEW."memberId" IS NOT NULL THEN
    PERFORM "public"."update_user_subscription_cache"(NEW."memberId");
  END IF;

  -- When a member is removed or deactivated, clear their cache
  IF (OLD."status" = 'active' AND NEW."status" != 'active') AND NEW."memberId" IS NOT NULL THEN
    UPDATE "public"."User"
    SET
      "effectivePlanId" = NULL,
      "effectiveSubscriptionStatus" = NULL,
      "effectiveSubscriptionId" = NULL,
      "subscriptionUpdatedAt" = NOW()
    WHERE "id" = NEW."memberId";
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on HouseholdMember table
DROP TRIGGER IF EXISTS "household_member_cache_update_trigger" ON "public"."HouseholdMember";
CREATE TRIGGER "household_member_cache_update_trigger"
  AFTER INSERT OR UPDATE OF "status", "memberId" ON "public"."HouseholdMember"
  FOR EACH ROW
  EXECUTE PROCEDURE "public"."trigger_update_member_subscription_cache"();

-- ============================================================================
-- INITIALIZE CACHE FOR EXISTING USERS
-- ============================================================================

-- Update cache for all users
-- Note: For large datasets, this may take a while, but it's a one-time operation
DO $$
DECLARE
  v_user_record record;
BEGIN
  FOR v_user_record IN
    SELECT "id" FROM "public"."User" ORDER BY "id"
  LOOP
    PERFORM "public"."update_user_subscription_cache"(v_user_record."id");
  END LOOP;
END $$;

