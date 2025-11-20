-- ============================================================================
-- Add householdId to Subscription
-- ============================================================================
-- Date: 2025-02-01
-- Description: Adds householdId column to Subscription table for household-based subscriptions
--              Maintains userId for backward compatibility during migration
-- ============================================================================

-- ============================================================================
-- 1. ADD householdId TO SUBSCRIPTION
-- ============================================================================

ALTER TABLE "public"."Subscription" 
ADD COLUMN IF NOT EXISTS "householdId" uuid;

ALTER TABLE "public"."Subscription"
ADD CONSTRAINT "Subscription_householdId_fkey" 
FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "Subscription_householdId_idx" ON "public"."Subscription"("householdId");

-- ============================================================================
-- 2. ADD CONSTRAINT: AT LEAST ONE OF userId OR householdId MUST EXIST
-- ============================================================================

-- Add check constraint to ensure at least one of userId or householdId is set
ALTER TABLE "public"."Subscription"
ADD CONSTRAINT "Subscription_userId_or_householdId_check" 
CHECK (
    ("userId" IS NOT NULL) OR ("householdId" IS NOT NULL)
);

-- ============================================================================
-- NOTES
-- ============================================================================
-- householdId is nullable to support backward compatibility during migration.
-- After migration is complete, subscriptions should use householdId instead of userId.
-- The constraint ensures that at least one of userId or householdId is always set.

