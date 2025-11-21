-- ============================================================================
-- Restrict Security and SecurityPrice Policies
-- ============================================================================
-- Date: 2025-02-02
-- Description: Restricts overly permissive policies for Security and SecurityPrice
--              tables. Currently any authenticated user can modify these tables,
--              which is a security risk. New policies restrict modifications to:
--              - Users who own positions with the security
--              - Admins (super_admin)
--              - Service role
-- ============================================================================

-- ============================================================================
-- 1. RESTRICT Security TABLE POLICIES
-- ============================================================================

-- DELETE: Only users with positions or admins
DROP POLICY IF EXISTS "Authenticated users can delete securities" ON "public"."Security";

CREATE POLICY "Users can delete securities they own" ON "public"."Security"
FOR DELETE
USING (
    -- Users who have positions with this security
    EXISTS (
        SELECT 1
        FROM "public"."Position" "p"
        INNER JOIN "public"."InvestmentAccount" "ia" ON "ia"."id" = "p"."accountId"
        WHERE "p"."securityId" = "Security"."id"
          AND "ia"."userId" = auth.uid()
    )
    -- Admins can delete any security
    OR EXISTS (
        SELECT 1
        FROM "public"."User"
        WHERE "User"."id" = auth.uid()
          AND "User"."role" = 'super_admin'
    )
    -- Service role can delete
    OR auth.role() = 'service_role'
);

-- INSERT: Only admins or service role
DROP POLICY IF EXISTS "Authenticated users can insert securities" ON "public"."Security";

CREATE POLICY "Admins can insert securities" ON "public"."Security"
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM "public"."User"
        WHERE "User"."id" = auth.uid()
          AND "User"."role" = 'super_admin'
    )
    OR auth.role() = 'service_role'
);

-- UPDATE: Only users with positions or admins
DROP POLICY IF EXISTS "Authenticated users can update securities" ON "public"."Security";

CREATE POLICY "Users can update securities they own" ON "public"."Security"
FOR UPDATE
USING (
    -- Users who have positions with this security
    EXISTS (
        SELECT 1
        FROM "public"."Position" "p"
        INNER JOIN "public"."InvestmentAccount" "ia" ON "ia"."id" = "p"."accountId"
        WHERE "p"."securityId" = "Security"."id"
          AND "ia"."userId" = auth.uid()
    )
    -- Admins can update any security
    OR EXISTS (
        SELECT 1
        FROM "public"."User"
        WHERE "User"."id" = auth.uid()
          AND "User"."role" = 'super_admin'
    )
    -- Service role can update
    OR auth.role() = 'service_role'
)
WITH CHECK (
    -- Same conditions as USING
    EXISTS (
        SELECT 1
        FROM "public"."Position" "p"
        INNER JOIN "public"."InvestmentAccount" "ia" ON "ia"."id" = "p"."accountId"
        WHERE "p"."securityId" = "Security"."id"
          AND "ia"."userId" = auth.uid()
    )
    OR EXISTS (
        SELECT 1
        FROM "public"."User"
        WHERE "User"."id" = auth.uid()
          AND "User"."role" = 'super_admin'
    )
    OR auth.role() = 'service_role'
);

-- SELECT: Keep public (anyone can view)
-- Policy "Anyone can view securities" remains unchanged

COMMENT ON POLICY "Users can delete securities they own" ON "public"."Security" IS 
'Allows users to delete securities they have positions in, or admins/service_role to delete any security';

COMMENT ON POLICY "Admins can insert securities" ON "public"."Security" IS 
'Allows only super_admin and service_role to insert new securities';

COMMENT ON POLICY "Users can update securities they own" ON "public"."Security" IS 
'Allows users to update securities they have positions in, or admins/service_role to update any security';

-- ============================================================================
-- 2. RESTRICT SecurityPrice TABLE POLICIES
-- ============================================================================

-- DELETE: Only users with positions or admins
DROP POLICY IF EXISTS "Authenticated users can delete security prices" ON "public"."SecurityPrice";

CREATE POLICY "Users can delete prices for securities they own" ON "public"."SecurityPrice"
FOR DELETE
USING (
    -- Users who have positions with this security
    EXISTS (
        SELECT 1
        FROM "public"."Position" "p"
        INNER JOIN "public"."InvestmentAccount" "ia" ON "ia"."id" = "p"."accountId"
        WHERE "p"."securityId" = "SecurityPrice"."securityId"
          AND "ia"."userId" = auth.uid()
    )
    -- Admins can delete any price
    OR EXISTS (
        SELECT 1
        FROM "public"."User"
        WHERE "User"."id" = auth.uid()
          AND "User"."role" = 'super_admin'
    )
    -- Service role can delete
    OR auth.role() = 'service_role'
);

-- INSERT: Only users with positions or admins
DROP POLICY IF EXISTS "Authenticated users can insert security prices" ON "public"."SecurityPrice";

CREATE POLICY "Users can insert prices for securities they own" ON "public"."SecurityPrice"
FOR INSERT
WITH CHECK (
    -- Users who have positions with this security
    EXISTS (
        SELECT 1
        FROM "public"."Position" "p"
        INNER JOIN "public"."InvestmentAccount" "ia" ON "ia"."id" = "p"."accountId"
        WHERE "p"."securityId" = "SecurityPrice"."securityId"
          AND "ia"."userId" = auth.uid()
    )
    -- Admins can insert any price
    OR EXISTS (
        SELECT 1
        FROM "public"."User"
        WHERE "User"."id" = auth.uid()
          AND "User"."role" = 'super_admin'
    )
    -- Service role can insert
    OR auth.role() = 'service_role'
);

-- UPDATE: Only users with positions or admins
DROP POLICY IF EXISTS "Authenticated users can update security prices" ON "public"."SecurityPrice";

CREATE POLICY "Users can update prices for securities they own" ON "public"."SecurityPrice"
FOR UPDATE
USING (
    -- Users who have positions with this security
    EXISTS (
        SELECT 1
        FROM "public"."Position" "p"
        INNER JOIN "public"."InvestmentAccount" "ia" ON "ia"."id" = "p"."accountId"
        WHERE "p"."securityId" = "SecurityPrice"."securityId"
          AND "ia"."userId" = auth.uid()
    )
    -- Admins can update any price
    OR EXISTS (
        SELECT 1
        FROM "public"."User"
        WHERE "User"."id" = auth.uid()
          AND "User"."role" = 'super_admin'
    )
    -- Service role can update
    OR auth.role() = 'service_role'
)
WITH CHECK (
    -- Same conditions as USING
    EXISTS (
        SELECT 1
        FROM "public"."Position" "p"
        INNER JOIN "public"."InvestmentAccount" "ia" ON "ia"."id" = "p"."accountId"
        WHERE "p"."securityId" = "SecurityPrice"."securityId"
          AND "ia"."userId" = auth.uid()
    )
    OR EXISTS (
        SELECT 1
        FROM "public"."User"
        WHERE "User"."id" = auth.uid()
          AND "User"."role" = 'super_admin'
    )
    OR auth.role() = 'service_role'
);

-- SELECT: Keep public (anyone can view)
-- Policy "Anyone can view security prices" remains unchanged

COMMENT ON POLICY "Users can delete prices for securities they own" ON "public"."SecurityPrice" IS 
'Allows users to delete prices for securities they have positions in, or admins/service_role to delete any price';

COMMENT ON POLICY "Users can insert prices for securities they own" ON "public"."SecurityPrice" IS 
'Allows users to insert prices for securities they have positions in, or admins/service_role to insert any price';

COMMENT ON POLICY "Users can update prices for securities they own" ON "public"."SecurityPrice" IS 
'Allows users to update prices for securities they have positions in, or admins/service_role to update any price';

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. Security: INSERT restricted to admins only (new securities should be created by system)
--    DELETE/UPDATE allowed for users with positions (they can manage their own securities)
--
-- 2. SecurityPrice: All operations restricted to users with positions or admins
--    This prevents unauthorized price manipulation
--
-- 3. SELECT policies remain public - anyone can view securities and prices
--
-- 4. Service role always has full access for system operations

