-- ============================================================================
-- Fix Budget groupId NULL values
-- ============================================================================
-- Data: 2025-01-28
-- Descrição: Corrige Budgets com groupId NULL inferindo o valor a partir
--            da categoryId ou BudgetCategory relacionada
-- ============================================================================

-- ============================================================================
-- 1. CORRIGIR BUDGETS COM categoryId (budgets de categoria única)
-- ============================================================================
-- Para budgets de categoria única, o groupId deve vir da Category relacionada
-- Nota: Segundo o código, budgets de categoria única têm groupId = NULL,
--       mas para manter consistência com o schema, vamos preencher com o
--       groupId da Category

DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE "public"."Budget" b
  SET "groupId" = c."groupId"
  FROM "public"."Category" c
  WHERE b."categoryId" = c."id"
    AND b."groupId" IS NULL
    AND c."groupId" IS NOT NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % Budgets with groupId from Category (single category budgets)', updated_count;
END $$;

-- ============================================================================
-- 2. CORRIGIR BUDGETS AGRUPADOS (sem categoryId, mas com BudgetCategory)
-- ============================================================================
-- Para budgets agrupados, o groupId deve vir da primeira Category relacionada
-- via BudgetCategory

DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE "public"."Budget" b
  SET "groupId" = (
    SELECT c."groupId"
    FROM "public"."BudgetCategory" bc
    JOIN "public"."Category" c ON bc."categoryId" = c."id"
    WHERE bc."budgetId" = b."id"
      AND c."groupId" IS NOT NULL
    LIMIT 1
  )
  WHERE b."groupId" IS NULL
    AND b."categoryId" IS NULL
    AND EXISTS (
      SELECT 1
      FROM "public"."BudgetCategory" bc
      JOIN "public"."Category" c ON bc."categoryId" = c."id"
      WHERE bc."budgetId" = b."id"
        AND c."groupId" IS NOT NULL
    );
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % Budgets with groupId from BudgetCategory (grouped budgets)', updated_count;
END $$;

-- ============================================================================
-- 3. VERIFICAR BUDGETS QUE AINDA ESTÃO COM groupId NULL
-- ============================================================================

DO $$
DECLARE
  remaining_count INTEGER;
  problem_budgets RECORD;
BEGIN
  SELECT COUNT(*) INTO remaining_count
  FROM "public"."Budget"
  WHERE "groupId" IS NULL;
  
  IF remaining_count > 0 THEN
    RAISE WARNING 'Found % Budgets that still have NULL groupId:', remaining_count;
    
    -- Listar os primeiros 10 budgets problemáticos
    FOR problem_budgets IN
      SELECT 
        b."id",
        b."period",
        b."categoryId",
        b."userId",
        CASE 
          WHEN b."categoryId" IS NOT NULL THEN 'Has categoryId but Category not found or has NULL groupId'
          WHEN EXISTS (SELECT 1 FROM "public"."BudgetCategory" WHERE "budgetId" = b."id") THEN 'Has BudgetCategory but all Categories have NULL groupId'
          ELSE 'No categoryId and no BudgetCategory'
        END as issue
      FROM "public"."Budget" b
      WHERE b."groupId" IS NULL
      LIMIT 10
    LOOP
      RAISE WARNING '  Budget ID: %, Period: %, Issue: %', 
        problem_budgets."id", 
        problem_budgets."period",
        problem_budgets.issue;
    END LOOP;
    
    RAISE WARNING 'These budgets need manual review. They may be orphaned or have invalid data.';
  ELSE
    RAISE NOTICE 'All Budgets now have valid groupId';
  END IF;
END $$;

-- ============================================================================
-- 4. VERIFICAR INTEGRIDADE: Budgets com groupId que não existe em Group
-- ============================================================================

DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM "public"."Budget" b
  LEFT JOIN "public"."Group" g ON b."groupId" = g."id"
  WHERE b."groupId" IS NOT NULL 
    AND g."id" IS NULL;
  
  IF invalid_count > 0 THEN
    RAISE WARNING 'Found % Budgets with invalid groupId (references non-existent Group). These need to be fixed manually.', invalid_count;
  ELSE
    RAISE NOTICE 'All Budgets have valid groupId references';
  END IF;
END $$;

-- ============================================================================
-- 5. RESUMO FINAL
-- ============================================================================

DO $$
DECLARE
  total_budgets INTEGER;
  budgets_with_groupid INTEGER;
  budgets_null_groupid INTEGER;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE "groupId" IS NOT NULL),
    COUNT(*) FILTER (WHERE "groupId" IS NULL)
  INTO 
    total_budgets,
    budgets_with_groupid,
    budgets_null_groupid
  FROM "public"."Budget";
  
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Budget groupId Fix Summary:';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Total Budgets: %', total_budgets;
  RAISE NOTICE 'Budgets with groupId: %', budgets_with_groupid;
  RAISE NOTICE 'Budgets with NULL groupId: %', budgets_null_groupid;
  RAISE NOTICE '============================================================================';
  
  IF budgets_null_groupid > 0 THEN
    RAISE WARNING 'Some Budgets still have NULL groupId. Review the warnings above.';
  ELSE
    RAISE NOTICE 'All Budgets have been fixed successfully!';
  END IF;
END $$;

