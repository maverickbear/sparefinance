-- Add trial fields to Subscription table
ALTER TABLE "Subscription" 
ADD COLUMN IF NOT EXISTS "trialStartDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "trialEndDate" TIMESTAMP(3);

-- Add index for trial queries
CREATE INDEX IF NOT EXISTS "Subscription_trialEndDate_idx" ON "Subscription"("trialEndDate");

-- Add comment
COMMENT ON COLUMN "Subscription"."trialStartDate" IS 'Start date of the trial period';
COMMENT ON COLUMN "Subscription"."trialEndDate" IS 'End date of the trial period. After this date, user must subscribe to continue.';

