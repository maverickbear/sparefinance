-- Migration: Restore User Subscription Insert Policy
-- This policy was dropped in 20251108000009_recreate_rls_from_scratch.sql
-- but is needed for users to create their own subscriptions during signup
-- The policy is safe because it only allows inserting subscriptions where userId = auth.uid()

-- Drop existing policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON "Subscription";

-- Add policy to allow users to insert their own subscriptions
-- This is needed because signup/signin code creates subscriptions using anon_key, not service_role
CREATE POLICY "Users can insert own subscriptions" ON "Subscription"
  FOR INSERT
  WITH CHECK (auth.uid() = "userId");

-- Note: Multiple policies can coexist for INSERT:
-- 1. "Users can insert own subscriptions" - allows users to create their own subscriptions (via signup/signin)
-- 2. "Service role can insert subscriptions" - allows service_role to create subscriptions (via webhooks)
-- Service role client bypasses RLS automatically, but this policy is good for safety

