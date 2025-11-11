-- Migration: Create Execution table
-- This table stores order executions from Questrade

CREATE TABLE IF NOT EXISTS "Execution" (
    "id" TEXT PRIMARY KEY,
    "accountId" TEXT NOT NULL REFERENCES "InvestmentAccount"("id") ON DELETE CASCADE,
    "questradeExecutionId" BIGINT NOT NULL,
    "symbolId" BIGINT NOT NULL,
    "symbol" TEXT NOT NULL,
    "quantity" DECIMAL(15, 4) NOT NULL DEFAULT 0,
    "side" TEXT NOT NULL, -- Buy, Sell
    "price" DECIMAL(15, 4) NOT NULL,
    "orderId" BIGINT NOT NULL,
    "orderChainId" BIGINT NOT NULL,
    "exchangeExecId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "venue" TEXT,
    "totalCost" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "orderPlacementCommission" DECIMAL(15, 2) DEFAULT 0,
    "commission" DECIMAL(15, 2) DEFAULT 0,
    "executionFee" DECIMAL(15, 2) DEFAULT 0,
    "secFee" DECIMAL(15, 2) DEFAULT 0,
    "canadianExecutionFee" DECIMAL(15, 2) DEFAULT 0,
    "parentId" BIGINT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Execution_questradeExecutionId_accountId_unique" UNIQUE ("questradeExecutionId", "accountId")
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "Execution_accountId_idx" ON "Execution"("accountId");
CREATE INDEX IF NOT EXISTS "Execution_symbolId_idx" ON "Execution"("symbolId");
CREATE INDEX IF NOT EXISTS "Execution_orderId_idx" ON "Execution"("orderId");
CREATE INDEX IF NOT EXISTS "Execution_timestamp_idx" ON "Execution"("timestamp");
CREATE INDEX IF NOT EXISTS "Execution_questradeExecutionId_idx" ON "Execution"("questradeExecutionId");

-- Add RLS policies for security
ALTER TABLE "Execution" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view executions for their own accounts
CREATE POLICY "Users can view executions for own accounts" ON "Execution"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM "InvestmentAccount"
            WHERE "InvestmentAccount"."id" = "Execution"."accountId"
            AND "InvestmentAccount"."userId" = auth.uid()
        )
    );

-- Policy: Users can insert executions for their own accounts
CREATE POLICY "Users can insert executions for own accounts" ON "Execution"
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM "InvestmentAccount"
            WHERE "InvestmentAccount"."id" = "Execution"."accountId"
            AND "InvestmentAccount"."userId" = auth.uid()
        )
    );

-- Policy: Users can update executions for their own accounts
CREATE POLICY "Users can update executions for own accounts" ON "Execution"
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM "InvestmentAccount"
            WHERE "InvestmentAccount"."id" = "Execution"."accountId"
            AND "InvestmentAccount"."userId" = auth.uid()
        )
    );

-- Policy: Users can delete executions for their own accounts
CREATE POLICY "Users can delete executions for own accounts" ON "Execution"
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM "InvestmentAccount"
            WHERE "InvestmentAccount"."id" = "Execution"."accountId"
            AND "InvestmentAccount"."userId" = auth.uid()
        )
    );

-- Add comment to document the table
COMMENT ON TABLE "Execution" IS 'Stores order executions from Questrade';

