-- Migration: Create ContactForm table
-- This table stores contact form submissions from users

CREATE TABLE IF NOT EXISTS "ContactForm" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'read' | 'replied' | 'resolved'
  "adminNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "ContactForm_userId_idx" ON "ContactForm"("userId");
CREATE INDEX IF NOT EXISTS "ContactForm_email_idx" ON "ContactForm"("email");
CREATE INDEX IF NOT EXISTS "ContactForm_status_idx" ON "ContactForm"("status");
CREATE INDEX IF NOT EXISTS "ContactForm_createdAt_idx" ON "ContactForm"("createdAt" DESC);

-- Enable Row Level Security
ALTER TABLE "ContactForm" ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own contact submissions
CREATE POLICY "Users can view own contact submissions" ON "ContactForm"
  FOR SELECT
  USING (auth.uid() = "userId");

-- Users can insert their own contact submissions
CREATE POLICY "Users can insert own contact submissions" ON "ContactForm"
  FOR INSERT
  WITH CHECK (auth.uid() = "userId" OR "userId" IS NULL);

-- Super admins can view all contact submissions
CREATE POLICY "Super admins can view all contact submissions" ON "ContactForm"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = auth.uid()
      AND "User"."role" = 'super_admin'
    )
  );

-- Super admins can update contact submissions
CREATE POLICY "Super admins can update contact submissions" ON "ContactForm"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = auth.uid()
      AND "User"."role" = 'super_admin'
    )
  );

-- Add check constraint for status
ALTER TABLE "ContactForm" ADD CONSTRAINT "ContactForm_status_check" 
  CHECK ("status" IN ('pending', 'read', 'replied', 'resolved'));

