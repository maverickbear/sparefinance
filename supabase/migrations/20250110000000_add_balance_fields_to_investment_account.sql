-- Migration: Add balance fields to InvestmentAccount table
-- These fields store Questrade balance information

-- Add balance fields to InvestmentAccount table
ALTER TABLE "InvestmentAccount"
ADD COLUMN IF NOT EXISTS "cash" DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS "marketValue" DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS "totalEquity" DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS "buyingPower" DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS "maintenanceExcess" DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'CAD',
ADD COLUMN IF NOT EXISTS "balanceLastUpdatedAt" TIMESTAMP(3);

-- Add comments for documentation
COMMENT ON COLUMN "InvestmentAccount"."cash" IS 'Cash balance in the account';
COMMENT ON COLUMN "InvestmentAccount"."marketValue" IS 'Current market value of all positions';
COMMENT ON COLUMN "InvestmentAccount"."totalEquity" IS 'Total equity (cash + market value)';
COMMENT ON COLUMN "InvestmentAccount"."buyingPower" IS 'Available buying power';
COMMENT ON COLUMN "InvestmentAccount"."maintenanceExcess" IS 'Maintenance excess amount';
COMMENT ON COLUMN "InvestmentAccount"."currency" IS 'Currency of the account (default: CAD)';
COMMENT ON COLUMN "InvestmentAccount"."balanceLastUpdatedAt" IS 'Last time balance information was updated from Questrade';

