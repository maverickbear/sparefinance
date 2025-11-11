-- Migration: Add Questrade fields to InvestmentAccount table
-- This migration adds fields to track Questrade account connections

-- Add Questrade fields to InvestmentAccount table
ALTER TABLE "InvestmentAccount" 
ADD COLUMN IF NOT EXISTS "questradeAccountNumber" TEXT,
ADD COLUMN IF NOT EXISTS "questradeConnectionId" TEXT REFERENCES "QuestradeConnection"("id") ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "isQuestradeConnected" BOOLEAN DEFAULT false;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "InvestmentAccount_questradeConnectionId_idx" ON "InvestmentAccount"("questradeConnectionId");
CREATE INDEX IF NOT EXISTS "InvestmentAccount_isQuestradeConnected_idx" ON "InvestmentAccount"("isQuestradeConnected");

-- Add comments to document the columns
COMMENT ON COLUMN "InvestmentAccount"."questradeAccountNumber" IS 'Questrade account number for this investment account';
COMMENT ON COLUMN "InvestmentAccount"."questradeConnectionId" IS 'Reference to QuestradeConnection for this account';
COMMENT ON COLUMN "InvestmentAccount"."isQuestradeConnected" IS 'Whether this account is connected to Questrade';

