-- Create User table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS "User" (
  "id" UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "avatarUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

-- Create Plan table
CREATE TABLE IF NOT EXISTS "Plan" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "priceMonthly" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "priceYearly" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "features" JSONB NOT NULL DEFAULT '{}',
  "stripePriceIdMonthly" TEXT,
  "stripePriceIdYearly" TEXT,
  "stripeProductId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

-- Create Subscription table
CREATE TABLE IF NOT EXISTS "Subscription" (
  "id" TEXT PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "planId" TEXT NOT NULL REFERENCES "Plan"(id) ON DELETE RESTRICT,
  "status" TEXT NOT NULL DEFAULT 'active', -- 'active' | 'cancelled' | 'past_due' | 'trialing'
  "stripeSubscriptionId" TEXT UNIQUE,
  "stripeCustomerId" TEXT,
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");
CREATE INDEX IF NOT EXISTS "Plan_name_idx" ON "Plan"("name");
CREATE INDEX IF NOT EXISTS "Subscription_userId_idx" ON "Subscription"("userId");
CREATE INDEX IF NOT EXISTS "Subscription_planId_idx" ON "Subscription"("planId");
CREATE INDEX IF NOT EXISTS "Subscription_status_idx" ON "Subscription"("status");
CREATE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_idx" ON "Subscription"("stripeSubscriptionId");
CREATE INDEX IF NOT EXISTS "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");

-- Add userId to existing tables for multi-tenancy
-- Note: This will be done gradually, starting with new operations requiring auth

-- Create function to update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$;

-- Create triggers for updatedAt
DROP TRIGGER IF EXISTS update_user_updated_at ON "User";
CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON "User"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_plan_updated_at ON "Plan";
CREATE TRIGGER update_plan_updated_at BEFORE UPDATE ON "Plan"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscription_updated_at ON "Subscription";
CREATE TRIGGER update_subscription_updated_at BEFORE UPDATE ON "Subscription"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

