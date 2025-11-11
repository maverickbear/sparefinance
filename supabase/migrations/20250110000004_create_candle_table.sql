-- Migration: Create Candle table
-- This table stores historical price data (candles) from Questrade

CREATE TABLE IF NOT EXISTS "Candle" (
    "id" TEXT PRIMARY KEY,
    "securityId" TEXT NOT NULL REFERENCES "Security"("id") ON DELETE CASCADE,
    "symbolId" BIGINT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "low" DECIMAL(15, 4) NOT NULL,
    "high" DECIMAL(15, 4) NOT NULL,
    "open" DECIMAL(15, 4) NOT NULL,
    "close" DECIMAL(15, 4) NOT NULL,
    "volume" BIGINT NOT NULL DEFAULT 0,
    "VWAP" DECIMAL(15, 4),
    "interval" TEXT NOT NULL, -- OneMinute, OneDay, OneWeek, etc.
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Candle_securityId_start_end_interval_unique" UNIQUE ("securityId", "start", "end", "interval")
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "Candle_securityId_idx" ON "Candle"("securityId");
CREATE INDEX IF NOT EXISTS "Candle_symbolId_idx" ON "Candle"("symbolId");
CREATE INDEX IF NOT EXISTS "Candle_start_idx" ON "Candle"("start");
CREATE INDEX IF NOT EXISTS "Candle_end_idx" ON "Candle"("end");
CREATE INDEX IF NOT EXISTS "Candle_securityId_start_idx" ON "Candle"("securityId", "start");

-- Add RLS policies for security
ALTER TABLE "Candle" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view candles for securities in their accounts
CREATE POLICY "Users can view candles for own securities" ON "Candle"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM "Security"
            WHERE "Security"."id" = "Candle"."securityId"
            AND EXISTS (
                SELECT 1 FROM "Position"
                WHERE "Position"."securityId" = "Security"."id"
                AND EXISTS (
                    SELECT 1 FROM "InvestmentAccount"
                    WHERE "InvestmentAccount"."id" = "Position"."accountId"
                    AND "InvestmentAccount"."userId" = auth.uid()
                )
            )
        )
    );

-- Policy: Users can insert candles for securities in their accounts
CREATE POLICY "Users can insert candles for own securities" ON "Candle"
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM "Security"
            WHERE "Security"."id" = "Candle"."securityId"
            AND EXISTS (
                SELECT 1 FROM "Position"
                WHERE "Position"."securityId" = "Security"."id"
                AND EXISTS (
                    SELECT 1 FROM "InvestmentAccount"
                    WHERE "InvestmentAccount"."id" = "Position"."accountId"
                    AND "InvestmentAccount"."userId" = auth.uid()
                )
            )
        )
    );

-- Policy: Users can update candles for securities in their accounts
CREATE POLICY "Users can update candles for own securities" ON "Candle"
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM "Security"
            WHERE "Security"."id" = "Candle"."securityId"
            AND EXISTS (
                SELECT 1 FROM "Position"
                WHERE "Position"."securityId" = "Security"."id"
                AND EXISTS (
                    SELECT 1 FROM "InvestmentAccount"
                    WHERE "InvestmentAccount"."id" = "Position"."accountId"
                    AND "InvestmentAccount"."userId" = auth.uid()
                )
            )
        )
    );

-- Policy: Users can delete candles for securities in their accounts
CREATE POLICY "Users can delete candles for own securities" ON "Candle"
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM "Security"
            WHERE "Security"."id" = "Candle"."securityId"
            AND EXISTS (
                SELECT 1 FROM "Position"
                WHERE "Position"."securityId" = "Security"."id"
                AND EXISTS (
                    SELECT 1 FROM "InvestmentAccount"
                    WHERE "InvestmentAccount"."id" = "Position"."accountId"
                    AND "InvestmentAccount"."userId" = auth.uid()
                )
            )
        )
    );

-- Add comment to document the table
COMMENT ON TABLE "Candle" IS 'Stores historical price data (candles) from Questrade';

