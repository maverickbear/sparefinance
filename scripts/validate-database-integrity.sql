-- ============================================================================
-- Script SQL de Validação de Integridade do Banco de Dados
-- Execute este script no Supabase SQL Editor após aplicar a migração
-- ============================================================================

-- ============================================================================
-- 1. VALIDAR CONSTRAINTS NOT NULL
-- ============================================================================

DO $$
DECLARE
  investment_account_nulls INTEGER;
  budget_nulls INTEGER;
  debt_nulls INTEGER;
  goal_nulls INTEGER;
BEGIN
  -- Verificar InvestmentAccount.userId
  SELECT COUNT(*) INTO investment_account_nulls
  FROM "InvestmentAccount"
  WHERE "userId" IS NULL;
  
  -- Verificar Budget.userId
  SELECT COUNT(*) INTO budget_nulls
  FROM "Budget"
  WHERE "userId" IS NULL;
  
  -- Verificar Debt.userId
  SELECT COUNT(*) INTO debt_nulls
  FROM "Debt"
  WHERE "userId" IS NULL;
  
  -- Verificar Goal.userId
  SELECT COUNT(*) INTO goal_nulls
  FROM "Goal"
  WHERE "userId" IS NULL;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VALIDAÇÃO DE NOT NULL CONSTRAINTS:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'InvestmentAccount.userId NULL: %', investment_account_nulls;
  RAISE NOTICE 'Budget.userId NULL: %', budget_nulls;
  RAISE NOTICE 'Debt.userId NULL: %', debt_nulls;
  RAISE NOTICE 'Goal.userId NULL: %', goal_nulls;
  RAISE NOTICE '========================================';
  
  IF investment_account_nulls > 0 OR budget_nulls > 0 OR 
     debt_nulls > 0 OR goal_nulls > 0 THEN
    RAISE WARNING 'FALHA: Existem registros com userId NULL!';
  ELSE
    RAISE NOTICE 'SUCESSO: Todos os registros têm userId definido!';
  END IF;
END $$;

-- ============================================================================
-- 2. VALIDAR FOREIGN KEYS RENOMEADAS
-- ============================================================================

DO $$
DECLARE
  group_fk_exists BOOLEAN;
  macro_fk_exists BOOLEAN;
BEGIN
  -- Verificar se Group_userId_fkey existe
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Group_userId_fkey' 
    AND conrelid = 'public.Group'::regclass
  ) INTO group_fk_exists;
  
  -- Verificar se Macro_userId_fkey ainda existe (não deveria)
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Macro_userId_fkey' 
    AND conrelid = 'public.Group'::regclass
  ) INTO macro_fk_exists;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VALIDAÇÃO DE FOREIGN KEYS:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Group_userId_fkey existe: %', group_fk_exists;
  RAISE NOTICE 'Macro_userId_fkey ainda existe: %', macro_fk_exists;
  RAISE NOTICE '========================================';
  
  IF NOT group_fk_exists THEN
    RAISE WARNING 'FALHA: Foreign key Group_userId_fkey não encontrada!';
  ELSIF macro_fk_exists THEN
    RAISE WARNING 'FALHA: Foreign key Macro_userId_fkey ainda existe!';
  ELSE
    RAISE NOTICE 'SUCESSO: Foreign keys renomeadas corretamente!';
  END IF;
END $$;

-- ============================================================================
-- 3. VALIDAR ÍNDICES
-- ============================================================================

DO $$
DECLARE
  idx_count INTEGER;
  missing_indexes TEXT[] := ARRAY[]::TEXT[];
  required_indexes TEXT[] := ARRAY[
    'InvestmentAccount_userId_idx',
    'Budget_userId_idx',
    'Debt_userId_idx',
    'Goal_userId_idx',
    'Transaction_userId_idx',
    'Account_userId_idx'
  ];
  idx_name TEXT;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VALIDAÇÃO DE ÍNDICES:';
  RAISE NOTICE '========================================';
  
  FOREACH idx_name IN ARRAY required_indexes
  LOOP
    SELECT COUNT(*) INTO idx_count
    FROM pg_indexes
    WHERE indexname = idx_name;
    
    IF idx_count = 0 THEN
      missing_indexes := array_append(missing_indexes, idx_name);
      RAISE NOTICE 'FALTANDO: %', idx_name;
    ELSE
      RAISE NOTICE 'EXISTE: %', idx_name;
    END IF;
  END LOOP;
  
  RAISE NOTICE '========================================';
  
  IF array_length(missing_indexes, 1) > 0 THEN
    RAISE WARNING 'FALHA: % índices faltando!', array_length(missing_indexes, 1);
  ELSE
    RAISE NOTICE 'SUCESSO: Todos os índices necessários existem!';
  END IF;
END $$;

-- ============================================================================
-- 4. VALIDAR REGISTROS ÓRFÃOS
-- ============================================================================

DO $$
DECLARE
  orphaned_investment_accounts INTEGER;
  orphaned_budgets INTEGER;
  orphaned_debts INTEGER;
  orphaned_goals INTEGER;
BEGIN
  -- InvestmentAccount sem User válido
  SELECT COUNT(*) INTO orphaned_investment_accounts
  FROM "InvestmentAccount" ia
  WHERE NOT EXISTS (
    SELECT 1 FROM "User" u WHERE u.id = ia."userId"
  );
  
  -- Budget sem User válido
  SELECT COUNT(*) INTO orphaned_budgets
  FROM "Budget" b
  WHERE NOT EXISTS (
    SELECT 1 FROM "User" u WHERE u.id = b."userId"
  );
  
  -- Debt sem User válido
  SELECT COUNT(*) INTO orphaned_debts
  FROM "Debt" d
  WHERE NOT EXISTS (
    SELECT 1 FROM "User" u WHERE u.id = d."userId"
  );
  
  -- Goal sem User válido
  SELECT COUNT(*) INTO orphaned_goals
  FROM "Goal" g
  WHERE NOT EXISTS (
    SELECT 1 FROM "User" u WHERE u.id = g."userId"
  );
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VALIDAÇÃO DE REGISTROS ÓRFÃOS:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'InvestmentAccount órfãos: %', orphaned_investment_accounts;
  RAISE NOTICE 'Budget órfãos: %', orphaned_budgets;
  RAISE NOTICE 'Debt órfãos: %', orphaned_debts;
  RAISE NOTICE 'Goal órfãos: %', orphaned_goals;
  RAISE NOTICE '========================================';
  
  IF orphaned_investment_accounts > 0 OR orphaned_budgets > 0 OR 
     orphaned_debts > 0 OR orphaned_goals > 0 THEN
    RAISE WARNING 'FALHA: Existem registros órfãos!';
  ELSE
    RAISE NOTICE 'SUCESSO: Nenhum registro órfão encontrado!';
  END IF;
END $$;

-- ============================================================================
-- 5. VALIDAR RLS POLICIES
-- ============================================================================

DO $$
DECLARE
  tables_without_rls TEXT[] := ARRAY[]::TEXT[];
  table_name TEXT;
  rls_enabled BOOLEAN;
  required_tables TEXT[] := ARRAY[
    'InvestmentAccount',
    'Budget',
    'Debt',
    'Goal',
    'Transaction',
    'Account'
  ];
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VALIDAÇÃO DE RLS POLICIES:';
  RAISE NOTICE '========================================';
  
  FOREACH table_name IN ARRAY required_tables
  LOOP
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class
    WHERE relname = table_name
    AND relnamespace = 'public'::regnamespace;
    
    IF NOT rls_enabled THEN
      tables_without_rls := array_append(tables_without_rls, table_name);
      RAISE NOTICE 'SEM RLS: %', table_name;
    ELSE
      RAISE NOTICE 'COM RLS: %', table_name;
    END IF;
  END LOOP;
  
  RAISE NOTICE '========================================';
  
  IF array_length(tables_without_rls, 1) > 0 THEN
    RAISE WARNING 'FALHA: % tabelas sem RLS habilitado!', array_length(tables_without_rls, 1);
  ELSE
    RAISE NOTICE 'SUCESSO: Todas as tabelas têm RLS habilitado!';
  END IF;
END $$;

-- ============================================================================
-- 6. RELATÓRIO FINAL
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VALIDAÇÃO COMPLETA FINALIZADA';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Revise os resultados acima.';
  RAISE NOTICE 'Se todas as validações passaram, o banco está íntegro!';
  RAISE NOTICE '';
END $$;

