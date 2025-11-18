-- ============================================================================
-- Fix macroId to groupId - Final Verification and Correction
-- ============================================================================
-- Data: 2025-01-28
-- Descrição: Script final para garantir que todas as referências a macroId
--            foram migradas para groupId e que o banco está consistente
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR E CORRIGIR COLUNAS
-- ============================================================================

-- Verificar se Category.macroId ainda existe e renomear para groupId
DO $$
BEGIN
  -- Se macroId existe, renomear para groupId
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'Category' 
    AND column_name = 'macroId'
  ) THEN
    -- Verificar se groupId já existe
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Category' 
      AND column_name = 'groupId'
    ) THEN
      -- Se ambos existem, copiar dados e remover macroId
      UPDATE "public"."Category" 
      SET "groupId" = "macroId" 
      WHERE "groupId" IS NULL AND "macroId" IS NOT NULL;
      
      ALTER TABLE "public"."Category" DROP COLUMN "macroId";
      RAISE NOTICE 'Removed Category.macroId (data copied to groupId)';
    ELSE
      -- Se só macroId existe, renomear
      ALTER TABLE "public"."Category" RENAME COLUMN "macroId" TO "groupId";
      RAISE NOTICE 'Renamed Category.macroId to Category.groupId';
    END IF;
  ELSE
    RAISE NOTICE 'Category.macroId does not exist (already migrated)';
  END IF;
END $$;

-- Verificar se Budget.macroId ainda existe e renomear para groupId
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'Budget' 
    AND column_name = 'macroId'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Budget' 
      AND column_name = 'groupId'
    ) THEN
      UPDATE "public"."Budget" 
      SET "groupId" = "macroId" 
      WHERE "groupId" IS NULL AND "macroId" IS NOT NULL;
      
      ALTER TABLE "public"."Budget" DROP COLUMN "macroId";
      RAISE NOTICE 'Removed Budget.macroId (data copied to groupId)';
    ELSE
      ALTER TABLE "public"."Budget" RENAME COLUMN "macroId" TO "groupId";
      RAISE NOTICE 'Renamed Budget.macroId to Budget.groupId';
    END IF;
  ELSE
    RAISE NOTICE 'Budget.macroId does not exist (already migrated)';
  END IF;
END $$;

-- ============================================================================
-- 2. VERIFICAR E CORRIGIR FOREIGN KEYS
-- ============================================================================

-- Garantir que Category_groupId_fkey existe e está correta
DO $$
BEGIN
  -- Se Category_macroId_fkey existe, renomear
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Category_macroId_fkey'
  ) THEN
    ALTER TABLE "public"."Category" 
    RENAME CONSTRAINT "Category_macroId_fkey" TO "Category_groupId_fkey";
    RAISE NOTICE 'Renamed constraint Category_macroId_fkey to Category_groupId_fkey';
  END IF;
  
  -- Se Category_groupId_fkey não existe, criar
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Category_groupId_fkey'
  ) THEN
    ALTER TABLE "public"."Category"
    ADD CONSTRAINT "Category_groupId_fkey" 
    FOREIGN KEY ("groupId") 
    REFERENCES "public"."Group"("id") 
    ON UPDATE CASCADE ON DELETE CASCADE;
    RAISE NOTICE 'Created constraint Category_groupId_fkey';
  ELSE
    RAISE NOTICE 'Constraint Category_groupId_fkey already exists';
  END IF;
END $$;

-- Garantir que Budget_groupId_fkey existe e está correta
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Budget_macroId_fkey'
  ) THEN
    ALTER TABLE "public"."Budget" 
    RENAME CONSTRAINT "Budget_macroId_fkey" TO "Budget_groupId_fkey";
    RAISE NOTICE 'Renamed constraint Budget_macroId_fkey to Budget_groupId_fkey';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Budget_groupId_fkey'
  ) THEN
    ALTER TABLE "public"."Budget"
    ADD CONSTRAINT "Budget_groupId_fkey" 
    FOREIGN KEY ("groupId") 
    REFERENCES "public"."Group"("id") 
    ON UPDATE CASCADE ON DELETE CASCADE;
    RAISE NOTICE 'Created constraint Budget_groupId_fkey';
  ELSE
    RAISE NOTICE 'Constraint Budget_groupId_fkey already exists';
  END IF;
END $$;

-- ============================================================================
-- 3. VERIFICAR E CORRIGIR ÍNDICES
-- ============================================================================

-- Renomear ou criar Category_groupId_idx
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname = 'Category_macroId_idx'
  ) THEN
    ALTER INDEX "public"."Category_macroId_idx" RENAME TO "Category_groupId_idx";
    RAISE NOTICE 'Renamed index Category_macroId_idx to Category_groupId_idx';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname = 'Category_groupId_idx'
  ) THEN
    CREATE INDEX "Category_groupId_idx" ON "public"."Category"("groupId");
    RAISE NOTICE 'Created index Category_groupId_idx';
  ELSE
    RAISE NOTICE 'Index Category_groupId_idx already exists';
  END IF;
END $$;

-- Renomear ou criar Budget_groupId_idx
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname = 'Budget_macroId_idx'
  ) THEN
    ALTER INDEX "public"."Budget_macroId_idx" RENAME TO "Budget_groupId_idx";
    RAISE NOTICE 'Renamed index Budget_macroId_idx to Budget_groupId_idx';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname = 'Budget_groupId_idx'
  ) THEN
    CREATE INDEX "Budget_groupId_idx" ON "public"."Budget"("groupId") 
    WHERE "groupId" IS NOT NULL;
    RAISE NOTICE 'Created index Budget_groupId_idx';
  ELSE
    RAISE NOTICE 'Index Budget_groupId_idx already exists';
  END IF;
END $$;

-- Renomear outros índices relacionados
DO $$
BEGIN
  -- idx_category_macro → idx_category_group
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname = 'idx_category_macro'
  ) THEN
    ALTER INDEX "public"."idx_category_macro" RENAME TO "idx_category_group";
    RAISE NOTICE 'Renamed index idx_category_macro to idx_category_group';
  END IF;
  
  -- idx_category_userid_macroid → idx_category_userid_groupid
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname = 'idx_category_userid_macroid'
  ) THEN
    ALTER INDEX "public"."idx_category_userid_macroid" RENAME TO "idx_category_userid_groupid";
    RAISE NOTICE 'Renamed index idx_category_userid_macroid to idx_category_userid_groupid';
  END IF;
  
  -- Budget_period_macroId_key → Budget_period_groupId_key
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname = 'Budget_period_macroId_key'
  ) THEN
    ALTER INDEX "public"."Budget_period_macroId_key" RENAME TO "Budget_period_groupId_key";
    RAISE NOTICE 'Renamed index Budget_period_macroId_key to Budget_period_groupId_key';
  END IF;
END $$;

-- ============================================================================
-- 4. VERIFICAR INTEGRIDADE DOS DADOS
-- ============================================================================

-- Verificar se há Categories com groupId NULL (deve ser NOT NULL)
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM "public"."Category"
  WHERE "groupId" IS NULL;
  
  IF null_count > 0 THEN
    RAISE WARNING 'Found % Categories with NULL groupId. These need to be fixed manually.', null_count;
  ELSE
    RAISE NOTICE 'All Categories have valid groupId';
  END IF;
END $$;

-- Verificar se há Categories com groupId que não existe em Group
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM "public"."Category" c
  LEFT JOIN "public"."Group" g ON c."groupId" = g."id"
  WHERE c."groupId" IS NOT NULL AND g."id" IS NULL;
  
  IF invalid_count > 0 THEN
    RAISE WARNING 'Found % Categories with invalid groupId (references non-existent Group). These need to be fixed manually.', invalid_count;
  ELSE
    RAISE NOTICE 'All Categories have valid groupId references';
  END IF;
END $$;

-- ============================================================================
-- 5. GARANTIR QUE A COLUNA groupId É NOT NULL (se aplicável)
-- ============================================================================

-- Category.groupId deve ser NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'Category' 
    AND column_name = 'groupId'
    AND is_nullable = 'YES'
  ) THEN
    -- Verificar se há valores NULL antes de tornar NOT NULL
    IF EXISTS (SELECT 1 FROM "public"."Category" WHERE "groupId" IS NULL) THEN
      RAISE WARNING 'Cannot set Category.groupId to NOT NULL: there are NULL values. Fix data first.';
    ELSE
      ALTER TABLE "public"."Category" ALTER COLUMN "groupId" SET NOT NULL;
      RAISE NOTICE 'Set Category.groupId to NOT NULL';
    END IF;
  ELSE
    RAISE NOTICE 'Category.groupId is already NOT NULL or does not exist';
  END IF;
END $$;

-- ============================================================================
-- RESUMO
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Migration completed. Summary:';
  RAISE NOTICE '- Verified and fixed Category.macroId → groupId';
  RAISE NOTICE '- Verified and fixed Budget.macroId → groupId';
  RAISE NOTICE '- Verified and fixed foreign key constraints';
  RAISE NOTICE '- Verified and fixed indexes';
  RAISE NOTICE '- Verified data integrity';
  RAISE NOTICE '============================================================================';
END $$;

