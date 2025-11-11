-- Migration: Create PromoCode table for managing promotional codes
-- This table stores promo codes that can be used for discounts on subscriptions
-- Only super_admin users can manage promo codes

-- Create PromoCode table
CREATE TABLE IF NOT EXISTS "PromoCode" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "discountType" TEXT NOT NULL CHECK ("discountType" IN ('percent', 'fixed')),
  "discountValue" DECIMAL(10, 2) NOT NULL,
  "duration" TEXT NOT NULL CHECK ("duration" IN ('once', 'forever', 'repeating')),
  "durationInMonths" INTEGER,
  "maxRedemptions" INTEGER,
  "expiresAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "stripeCouponId" TEXT UNIQUE,
  "planIds" JSONB DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "PromoCode_code_idx" ON "PromoCode"("code");
CREATE INDEX IF NOT EXISTS "PromoCode_isActive_idx" ON "PromoCode"("isActive");
CREATE INDEX IF NOT EXISTS "PromoCode_stripeCouponId_idx" ON "PromoCode"("stripeCouponId");

-- Create trigger for updatedAt
DROP TRIGGER IF EXISTS update_promo_code_updated_at ON "PromoCode";
CREATE TRIGGER update_promo_code_updated_at BEFORE UPDATE ON "PromoCode"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE "PromoCode" ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Only super_admin can read promo codes
DROP POLICY IF EXISTS "Super admin can read promo codes" ON "PromoCode";
CREATE POLICY "Super admin can read promo codes" ON "PromoCode"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = auth.uid()
      AND "User"."role" = 'super_admin'
    )
  );

-- Only super_admin can insert promo codes
DROP POLICY IF EXISTS "Super admin can insert promo codes" ON "PromoCode";
CREATE POLICY "Super admin can insert promo codes" ON "PromoCode"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = auth.uid()
      AND "User"."role" = 'super_admin'
    )
  );

-- Only super_admin can update promo codes
DROP POLICY IF EXISTS "Super admin can update promo codes" ON "PromoCode";
CREATE POLICY "Super admin can update promo codes" ON "PromoCode"
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = auth.uid()
      AND "User"."role" = 'super_admin'
    )
  );

-- Only super_admin can delete promo codes
DROP POLICY IF EXISTS "Super admin can delete promo codes" ON "PromoCode";
CREATE POLICY "Super admin can delete promo codes" ON "PromoCode"
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = auth.uid()
      AND "User"."role" = 'super_admin'
    )
  );

-- Note: Public read access for active promo codes during checkout
-- This allows users to validate promo codes during checkout
DROP POLICY IF EXISTS "Public can read active promo codes" ON "PromoCode";
CREATE POLICY "Public can read active promo codes" ON "PromoCode"
  FOR SELECT USING (
    "isActive" = true
    AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
  );

