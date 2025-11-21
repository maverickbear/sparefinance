-- ============================================================================
-- Check Security Policies
-- ============================================================================
-- Quick verification query to check all Security policies
-- ============================================================================

-- List all Security policies
SELECT 
    policyname,
    cmd,
    CASE 
        WHEN qual IS NOT NULL THEN 'Has USING clause'
        ELSE 'No USING clause'
    END as using_clause,
    CASE 
        WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
        ELSE 'No WITH CHECK clause'
    END as with_check_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'Security'
ORDER BY cmd, policyname;

-- Expected policies:
-- 1. "Anyone can view securities" - SELECT
-- 2. "Admins can insert securities" - INSERT
-- 3. "Users can delete securities they own" - DELETE
-- 4. "Users can update securities they own" - UPDATE

-- If INSERT policy is missing, you should see only 3 policies
-- If all are correct, you should see 4 policies

