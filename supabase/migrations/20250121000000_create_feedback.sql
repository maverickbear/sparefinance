-- Migration: Create Feedback table
-- This table stores user feedback submissions with ratings

CREATE TABLE IF NOT EXISTS "Feedback" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "rating" INTEGER NOT NULL CHECK ("rating" >= 1 AND "rating" <= 5),
  "feedback" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "Feedback_userId_idx" ON "Feedback"("userId");
CREATE INDEX IF NOT EXISTS "Feedback_rating_idx" ON "Feedback"("rating");
CREATE INDEX IF NOT EXISTS "Feedback_createdAt_idx" ON "Feedback"("createdAt" DESC);

-- Enable Row Level Security
ALTER TABLE "Feedback" ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own feedback submissions
CREATE POLICY "Users can view own feedback submissions" ON "Feedback"
  FOR SELECT
  USING (auth.uid() = "userId");

-- Users can insert their own feedback submissions
CREATE POLICY "Users can insert own feedback submissions" ON "Feedback"
  FOR INSERT
  WITH CHECK (auth.uid() = "userId");

-- Super admins can view all feedback submissions
CREATE POLICY "Super admins can view all feedback submissions" ON "Feedback"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = auth.uid()
      AND "User"."role" = 'super_admin'
    )
  );

