-- Allow userId to be nullable for pending subscriptions
-- Add pendingEmail field to track subscriptions waiting for user signup
ALTER TABLE "Subscription" 
  ALTER COLUMN "userId" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "pendingEmail" TEXT;

-- Add index for pending email lookups
CREATE INDEX IF NOT EXISTS "Subscription_pendingEmail_idx" ON "Subscription"("pendingEmail") WHERE "pendingEmail" IS NOT NULL;

-- Add comment
COMMENT ON COLUMN "Subscription"."userId" IS 'User ID. NULL if subscription is pending user signup.';
COMMENT ON COLUMN "Subscription"."pendingEmail" IS 'Email address for pending subscriptions waiting to be linked to a user account.';

