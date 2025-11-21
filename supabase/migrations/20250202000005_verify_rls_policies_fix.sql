-- ============================================================================
-- Verify RLS Policies Fix
-- ============================================================================
-- Date: 2025-02-02
-- Description: Verification script to ensure all RLS policy fixes were applied correctly
-- ============================================================================

DO $$
DECLARE
  policy_count INTEGER;
  expected_policies TEXT[] := ARRAY[
    -- UserBlockHistory policies
    'Admins can view all block history',
    'Users can view own block history',
    'Admins can insert block history',
    -- TransactionSync policies (household)
    'Users can delete household TransactionSync',
    'Users can insert household TransactionSync',
    'Users can update household TransactionSync',
    -- Security policies (restricted)
    'Users can delete securities they own',
    'Admins can insert securities',
    'Users can update securities they own',
    -- SecurityPrice policies (restricted)
    'Users can delete prices for securities they own',
    'Users can insert prices for securities they own',
    'Users can update prices for securities they own'
  ];
  missing_policies TEXT[] := ARRAY[]::TEXT[];
  policy_name TEXT;
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Verifying RLS Policy Fixes';
  RAISE NOTICE '============================================';
  
  -- Check UserBlockHistory policies
  RAISE NOTICE '';
  RAISE NOTICE '1. Checking UserBlockHistory policies...';
  
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'UserBlockHistory';
  
  IF policy_count >= 3 THEN
    RAISE NOTICE '   ✓ UserBlockHistory has % policies (expected at least 3)', policy_count;
  ELSE
    RAISE WARNING '   ✗ UserBlockHistory has only % policies (expected at least 3)', policy_count;
  END IF;
  
  -- Check TransactionSync policies
  RAISE NOTICE '';
  RAISE NOTICE '2. Checking TransactionSync household policies...';
  
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'TransactionSync'
    AND policyname LIKE '%household%';
  
  IF policy_count >= 3 THEN
    RAISE NOTICE '   ✓ TransactionSync has % household policies (expected at least 3)', policy_count;
  ELSE
    RAISE WARNING '   ✗ TransactionSync has only % household policies (expected at least 3)', policy_count;
  END IF;
  
  -- Check that old TransactionSync policies were removed
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'TransactionSync'
    AND policyname LIKE '%own accounts%';
  
  IF policy_count = 0 THEN
    RAISE NOTICE '   ✓ Old "own accounts" policies removed from TransactionSync';
  ELSE
    RAISE WARNING '   ✗ Found % old "own accounts" policies (should be 0)', policy_count;
  END IF;
  
  -- Check Execution policies (should not have "own accounts")
  RAISE NOTICE '';
  RAISE NOTICE '3. Checking Execution policies (redundancy removed)...';
  
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'Execution'
    AND policyname LIKE '%own accounts%';
  
  IF policy_count = 0 THEN
    RAISE NOTICE '   ✓ No redundant "own accounts" policies in Execution';
  ELSE
    RAISE WARNING '   ✗ Found % redundant "own accounts" policies (should be 0)', policy_count;
  END IF;
  
  -- Check Order policies (should not have "own accounts")
  RAISE NOTICE '';
  RAISE NOTICE '4. Checking Order policies (redundancy removed)...';
  
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'Order'
    AND policyname LIKE '%own accounts%';
  
  IF policy_count = 0 THEN
    RAISE NOTICE '   ✓ No redundant "own accounts" policies in Order';
  ELSE
    RAISE WARNING '   ✗ Found % redundant "own accounts" policies (should be 0)', policy_count;
  END IF;
  
  -- Check Security policies (should be restricted)
  RAISE NOTICE '';
  RAISE NOTICE '5. Checking Security policies (restricted)...';
  
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'Security'
    AND policyname LIKE '%they own%';
  
  IF policy_count >= 2 THEN
    RAISE NOTICE '   ✓ Security has % restricted policies (expected at least 2)', policy_count;
  ELSE
    RAISE WARNING '   ✗ Security has only % restricted policies (expected at least 2)', policy_count;
  END IF;
  
  -- Check SecurityPrice policies (should be restricted)
  RAISE NOTICE '';
  RAISE NOTICE '6. Checking SecurityPrice policies (restricted)...';
  
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'SecurityPrice'
    AND policyname LIKE '%they own%';
  
  IF policy_count >= 3 THEN
    RAISE NOTICE '   ✓ SecurityPrice has % restricted policies (expected at least 3)', policy_count;
  ELSE
    RAISE WARNING '   ✗ SecurityPrice has only % restricted policies (expected at least 3)', policy_count;
  END IF;
  
  -- Check Account UPDATE policy
  RAISE NOTICE '';
  RAISE NOTICE '7. Checking Account UPDATE policy (WITH CHECK fixed)...';
  
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'Account'
    AND policyname = 'Users can update household accounts'
    AND cmd = 'UPDATE';
  
  IF policy_count = 1 THEN
    RAISE NOTICE '   ✓ Account UPDATE policy exists';
    
    -- Check if policy definition includes AccountOwner
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'Account'
      AND policyname = 'Users can update household accounts'
      AND cmd = 'UPDATE'
      AND (qual::text LIKE '%can_access_account_via_accountowner%' 
           OR with_check::text LIKE '%can_access_account_via_accountowner%');
    
    IF policy_count >= 1 THEN
      RAISE NOTICE '   ✓ Account UPDATE policy includes AccountOwner check';
    ELSE
      RAISE WARNING '   ✗ Account UPDATE policy may not include AccountOwner check';
    END IF;
  ELSE
    RAISE WARNING '   ✗ Account UPDATE policy not found or incorrect';
  END IF;
  
  -- Verify all expected policies exist
  RAISE NOTICE '';
  RAISE NOTICE '8. Verifying all expected policies exist...';
  
  FOREACH policy_name IN ARRAY expected_policies
  LOOP
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname = policy_name;
    
    IF policy_count = 0 THEN
      missing_policies := array_append(missing_policies, policy_name);
    END IF;
  END LOOP;
  
  IF array_length(missing_policies, 1) IS NULL THEN
    RAISE NOTICE '   ✓ All expected policies exist';
  ELSE
    RAISE WARNING '   ✗ Missing policies: %', array_to_string(missing_policies, ', ');
  END IF;
  
  -- Final summary
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Verification Complete';
  RAISE NOTICE '============================================';
  
  IF array_length(missing_policies, 1) IS NULL THEN
    RAISE NOTICE '✓ All RLS policy fixes verified successfully!';
  ELSE
    RAISE WARNING '⚠ Some policies may be missing. Please review the warnings above.';
  END IF;
  
END $$;

-- Additional verification queries (for manual inspection if needed)
-- Uncomment to run manually:

/*
-- List all UserBlockHistory policies
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'UserBlockHistory';

-- List all TransactionSync policies
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'TransactionSync';

-- List all Security policies
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'Security';

-- List all SecurityPrice policies
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'SecurityPrice';

-- Check Account UPDATE policy details
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'Account'
  AND policyname = 'Users can update household accounts'
  AND cmd = 'UPDATE';
*/

