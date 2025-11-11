-- Migration to remove free plan and migrate existing free subscriptions
-- This migration:
-- 1. Updates existing free subscriptions to basic plan (or cancels them)
-- 2. Removes the free plan from the Plan table

-- Step 1: Update existing free subscriptions to basic plan
-- For users with free subscriptions, we'll migrate them to basic plan
-- If they don't have a Stripe subscription, we'll cancel the free subscription
-- and they'll need to sign up for a paid plan with trial

UPDATE "Subscription"
SET 
  "planId" = 'basic',
  "status" = CASE 
    WHEN "stripeSubscriptionId" IS NULL THEN 'cancelled'
    ELSE "status"
  END,
  "updatedAt" = NOW()
WHERE "planId" = 'free';

-- Step 2: Delete the free plan from Plan table
-- Note: This will fail if there are foreign key constraints preventing deletion
-- In that case, we need to ensure all subscriptions are updated first (done above)

DELETE FROM "Plan"
WHERE "id" = 'free';

