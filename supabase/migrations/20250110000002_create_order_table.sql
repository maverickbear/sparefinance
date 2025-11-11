-- Migration: Create Order table
-- This table stores orders from Questrade

CREATE TABLE IF NOT EXISTS "Order" (
    "id" TEXT PRIMARY KEY,
    "accountId" TEXT NOT NULL REFERENCES "InvestmentAccount"("id") ON DELETE CASCADE,
    "questradeOrderId" BIGINT NOT NULL,
    "symbolId" BIGINT NOT NULL,
    "symbol" TEXT NOT NULL,
    "totalQuantity" DECIMAL(15, 4) NOT NULL DEFAULT 0,
    "openQuantity" DECIMAL(15, 4) NOT NULL DEFAULT 0,
    "filledQuantity" DECIMAL(15, 4) NOT NULL DEFAULT 0,
    "canceledQuantity" DECIMAL(15, 4) NOT NULL DEFAULT 0,
    "side" TEXT NOT NULL, -- Buy, Sell
    "orderType" TEXT NOT NULL, -- Market, Limit, Stop, etc.
    "limitPrice" DECIMAL(15, 4),
    "stopPrice" DECIMAL(15, 4),
    "isAllOrNone" BOOLEAN DEFAULT FALSE,
    "isAnonymous" BOOLEAN DEFAULT FALSE,
    "icebergQuantity" DECIMAL(15, 4),
    "minQuantity" DECIMAL(15, 4),
    "avgExecPrice" DECIMAL(15, 4),
    "lastExecPrice" DECIMAL(15, 4),
    "source" TEXT,
    "timeInForce" TEXT NOT NULL, -- Day, GoodTillCanceled, etc.
    "gtdDate" TIMESTAMP(3),
    "state" TEXT NOT NULL, -- Queued, Pending, Accepted, Executed, etc.
    "clientReasonStr" TEXT,
    "chainId" BIGINT NOT NULL,
    "creationTime" TIMESTAMP(3) NOT NULL,
    "updateTime" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "primaryRoute" TEXT,
    "secondaryRoute" TEXT,
    "orderRoute" TEXT,
    "venueHoldingOrder" TEXT,
    "comissionCharged" DECIMAL(15, 2),
    "exchangeOrderId" TEXT,
    "isSignificantShareHolder" BOOLEAN DEFAULT FALSE,
    "isInsider" BOOLEAN DEFAULT FALSE,
    "isLimitOffsetInTicks" BOOLEAN DEFAULT FALSE,
    "userId" BIGINT,
    "placementCommission" DECIMAL(15, 2),
    "strategyType" TEXT,
    "triggerStopPrice" DECIMAL(15, 4),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Order_questradeOrderId_accountId_unique" UNIQUE ("questradeOrderId", "accountId")
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "Order_accountId_idx" ON "Order"("accountId");
CREATE INDEX IF NOT EXISTS "Order_symbolId_idx" ON "Order"("symbolId");
CREATE INDEX IF NOT EXISTS "Order_state_idx" ON "Order"("state");
CREATE INDEX IF NOT EXISTS "Order_creationTime_idx" ON "Order"("creationTime");
CREATE INDEX IF NOT EXISTS "Order_questradeOrderId_idx" ON "Order"("questradeOrderId");

-- Add RLS policies for security
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view orders for their own accounts
CREATE POLICY "Users can view orders for own accounts" ON "Order"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM "InvestmentAccount"
            WHERE "InvestmentAccount"."id" = "Order"."accountId"
            AND "InvestmentAccount"."userId" = auth.uid()
        )
    );

-- Policy: Users can insert orders for their own accounts
CREATE POLICY "Users can insert orders for own accounts" ON "Order"
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM "InvestmentAccount"
            WHERE "InvestmentAccount"."id" = "Order"."accountId"
            AND "InvestmentAccount"."userId" = auth.uid()
        )
    );

-- Policy: Users can update orders for their own accounts
CREATE POLICY "Users can update orders for own accounts" ON "Order"
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM "InvestmentAccount"
            WHERE "InvestmentAccount"."id" = "Order"."accountId"
            AND "InvestmentAccount"."userId" = auth.uid()
        )
    );

-- Policy: Users can delete orders for their own accounts
CREATE POLICY "Users can delete orders for own accounts" ON "Order"
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM "InvestmentAccount"
            WHERE "InvestmentAccount"."id" = "Order"."accountId"
            AND "InvestmentAccount"."userId" = auth.uid()
        )
    );

-- Add comment to document the table
COMMENT ON TABLE "Order" IS 'Stores orders from Questrade';

