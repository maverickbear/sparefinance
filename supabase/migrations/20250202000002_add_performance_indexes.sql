-- ============================================================================
-- Migration: Add Performance Indexes
-- Date: 2025-02-02
-- Description: Adiciona índices adicionais para otimizar queries de performance
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. INVESTMENT TRANSACTION INDEXES
-- ============================================================================

-- Index para queries de holdings por securityId e accountId
CREATE INDEX IF NOT EXISTS idx_investment_transaction_security_account 
  ON "InvestmentTransaction"("securityId", "accountId", date DESC)
  WHERE "securityId" IS NOT NULL;

-- Index para queries de transações por data e tipo
CREATE INDEX IF NOT EXISTS idx_investment_transaction_date_type 
  ON "InvestmentTransaction"(date DESC, type)
  WHERE date IS NOT NULL;

-- ============================================================================
-- 2. SECURITY PRICE INDEXES
-- ============================================================================

-- Index para buscar preços mais recentes por security
CREATE INDEX IF NOT EXISTS idx_security_price_security_date_desc 
  ON "SecurityPrice"("securityId", date DESC)
  WHERE date IS NOT NULL;

-- Index para queries de preços históricos por data
CREATE INDEX IF NOT EXISTS idx_security_price_date 
  ON "SecurityPrice"(date DESC)
  WHERE date IS NOT NULL;

-- ============================================================================
-- 3. POSITION INDEXES (Questrade)
-- ============================================================================

-- Index para buscar posições abertas por account
CREATE INDEX IF NOT EXISTS idx_position_account_open_quantity 
  ON "Position"("accountId", "openQuantity" DESC)
  WHERE "openQuantity" > 0;

-- Index para queries de posições atualizadas recentemente
CREATE INDEX IF NOT EXISTS idx_position_last_updated 
  ON "Position"("lastUpdatedAt" DESC)
  WHERE "lastUpdatedAt" IS NOT NULL;

-- ============================================================================
-- 4. TRANSACTION INDEXES (Additional)
-- ============================================================================

-- Index para queries de transações por categoria
CREATE INDEX IF NOT EXISTS idx_transaction_category_date 
  ON "Transaction"("categoryId", date DESC)
  WHERE "categoryId" IS NOT NULL AND date IS NOT NULL;

-- Index para queries de transações recorrentes
CREATE INDEX IF NOT EXISTS idx_transaction_recurring 
  ON "Transaction"("recurring", date DESC)
  WHERE "recurring" = true;

-- ============================================================================
-- 5. ACCOUNT INDEXES (Additional)
-- ============================================================================

-- Index para queries de contas por tipo e usuário
CREATE INDEX IF NOT EXISTS idx_account_user_type 
  ON "Account"("userId", type)
  WHERE "userId" IS NOT NULL AND type IS NOT NULL;

-- ============================================================================
-- 6. VERIFY INDEXES
-- ============================================================================

-- Verificar se os índices foram criados
DO $$
DECLARE
  index_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
    AND (
      indexname LIKE '%investment_transaction%' OR
      indexname LIKE '%security_price%' OR
      indexname LIKE '%position%' OR
      indexname LIKE '%transaction%' OR
      indexname LIKE '%account%'
    );
  
  RAISE NOTICE 'Total performance indexes found: %', index_count;
END $$;

COMMIT;

-- ============================================================================
-- NOTES
-- ============================================================================
-- These indexes will improve query performance for:
-- 1. Portfolio holdings calculations
-- 2. Historical price lookups
-- 3. Transaction filtering by category/type
-- 4. Account-based queries
--
-- Monitor index usage with:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan DESC;

