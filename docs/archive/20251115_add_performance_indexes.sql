-- ============================================================================
-- Migration: Add Performance Indexes
-- Date: 2025-11-15
-- Description: Adiciona índices para otimizar queries lentas identificadas
-- Estimated execution time: 2-5 minutes (depending on data volume)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TRANSACTION INDEXES
-- ============================================================================

-- Index para check-updates query (userId + updatedAt)
CREATE INDEX IF NOT EXISTS idx_transaction_user_updated 
  ON "Transaction"("userId", "updatedAt" DESC, "createdAt" DESC)
  WHERE "updatedAt" IS NOT NULL;

-- Index para queries por data
CREATE INDEX IF NOT EXISTS idx_transaction_user_date 
  ON "Transaction"("userId", date DESC)
  WHERE date IS NOT NULL;

-- Index para filtros por categoria
CREATE INDEX IF NOT EXISTS idx_transaction_user_category 
  ON "Transaction"("userId", "categoryId")
  WHERE "categoryId" IS NOT NULL;

-- Index para busca por descrição
CREATE INDEX IF NOT EXISTS idx_transaction_description_gin 
  ON "Transaction" USING gin(to_tsvector('english', description))
  WHERE description IS NOT NULL;

-- ============================================================================
-- 2. ACCOUNT INDEXES
-- ============================================================================

-- Index para check-updates query
CREATE INDEX IF NOT EXISTS idx_account_user_updated 
  ON "Account"("userId", "updatedAt" DESC, "createdAt" DESC)
  WHERE "updatedAt" IS NOT NULL;

-- Index para queries por tipo
CREATE INDEX IF NOT EXISTS idx_account_user_type 
  ON "Account"("userId", type)
  WHERE type IS NOT NULL;

-- ============================================================================
-- 3. BUDGET INDEXES
-- ============================================================================

-- Index para check-updates query
CREATE INDEX IF NOT EXISTS idx_budget_user_updated 
  ON "Budget"("userId", "updatedAt" DESC, "createdAt" DESC)
  WHERE "updatedAt" IS NOT NULL;

-- Index para queries por período (Budget usa apenas coluna 'period', não startDate/endDate)
CREATE INDEX IF NOT EXISTS idx_budget_user_period 
  ON "Budget"("userId", period DESC)
  WHERE period IS NOT NULL;

-- Index para categoria
CREATE INDEX IF NOT EXISTS idx_budget_category 
  ON "Budget"("categoryId")
  WHERE "categoryId" IS NOT NULL;

-- ============================================================================
-- 4. GOAL INDEXES
-- ============================================================================

-- Index para check-updates query
CREATE INDEX IF NOT EXISTS idx_goal_user_updated 
  ON "Goal"("userId", "updatedAt" DESC, "createdAt" DESC)
  WHERE "updatedAt" IS NOT NULL;

-- Index para queries por completedAt (Goal não tem targetDate, usa targetMonths)
CREATE INDEX IF NOT EXISTS idx_goal_user_completed 
  ON "Goal"("userId", "completedAt" DESC)
  WHERE "completedAt" IS NOT NULL;

-- Index para status (isCompleted, isPaused)
CREATE INDEX IF NOT EXISTS idx_goal_user_status 
  ON "Goal"("userId", "isCompleted", "isPaused")
  WHERE "isCompleted" IS NOT NULL;

-- ============================================================================
-- 5. DEBT INDEXES
-- ============================================================================

-- Index para check-updates query
CREATE INDEX IF NOT EXISTS idx_debt_user_updated 
  ON "Debt"("userId", "updatedAt" DESC, "createdAt" DESC)
  WHERE "updatedAt" IS NOT NULL;

-- Index para queries por loanType (Debt usa loanType, não type)
CREATE INDEX IF NOT EXISTS idx_debt_user_loan_type 
  ON "Debt"("userId", "loanType")
  WHERE "loanType" IS NOT NULL;

-- ============================================================================
-- 6. INVESTMENT TRANSACTION INDEXES
-- ============================================================================

-- Index para queries por data (portfolio historical)
-- NOTA: InvestmentTransaction não tem userId diretamente, filtra por accountId
CREATE INDEX IF NOT EXISTS idx_investment_transaction_account_date 
  ON "InvestmentTransaction"("accountId", date DESC)
  WHERE date IS NOT NULL;

-- Index para holdings calculation (security + account)
CREATE INDEX IF NOT EXISTS idx_investment_transaction_security 
  ON "InvestmentTransaction"("securityId", "accountId", type)
  WHERE "securityId" IS NOT NULL;

-- Index para check-updates query (usa accountId em vez de userId)
CREATE INDEX IF NOT EXISTS idx_investment_transaction_updated 
  ON "InvestmentTransaction"("accountId", "updatedAt" DESC, "createdAt" DESC)
  WHERE "updatedAt" IS NOT NULL;

-- Index composto para cálculo eficiente de holdings
CREATE INDEX IF NOT EXISTS idx_investment_transaction_holdings_calc 
  ON "InvestmentTransaction"("accountId", "securityId", date)
  WHERE "securityId" IS NOT NULL AND date IS NOT NULL;

-- ============================================================================
-- 7. SECURITY PRICE INDEXES
-- ============================================================================

-- Index para queries de preço mais recente
CREATE INDEX IF NOT EXISTS idx_security_price_security_date 
  ON "SecurityPrice"("securityId", date DESC)
  WHERE date IS NOT NULL;

-- Index para range queries (historical data)
CREATE INDEX IF NOT EXISTS idx_security_price_date_range 
  ON "SecurityPrice"("securityId", date)
  WHERE date IS NOT NULL;

-- ============================================================================
-- 8. POSITION INDEXES (Questrade)
-- ============================================================================

-- Index para holdings query
CREATE INDEX IF NOT EXISTS idx_position_account_open 
  ON "Position"("accountId", "openQuantity", "lastUpdatedAt" DESC)
  WHERE "openQuantity" > 0;

-- Index para lookup por security
CREATE INDEX IF NOT EXISTS idx_position_security 
  ON "Position"("securityId", "accountId")
  WHERE "securityId" IS NOT NULL;

-- ============================================================================
-- 9. INVESTMENT ACCOUNT INDEXES
-- ============================================================================

-- Index para queries de contas Questrade
CREATE INDEX IF NOT EXISTS idx_investment_account_questrade 
  ON "InvestmentAccount"("userId", "isQuestradeConnected")
  WHERE "isQuestradeConnected" = true;

-- Index para queries por tipo
CREATE INDEX IF NOT EXISTS idx_investment_account_type 
  ON "InvestmentAccount"("userId", type)
  WHERE type IS NOT NULL;

-- ============================================================================
-- 10. CATEGORY INDEXES
-- ============================================================================

-- Index para queries por userId (Category não tem isActive, apenas userId)
CREATE INDEX IF NOT EXISTS idx_category_user 
  ON "Category"("userId")
  WHERE "userId" IS NOT NULL;

-- Index para hierarchy (macro categories)
CREATE INDEX IF NOT EXISTS idx_category_macro 
  ON "Category"("macroId")
  WHERE "macroId" IS NOT NULL;

-- ============================================================================
-- 11. SIMPLE INVESTMENT ENTRY INDEXES
-- ============================================================================

-- Index para check-updates query
-- NOTA: SimpleInvestmentEntry não tem userId diretamente, filtra por accountId
CREATE INDEX IF NOT EXISTS idx_simple_investment_account_updated 
  ON "SimpleInvestmentEntry"("accountId", "updatedAt" DESC, "createdAt" DESC)
  WHERE "updatedAt" IS NOT NULL;

-- Index para queries por data
CREATE INDEX IF NOT EXISTS idx_simple_investment_account_date 
  ON "SimpleInvestmentEntry"("accountId", date DESC)
  WHERE date IS NOT NULL;

COMMIT;

-- ============================================================================
-- VERIFICAÇÃO E ANÁLISE
-- ============================================================================

-- Verificar tamanho dos índices criados
SELECT 
  pg_indexes.schemaname,
  pg_indexes.tablename,
  pg_indexes.indexname,
  pg_size_pretty(pg_relation_size(pg_class.oid)) as index_size,
  pg_stat_user_indexes.idx_scan as times_used,
  pg_stat_user_indexes.idx_tup_read as tuples_read,
  pg_stat_user_indexes.idx_tup_fetch as tuples_fetched
FROM pg_indexes
JOIN pg_class ON pg_indexes.indexname = pg_class.relname
LEFT JOIN pg_stat_user_indexes ON pg_indexes.indexname = pg_stat_user_indexes.indexrelname
WHERE pg_indexes.schemaname = 'public'
  AND pg_indexes.indexname LIKE 'idx_%'
ORDER BY pg_relation_size(pg_class.oid) DESC
LIMIT 20;

-- Verificar uso de índices após algumas queries
-- Executar após usar a aplicação por alguns minutos:
-- SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public' ORDER BY idx_scan DESC;

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================

-- 1. Monitorar o impacto no desempenho de INSERT/UPDATE após criar índices
-- 2. Considerar VACUUM ANALYZE após criar índices em tabelas grandes:
--    VACUUM ANALYZE "Transaction";
--    VACUUM ANALYZE "InvestmentTransaction";
--    etc.

-- 3. Para remover índices não utilizados após 1 semana de monitoramento:
--    SELECT 'DROP INDEX ' || indexrelname || ';'
--    FROM pg_stat_user_indexes
--    WHERE schemaname = 'public' 
--      AND idx_scan = 0
--      AND indexrelname LIKE 'idx_%';

-- 4. Tamanho total dos índices criados (estimado):
--    - Pequeno banco (<1000 registros): ~10-50 MB
--    - Médio banco (1000-10000 registros): ~50-200 MB
--    - Grande banco (>10000 registros): >200 MB

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
