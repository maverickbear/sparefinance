-- ============================================================================
-- Create Household Structure
-- ============================================================================
-- Date: 2025-02-01
-- Description: Creates Household, HouseholdMember, and UserActiveHousehold tables
--              to support household-based architecture (personal and household accounts)
-- ============================================================================

-- ============================================================================
-- 1. CREATE HOUSEHOLD TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."Household" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "type" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdBy" uuid NOT NULL,
    "settings" jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT "Household_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Household_type_check" CHECK (("type" = ANY (ARRAY['personal'::"text", 'household'::"text"]))),
    CONSTRAINT "Household_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."Household" OWNER TO "postgres";

COMMENT ON TABLE "public"."Household" IS 'Households for organizing users and their data (personal or shared household accounts)';
COMMENT ON COLUMN "public"."Household"."type" IS 'Type of household: personal (individual account) or household (shared account)';
COMMENT ON COLUMN "public"."Household"."createdBy" IS 'User who created this household';
COMMENT ON COLUMN "public"."Household"."settings" IS 'Household-specific settings stored as JSON';

-- ============================================================================
-- 2. CREATE HOUSEHOLDMEMBER TABLE (NEW - for household architecture)
-- ============================================================================
-- NOTE: This is different from the existing HouseholdMember table
-- The existing table uses ownerId/memberId pattern
-- This new table uses householdId/userId pattern for the new architecture

CREATE TABLE IF NOT EXISTS "public"."HouseholdMemberNew" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "householdId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "role" text DEFAULT 'member'::"text" NOT NULL,
    "status" text DEFAULT 'pending'::"text" NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "joinedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "invitedBy" uuid,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "HouseholdMemberNew_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HouseholdMemberNew_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE,
    CONSTRAINT "HouseholdMemberNew_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE,
    CONSTRAINT "HouseholdMemberNew_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL,
    CONSTRAINT "HouseholdMemberNew_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"]))),
    CONSTRAINT "HouseholdMemberNew_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'pending'::"text", 'inactive'::"text"]))),
    CONSTRAINT "HouseholdMemberNew_householdId_userId_key" UNIQUE ("householdId", "userId")
);

ALTER TABLE "public"."HouseholdMemberNew" OWNER TO "postgres";

COMMENT ON TABLE "public"."HouseholdMemberNew" IS 'Membership relationship between users and households (new architecture)';
COMMENT ON COLUMN "public"."HouseholdMemberNew"."role" IS 'Role in the household: owner (full control), admin (can modify), member (read-only)';
COMMENT ON COLUMN "public"."HouseholdMemberNew"."status" IS 'Membership status: active, pending (invitation), inactive';
COMMENT ON COLUMN "public"."HouseholdMemberNew"."isDefault" IS 'Whether this is the default household for the user (typically their personal household)';

-- ============================================================================
-- 3. CREATE USERACTIVEHOUSEHOLD TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."UserActiveHousehold" (
    "userId" uuid NOT NULL,
    "householdId" uuid NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "UserActiveHousehold_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "UserActiveHousehold_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "public"."Household"("id") ON DELETE CASCADE,
    CONSTRAINT "UserActiveHousehold_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."UserActiveHousehold" OWNER TO "postgres";

COMMENT ON TABLE "public"."UserActiveHousehold" IS 'Tracks which household is currently active for each user';
COMMENT ON COLUMN "public"."UserActiveHousehold"."householdId" IS 'The currently active household for this user';

-- ============================================================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for HouseholdMemberNew lookups by household and user
CREATE INDEX IF NOT EXISTS "HouseholdMemberNew_householdId_userId_status_idx" 
ON "public"."HouseholdMemberNew"("householdId", "userId", "status");

-- Index for finding all households a user belongs to
CREATE INDEX IF NOT EXISTS "HouseholdMemberNew_userId_status_idx" 
ON "public"."HouseholdMemberNew"("userId", "status");

-- Index for finding households by type and creator
CREATE INDEX IF NOT EXISTS "Household_type_createdBy_idx" 
ON "public"."Household"("type", "createdBy");

-- Index for UserActiveHousehold lookups
CREATE INDEX IF NOT EXISTS "UserActiveHousehold_householdId_idx" 
ON "public"."UserActiveHousehold"("householdId");

-- ============================================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE "public"."Household" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."HouseholdMemberNew" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."UserActiveHousehold" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. CREATE RLS POLICIES FOR HOUSEHOLD
-- ============================================================================

-- Users can view households they are members of
CREATE POLICY "Users can view their households" ON "public"."Household"
FOR SELECT
USING (
    "id" IN (
        SELECT "householdId" FROM "public"."HouseholdMemberNew"
        WHERE "userId" = auth.uid() AND "status" = 'active'
    )
    OR "createdBy" = auth.uid()
);

-- Only owners can create households (will be handled by application logic)
CREATE POLICY "Users can create households" ON "public"."Household"
FOR INSERT
WITH CHECK ("createdBy" = auth.uid());

-- Only owners can update their households
CREATE POLICY "Owners can update their households" ON "public"."Household"
FOR UPDATE
USING ("createdBy" = auth.uid());

-- Only owners can delete their households
CREATE POLICY "Owners can delete their households" ON "public"."Household"
FOR DELETE
USING ("createdBy" = auth.uid());

-- ============================================================================
-- 7. CREATE RLS POLICIES FOR HOUSEHOLDMEMBERNEW
-- ============================================================================

-- Users can view members of households they belong to
CREATE POLICY "Users can view household members" ON "public"."HouseholdMemberNew"
FOR SELECT
USING (
    "householdId" IN (
        SELECT "householdId" FROM "public"."HouseholdMemberNew"
        WHERE "userId" = auth.uid() AND "status" = 'active'
    )
);

-- Users can be added as members (handled by application)
CREATE POLICY "Users can be added to households" ON "public"."HouseholdMemberNew"
FOR INSERT
WITH CHECK (
    "userId" = auth.uid() 
    OR "householdId" IN (
        SELECT "householdId" FROM "public"."HouseholdMemberNew"
        WHERE "userId" = auth.uid() AND "role" IN ('owner', 'admin') AND "status" = 'active'
    )
);

-- Only owners/admins can update member roles
CREATE POLICY "Owners and admins can update household members" ON "public"."HouseholdMemberNew"
FOR UPDATE
USING (
    "householdId" IN (
        SELECT "householdId" FROM "public"."HouseholdMemberNew"
        WHERE "userId" = auth.uid() AND "role" IN ('owner', 'admin') AND "status" = 'active'
    )
);

-- Only owners/admins can remove members
CREATE POLICY "Owners and admins can remove household members" ON "public"."HouseholdMemberNew"
FOR DELETE
USING (
    "householdId" IN (
        SELECT "householdId" FROM "public"."HouseholdMemberNew"
        WHERE "userId" = auth.uid() AND "role" IN ('owner', 'admin') AND "status" = 'active'
    )
    OR "userId" = auth.uid() -- Users can remove themselves
);

-- ============================================================================
-- 8. CREATE RLS POLICIES FOR USERACTIVEHOUSEHOLD
-- ============================================================================

-- Users can view their own active household
CREATE POLICY "Users can view their active household" ON "public"."UserActiveHousehold"
FOR SELECT
USING ("userId" = auth.uid());

-- Users can set their own active household
CREATE POLICY "Users can set their active household" ON "public"."UserActiveHousehold"
FOR ALL
USING ("userId" = auth.uid())
WITH CHECK (
    "userId" = auth.uid()
    AND "householdId" IN (
        SELECT "householdId" FROM "public"."HouseholdMemberNew"
        WHERE "userId" = auth.uid() AND "status" = 'active'
    )
);

