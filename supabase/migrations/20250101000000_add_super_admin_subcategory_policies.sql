-- Add RLS policies for super_admin to manage system entities (Groups, Categories, Subcategories)
-- This allows super_admin users to create, update, and delete system entities (userId IS NULL)

-- ============================================================================
-- GROUP POLICIES
-- ============================================================================

-- Policy: Super admin can insert system groups
CREATE POLICY "Super admin can insert system groups" 
ON "public"."Group" 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "public"."User"
    WHERE (
      ("User"."id" = "auth"."uid"()) 
      AND ("User"."role" = 'super_admin'::text)
    )
  )
  AND ("userId" IS NULL)
);

-- Policy: Super admin can update system groups
CREATE POLICY "Super admin can update system groups" 
ON "public"."Group" 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1
    FROM "public"."User"
    WHERE (
      ("User"."id" = "auth"."uid"()) 
      AND ("User"."role" = 'super_admin'::text)
    )
  )
  AND ("userId" IS NULL)
);

-- Policy: Super admin can delete system groups
CREATE POLICY "Super admin can delete system groups" 
ON "public"."Group" 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1
    FROM "public"."User"
    WHERE (
      ("User"."id" = "auth"."uid"()) 
      AND ("User"."role" = 'super_admin'::text)
    )
  )
  AND ("userId" IS NULL)
);

-- ============================================================================
-- CATEGORY POLICIES
-- ============================================================================

-- Policy: Super admin can insert system categories
CREATE POLICY "Super admin can insert system categories" 
ON "public"."Category" 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "public"."User"
    WHERE (
      ("User"."id" = "auth"."uid"()) 
      AND ("User"."role" = 'super_admin'::text)
    )
  )
  AND ("userId" IS NULL)
);

-- Policy: Super admin can update system categories
CREATE POLICY "Super admin can update system categories" 
ON "public"."Category" 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1
    FROM "public"."User"
    WHERE (
      ("User"."id" = "auth"."uid"()) 
      AND ("User"."role" = 'super_admin'::text)
    )
  )
  AND ("userId" IS NULL)
);

-- Policy: Super admin can delete system categories
CREATE POLICY "Super admin can delete system categories" 
ON "public"."Category" 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1
    FROM "public"."User"
    WHERE (
      ("User"."id" = "auth"."uid"()) 
      AND ("User"."role" = 'super_admin'::text)
    )
  )
  AND ("userId" IS NULL)
);

-- ============================================================================
-- SUBCATEGORY POLICIES
-- ============================================================================

-- Policy: Super admin can insert system subcategories
CREATE POLICY "Super admin can insert system subcategories" 
ON "public"."Subcategory" 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "public"."User"
    WHERE (
      ("User"."id" = "auth"."uid"()) 
      AND ("User"."role" = 'super_admin'::text)
    )
  )
  AND ("userId" IS NULL)
);

-- Policy: Super admin can update system subcategories
CREATE POLICY "Super admin can update system subcategories" 
ON "public"."Subcategory" 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1
    FROM "public"."User"
    WHERE (
      ("User"."id" = "auth"."uid"()) 
      AND ("User"."role" = 'super_admin'::text)
    )
  )
  AND ("userId" IS NULL)
);

-- Policy: Super admin can delete system subcategories
CREATE POLICY "Super admin can delete system subcategories" 
ON "public"."Subcategory" 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1
    FROM "public"."User"
    WHERE (
      ("User"."id" = "auth"."uid"()) 
      AND ("User"."role" = 'super_admin'::text)
    )
  )
  AND ("userId" IS NULL)
);

