-- Migration: Create Position table
-- This table stores current positions (holdings) from Questrade

-- Create Position table
CREATE TABLE IF NOT EXISTS "Position" (
    "id" TEXT PRIMARY KEY,
    "accountId" TEXT NOT NULL REFERENCES "InvestmentAccount"("id") ON DELETE CASCADE,
    "securityId" TEXT NOT NULL REFERENCES "Security"("id") ON DELETE CASCADE,
    "openQuantity" DECIMAL(15, 4) NOT NULL DEFAULT 0,
    "closedQuantity" DECIMAL(15, 4) NOT NULL DEFAULT 0,
    "currentMarketValue" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "currentPrice" DECIMAL(15, 4) NOT NULL DEFAULT 0,
    "averageEntryPrice" DECIMAL(15, 4) NOT NULL DEFAULT 0,
    "closedPnl" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "openPnl" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "isRealTime" BOOLEAN DEFAULT FALSE,
    "isUnderReorg" BOOLEAN DEFAULT FALSE,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Position_accountId_securityId_unique" UNIQUE ("accountId", "securityId")
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "Position_accountId_idx" ON "Position"("accountId");
CREATE INDEX IF NOT EXISTS "Position_securityId_idx" ON "Position"("securityId");
CREATE INDEX IF NOT EXISTS "Position_accountId_securityId_idx" ON "Position"("accountId", "securityId");

-- Add RLS policies for security
ALTER TABLE "Position" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view positions for their own accounts
CREATE POLICY "Users can view positions for own accounts" ON "Position"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM "InvestmentAccount"
            WHERE "InvestmentAccount"."id" = "Position"."accountId"
            AND "InvestmentAccount"."userId" = auth.uid()
        )
    );

-- Policy: Users can insert positions for their own accounts
CREATE POLICY "Users can insert positions for own accounts" ON "Position"
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM "InvestmentAccount"
            WHERE "InvestmentAccount"."id" = "Position"."accountId"
            AND "InvestmentAccount"."userId" = auth.uid()
        )
    );

-- Policy: Users can update positions for their own accounts
CREATE POLICY "Users can update positions for own accounts" ON "Position"
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM "InvestmentAccount"
            WHERE "InvestmentAccount"."id" = "Position"."accountId"
            AND "InvestmentAccount"."userId" = auth.uid()
        )
    );

-- Policy: Users can delete positions for their own accounts
CREATE POLICY "Users can delete positions for own accounts" ON "Position"
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM "InvestmentAccount"
            WHERE "InvestmentAccount"."id" = "Position"."accountId"
            AND "InvestmentAccount"."userId" = auth.uid()
        )
    );

-- Add comment to document the table
COMMENT ON TABLE "Position" IS 'Stores current positions (holdings) from Questrade';

