-- ============================================================================
-- Verify macroId to groupId Migration Status
-- ============================================================================
-- Data: 2025-01-28
-- Descrição: Script de verificação para diagnosticar o estado da migração
--            macroId → groupId no banco de dados
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR COLUNAS
-- ============================================================================

SELECT 
  'Column Check' as check_type,
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('Category', 'Budget')
  AND column_name IN ('macroId', 'groupId')
ORDER BY table_name, column_name;

-- ============================================================================
-- 2. VERIFICAR FOREIGN KEYS
-- ============================================================================

SELECT 
  'Foreign Key Check' as check_type,
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND (tc.table_name IN ('Category', 'Budget')
    OR tc.constraint_name LIKE '%macroId%'
    OR tc.constraint_name LIKE '%groupId%')
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================================================
-- 3. VERIFICAR ÍNDICES
-- ============================================================================

SELECT 
  'Index Check' as check_type,
  schemaname,
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (tablename IN ('Category', 'Budget')
    OR indexname LIKE '%macroId%'
    OR indexname LIKE '%groupId%'
    OR indexname LIKE '%macro%'
    OR indexname LIKE '%group%')
ORDER BY tablename, indexname;

-- ============================================================================
-- 4. VERIFICAR DADOS
-- ============================================================================

-- Contar Categories com macroId vs groupId
SELECT 
  'Data Check - Category' as check_type,
  COUNT(*) FILTER (WHERE "groupId" IS NOT NULL) as has_groupId,
  COUNT(*) FILTER (WHERE "groupId" IS NULL) as null_groupId,
  COUNT(*) as total
FROM "public"."Category";

-- Contar Budgets com macroId vs groupId
SELECT 
  'Data Check - Budget' as check_type,
  COUNT(*) FILTER (WHERE "groupId" IS NOT NULL) as has_groupId,
  COUNT(*) FILTER (WHERE "groupId" IS NULL) as null_groupId,
  COUNT(*) as total
FROM "public"."Budget";

-- Detalhes dos Budgets com groupId NULL
SELECT 
  'Budget Details - NULL groupId' as check_type,
  b."id",
  b."period",
  b."categoryId",
  b."subcategoryId",
  CASE 
    WHEN b."categoryId" IS NOT NULL THEN 'Has categoryId'
    WHEN EXISTS (SELECT 1 FROM "public"."BudgetCategory" WHERE "budgetId" = b."id") THEN 'Has BudgetCategory (grouped)'
    ELSE 'No categoryId and no BudgetCategory'
  END as budget_type,
  c."groupId" as category_groupId
FROM "public"."Budget" b
LEFT JOIN "public"."Category" c ON b."categoryId" = c."id"
WHERE b."groupId" IS NULL
ORDER BY b."period" DESC
LIMIT 10;

-- Verificar Categories com groupId inválido
SELECT 
  'Data Integrity - Invalid groupId' as check_type,
  c.id,
  c.name,
  c."groupId",
  'Category references non-existent Group' as issue
FROM "public"."Category" c
LEFT JOIN "public"."Group" g ON c."groupId" = g."id"
WHERE c."groupId" IS NOT NULL 
  AND g."id" IS NULL
LIMIT 10;

-- ============================================================================
-- 5. RESUMO
-- ============================================================================

DO $$
DECLARE
  category_macroid_exists BOOLEAN;
  category_groupid_exists BOOLEAN;
  budget_macroid_exists BOOLEAN;
  budget_groupid_exists BOOLEAN;
BEGIN
  -- Verificar Category
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'Category' 
    AND column_name = 'macroId'
  ) INTO category_macroid_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'Category' 
    AND column_name = 'groupId'
  ) INTO category_groupid_exists;
  
  -- Verificar Budget
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'Budget' 
    AND column_name = 'macroId'
  ) INTO budget_macroid_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'Budget' 
    AND column_name = 'groupId'
  ) INTO budget_groupid_exists;
  
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Migration Status Summary:';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Category.macroId exists: %', category_macroid_exists;
  RAISE NOTICE 'Category.groupId exists: %', category_groupid_exists;
  RAISE NOTICE 'Budget.macroId exists: %', budget_macroid_exists;
  RAISE NOTICE 'Budget.groupId exists: %', budget_groupid_exists;
  RAISE NOTICE '============================================================================';
  
  IF category_macroid_exists OR budget_macroid_exists THEN
    RAISE WARNING 'Migration needed: macroId columns still exist';
  ELSE
    RAISE NOTICE 'Migration complete: All macroId columns have been migrated to groupId';
  END IF;
END $$;

