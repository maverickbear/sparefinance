-- ============================================================================
-- Add isBlocked field to User table
-- ============================================================================
-- Date: 2025-02-02
-- Description: Adds isBlocked field to User table to allow blocking users
--              from accessing the system. When blocked, users cannot log in
--              and their subscription is paused.
-- ============================================================================

ALTER TABLE "public"."User"
ADD COLUMN IF NOT EXISTS "isBlocked" boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN "public"."User"."isBlocked" IS 'When true, user is blocked from accessing the system and cannot log in. Subscription is paused until unblocked.';

