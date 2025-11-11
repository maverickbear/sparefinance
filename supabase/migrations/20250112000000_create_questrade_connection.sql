-- Migration: Create QuestradeConnection table
-- This migration creates a table to store Questrade API connections
-- Tokens are stored encrypted for security

-- Create QuestradeConnection table
CREATE TABLE IF NOT EXISTS "QuestradeConnection" (
    "id" TEXT PRIMARY KEY,
    "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "accessToken" TEXT NOT NULL, -- Encrypted
    "refreshToken" TEXT NOT NULL, -- Encrypted
    "apiServerUrl" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "QuestradeConnection_userId_idx" ON "QuestradeConnection"("userId");
CREATE INDEX IF NOT EXISTS "QuestradeConnection_tokenExpiresAt_idx" ON "QuestradeConnection"("tokenExpiresAt");

-- Add RLS policies for security
ALTER TABLE "QuestradeConnection" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own Questrade connections
CREATE POLICY "Users can view their own Questrade connections" ON "QuestradeConnection"
    FOR SELECT
    USING ("userId" = auth.uid());

-- Policy: Users can insert their own Questrade connections
CREATE POLICY "Users can insert their own Questrade connections" ON "QuestradeConnection"
    FOR INSERT
    WITH CHECK ("userId" = auth.uid());

-- Policy: Users can update their own Questrade connections
CREATE POLICY "Users can update their own Questrade connections" ON "QuestradeConnection"
    FOR UPDATE
    USING ("userId" = auth.uid());

-- Policy: Users can delete their own Questrade connections
CREATE POLICY "Users can delete their own Questrade connections" ON "QuestradeConnection"
    FOR DELETE
    USING ("userId" = auth.uid());

-- Add comment to document the table
COMMENT ON TABLE "QuestradeConnection" IS 'Stores Questrade API connections with encrypted tokens';

