-- ============================================================================
-- Migration: Fix Database Issues - Spare Finance
-- Data: 2024-12-01
-- Descrição: Corrige problemas críticos de integridade, nomenclatura e consistência
-- ============================================================================

-- IMPORTANTE: Execute este script em ambiente de desenvolvimento primeiro!
-- IMPORTANTE: Faça backup do banco antes de executar em produção!

BEGIN;

-- ============================================================================
-- FASE 1: CORREÇÕES CRÍTICAS - NOT NULL CONSTRAINTS
-- ============================================================================

-- Verificar e corrigir registros órfãos antes de adicionar NOT NULL
-- Se houver registros com userId NULL, eles serão atribuídos ao primeiro usuário
-- ou removidos (dependendo da lógica de negócio)

-- 1.1 InvestmentAccount.userId
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  -- Contar registros órfãos
  SELECT COUNT(*) INTO orphan_count
  FROM "InvestmentAccount"
  WHERE "userId" IS NULL;
  
  IF orphan_count > 0 THEN
    RAISE NOTICE 'Encontrados % registros de InvestmentAccount sem userId', orphan_count;
    
    -- Atribuir ao primeiro usuário (ou remover se não houver usuários)
    UPDATE "InvestmentAccount"
    SET "userId" = (SELECT id FROM "User" ORDER BY "createdAt" LIMIT 1)
    WHERE "userId" IS NULL
    AND EXISTS (SELECT 1 FROM "User" LIMIT 1);
    
    -- Se ainda houver órfãos (sem usuários no sistema), remover
    DELETE FROM "InvestmentAccount"
    WHERE "userId" IS NULL;
    
    RAISE NOTICE 'Registros órfãos de InvestmentAccount corrigidos ou removidos';
  END IF;
END $$;

-- Adicionar NOT NULL constraint
ALTER TABLE "InvestmentAccount" 
  ALTER COLUMN "userId" SET NOT NULL;

COMMENT ON COLUMN "InvestmentAccount"."userId" IS 'User ID - obrigatório para RLS policies';

-- 1.2 Budget.userId
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM "Budget"
  WHERE "userId" IS NULL;
  
  IF orphan_count > 0 THEN
    RAISE NOTICE 'Encontrados % registros de Budget sem userId', orphan_count;
    
    UPDATE "Budget"
    SET "userId" = (SELECT id FROM "User" ORDER BY "createdAt" LIMIT 1)
    WHERE "userId" IS NULL
    AND EXISTS (SELECT 1 FROM "User" LIMIT 1);
    
    DELETE FROM "Budget"
    WHERE "userId" IS NULL;
    
    RAISE NOTICE 'Registros órfãos de Budget corrigidos ou removidos';
  END IF;
END $$;

ALTER TABLE "Budget" 
  ALTER COLUMN "userId" SET NOT NULL;

COMMENT ON COLUMN "Budget"."userId" IS 'User ID - obrigatório para RLS policies';

-- 1.3 Debt.userId
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM "Debt"
  WHERE "userId" IS NULL;
  
  IF orphan_count > 0 THEN
    RAISE NOTICE 'Encontrados % registros de Debt sem userId', orphan_count;
    
    UPDATE "Debt"
    SET "userId" = (SELECT id FROM "User" ORDER BY "createdAt" LIMIT 1)
    WHERE "userId" IS NULL
    AND EXISTS (SELECT 1 FROM "User" LIMIT 1);
    
    DELETE FROM "Debt"
    WHERE "userId" IS NULL;
    
    RAISE NOTICE 'Registros órfãos de Debt corrigidos ou removidos';
  END IF;
END $$;

ALTER TABLE "Debt" 
  ALTER COLUMN "userId" SET NOT NULL;

COMMENT ON COLUMN "Debt"."userId" IS 'User ID - obrigatório para RLS policies';

-- 1.4 Goal.userId
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM "Goal"
  WHERE "userId" IS NULL;
  
  IF orphan_count > 0 THEN
    RAISE NOTICE 'Encontrados % registros de Goal sem userId', orphan_count;
    
    UPDATE "Goal"
    SET "userId" = (SELECT id FROM "User" ORDER BY "createdAt" LIMIT 1)
    WHERE "userId" IS NULL
    AND EXISTS (SELECT 1 FROM "User" LIMIT 1);
    
    DELETE FROM "Goal"
    WHERE "userId" IS NULL;
    
    RAISE NOTICE 'Registros órfãos de Goal corrigidos ou removidos';
  END IF;
END $$;

ALTER TABLE "Goal" 
  ALTER COLUMN "userId" SET NOT NULL;

COMMENT ON COLUMN "Goal"."userId" IS 'User ID - obrigatório para RLS policies';

-- ============================================================================
-- FASE 2: CORREÇÕES DE NOMENCLATURA - FOREIGN KEYS
-- ============================================================================

-- 2.1 Renomear Macro_userId_fkey para Group_userId_fkey
-- Verificar se a tabela e constraint existem antes de renomear
DO $$
DECLARE
  table_exists BOOLEAN;
  constraint_exists BOOLEAN;
BEGIN
  -- Verificar se a tabela Group existe
  SELECT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'Group'
  ) INTO table_exists;
  
  IF NOT table_exists THEN
    RAISE NOTICE 'Tabela Group não encontrada - pulando renomeação de foreign key';
    RETURN;
  END IF;
  
  -- Verificar se a constraint existe
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
    AND t.relname = 'Group'
    AND c.conname = 'Macro_userId_fkey'
  ) INTO constraint_exists;
  
  IF constraint_exists THEN
    ALTER TABLE "Group" 
      RENAME CONSTRAINT "Macro_userId_fkey" TO "Group_userId_fkey";
    RAISE NOTICE 'Foreign key Macro_userId_fkey renomeada para Group_userId_fkey';
  ELSE
    RAISE NOTICE 'Foreign key Macro_userId_fkey não encontrada (pode já ter sido renomeada)';
  END IF;
END $$;

-- 2.2 Renomear Budget_groupId_fkey para Budget_macroId_fkey (opcional, mas recomendado)
DO $$
DECLARE
  table_exists BOOLEAN;
  constraint_exists BOOLEAN;
BEGIN
  -- Verificar se a tabela Budget existe
  SELECT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'Budget'
  ) INTO table_exists;
  
  IF NOT table_exists THEN
    RAISE NOTICE 'Tabela Budget não encontrada - pulando renomeação de foreign key';
    RETURN;
  END IF;
  
  -- Verificar se a constraint existe
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
    AND t.relname = 'Budget'
    AND c.conname = 'Budget_groupId_fkey'
  ) INTO constraint_exists;
  
  IF constraint_exists THEN
    ALTER TABLE "Budget" 
      RENAME CONSTRAINT "Budget_groupId_fkey" TO "Budget_macroId_fkey";
    RAISE NOTICE 'Foreign key Budget_groupId_fkey renomeada para Budget_macroId_fkey';
  ELSE
    RAISE NOTICE 'Foreign key Budget_groupId_fkey não encontrada';
  END IF;
END $$;

-- ============================================================================
-- FASE 3: MELHORIAS DE CONSISTÊNCIA
-- ============================================================================

-- 3.1 Adicionar DEFAULT em InvestmentAccount.updatedAt
ALTER TABLE "InvestmentAccount" 
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

COMMENT ON COLUMN "InvestmentAccount"."updatedAt" IS 'Timestamp de última atualização - atualizado automaticamente';

-- ============================================================================
-- FASE 4: VERIFICAÇÃO DE ÍNDICES
-- ============================================================================

-- Verificar se todos os índices necessários existem
-- (A maioria já existe, mas vamos garantir)

-- InvestmentAccount.userId - verificar se existe índice
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public'
    AND tablename = 'InvestmentAccount' 
    AND indexname = 'InvestmentAccount_userId_idx'
  ) THEN
    CREATE INDEX "InvestmentAccount_userId_idx" 
    ON "InvestmentAccount" USING btree ("userId");
    RAISE NOTICE 'Índice InvestmentAccount_userId_idx criado';
  ELSE
    RAISE NOTICE 'Índice InvestmentAccount_userId_idx já existe';
  END IF;
END $$;

-- Budget.userId - verificar se existe índice (já existe, mas garantir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public'
    AND tablename = 'Budget' 
    AND indexname = 'Budget_userId_idx'
  ) THEN
    CREATE INDEX "Budget_userId_idx" 
    ON "Budget" USING btree ("userId");
    RAISE NOTICE 'Índice Budget_userId_idx criado';
  ELSE
    RAISE NOTICE 'Índice Budget_userId_idx já existe';
  END IF;
END $$;

-- Debt.userId - verificar se existe índice (já existe, mas garantir)
-- Nota: Como userId agora é NOT NULL, não precisamos do WHERE clause
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public'
    AND tablename = 'Debt' 
    AND indexname = 'Debt_userId_idx'
  ) THEN
    CREATE INDEX "Debt_userId_idx" 
    ON "Debt" USING btree ("userId");
    RAISE NOTICE 'Índice Debt_userId_idx criado';
  ELSE
    RAISE NOTICE 'Índice Debt_userId_idx já existe';
  END IF;
END $$;

-- Goal.userId - verificar se existe índice (já existe, mas garantir)
-- Nota: Como userId agora é NOT NULL, não precisamos do WHERE clause
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public'
    AND tablename = 'Goal' 
    AND indexname = 'Goal_userId_idx'
  ) THEN
    CREATE INDEX "Goal_userId_idx" 
    ON "Goal" USING btree ("userId");
    RAISE NOTICE 'Índice Goal_userId_idx criado';
  ELSE
    RAISE NOTICE 'Índice Goal_userId_idx já existe';
  END IF;
END $$;

-- ============================================================================
-- FASE 5: VALIDAÇÃO E RELATÓRIO
-- ============================================================================

-- Verificar se todas as correções foram aplicadas
DO $$
DECLARE
  investment_account_null_count INTEGER;
  budget_null_count INTEGER;
  debt_null_count INTEGER;
  goal_null_count INTEGER;
BEGIN
  -- Verificar se ainda há NULLs (não deveria haver após as correções)
  SELECT COUNT(*) INTO investment_account_null_count
  FROM "InvestmentAccount" WHERE "userId" IS NULL;
  
  SELECT COUNT(*) INTO budget_null_count
  FROM "Budget" WHERE "userId" IS NULL;
  
  SELECT COUNT(*) INTO debt_null_count
  FROM "Debt" WHERE "userId" IS NULL;
  
  SELECT COUNT(*) INTO goal_null_count
  FROM "Goal" WHERE "userId" IS NULL;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VALIDAÇÃO PÓS-CORREÇÃO:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'InvestmentAccount com userId NULL: %', investment_account_null_count;
  RAISE NOTICE 'Budget com userId NULL: %', budget_null_count;
  RAISE NOTICE 'Debt com userId NULL: %', debt_null_count;
  RAISE NOTICE 'Goal com userId NULL: %', goal_null_count;
  RAISE NOTICE '========================================';
  
  IF investment_account_null_count > 0 OR budget_null_count > 0 OR 
     debt_null_count > 0 OR goal_null_count > 0 THEN
    RAISE WARNING 'ATENÇÃO: Ainda existem registros com userId NULL!';
  ELSE
    RAISE NOTICE 'SUCESSO: Todos os registros têm userId definido!';
  END IF;
END $$;

-- Verificar foreign keys renomeadas
DO $$
DECLARE
  table_exists BOOLEAN;
  constraint_exists BOOLEAN;
BEGIN
  -- Verificar se a tabela Group existe
  SELECT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'Group'
  ) INTO table_exists;
  
  IF NOT table_exists THEN
    RAISE NOTICE 'Tabela Group não encontrada - pulando verificação de foreign key';
    RETURN;
  END IF;
  
  -- Verificar se a constraint existe
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Group_userId_fkey'
  ) INTO constraint_exists;
  
  IF constraint_exists THEN
    RAISE NOTICE 'SUCESSO: Foreign key Group_userId_fkey existe';
  ELSE
    RAISE WARNING 'ATENÇÃO: Foreign key Group_userId_fkey não encontrada';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- NOTAS FINAIS
-- ============================================================================

-- Esta migração corrige:
-- ✅ NOT NULL constraints em InvestmentAccount, Budget, Debt, Goal
-- ✅ Nomenclatura de foreign keys (Macro → Group)
-- ✅ DEFAULT em InvestmentAccount.updatedAt
-- ✅ Índices garantidos para performance
-- 
-- Próximos passos recomendados:
-- 1. Testar queries críticas
-- 2. Verificar performance de RLS policies
-- 3. Executar testes de integração
-- 4. Atualizar tipos TypeScript se necessário

