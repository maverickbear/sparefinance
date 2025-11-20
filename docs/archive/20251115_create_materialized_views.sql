-- ============================================================================
-- Migration: Create Materialized Views
-- Date: 2025-11-15
-- Description: Cria views materializadas para otimizar queries de holdings
-- Estimated execution time: 5-15 minutes (depending on data volume)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. HOLDINGS VIEW (Cálculo de holdings atuais)
-- ============================================================================

-- Drop existing view if exists
DROP MATERIALIZED VIEW IF EXISTS holdings_view CASCADE;

-- Criar view materializada para holdings
-- NOTA: InvestmentTransaction não tem userId diretamente, obtemos via Account
CREATE MATERIALIZED VIEW holdings_view AS
WITH transaction_agg AS (
  -- Agregar todas as transações por security e account
  SELECT 
    it."securityId",
    it."accountId",
    a."userId",
    -- Total de compras
    SUM(CASE WHEN it.type = 'buy' THEN COALESCE(it.quantity, 0) ELSE 0 END) as total_buy_qty,
    -- Total de vendas
    SUM(CASE WHEN it.type = 'sell' THEN COALESCE(it.quantity, 0) ELSE 0 END) as total_sell_qty,
    -- Custo total (book value)
    SUM(CASE 
      WHEN it.type = 'buy' THEN 
        (COALESCE(it.quantity, 0) * COALESCE(it.price, 0)) + COALESCE(it.fees, 0)
      WHEN it.type = 'sell' THEN 
        -((COALESCE(it.quantity, 0) * COALESCE(it.price, 0)) - COALESCE(it.fees, 0))
      ELSE 0 
    END) as book_value
  FROM "InvestmentTransaction" it
  JOIN "Account" a ON a.id = it."accountId"
  WHERE it."securityId" IS NOT NULL
    AND a."userId" IS NOT NULL
  GROUP BY it."securityId", it."accountId", a."userId"
),
security_latest_price AS (
  -- Buscar último preço de cada security
  SELECT DISTINCT ON ("securityId")
    "securityId",
    price as last_price,
    date as last_price_date
  FROM "SecurityPrice"
  ORDER BY "securityId", date DESC
)
SELECT 
  -- IDs
  ta."securityId" as security_id,
  ta."accountId" as account_id,
  ta."userId" as user_id,
  
  -- Security info
  s.symbol,
  s.name,
  s.class as asset_type,
  COALESCE(s.sector, 'Unknown') as sector,
  
  -- Quantities
  (ta.total_buy_qty - ta.total_sell_qty) as quantity,
  
  -- Prices
  CASE 
    WHEN (ta.total_buy_qty - ta.total_sell_qty) > 0 
    THEN ta.book_value / (ta.total_buy_qty - ta.total_sell_qty)
    ELSE 0 
  END as avg_price,
  
  -- Values
  ta.book_value,
  COALESCE(sp.last_price, 0) as last_price,
  (ta.total_buy_qty - ta.total_sell_qty) * COALESCE(sp.last_price, 0) as market_value,
  
  -- PnL
  ((ta.total_buy_qty - ta.total_sell_qty) * COALESCE(sp.last_price, 0) - ta.book_value) as unrealized_pnl,
  CASE 
    WHEN ta.book_value > 0 
    THEN (((ta.total_buy_qty - ta.total_sell_qty) * COALESCE(sp.last_price, 0) - ta.book_value) / ta.book_value) * 100
    ELSE 0 
  END as unrealized_pnl_percent,
  
  -- Account info
  a.name as account_name,
  
  -- Metadata
  sp.last_price_date,
  NOW() as last_updated
FROM transaction_agg ta
JOIN "Security" s ON s.id = ta."securityId"
LEFT JOIN security_latest_price sp ON sp."securityId" = ta."securityId"
LEFT JOIN "Account" a ON a.id = ta."accountId"
WHERE (ta.total_buy_qty - ta.total_sell_qty) > 0; -- Apenas holdings ativos

-- Criar índices na view materializada
-- NOTA: Usar nomes das colunas da view (snake_case após SELECT)
CREATE UNIQUE INDEX idx_holdings_view_unique 
  ON holdings_view(user_id, security_id, account_id);
  
CREATE INDEX idx_holdings_view_user 
  ON holdings_view(user_id);

CREATE INDEX idx_holdings_view_account 
  ON holdings_view(account_id);

CREATE INDEX idx_holdings_view_security 
  ON holdings_view(security_id);

-- Comentários
COMMENT ON MATERIALIZED VIEW holdings_view IS 
  'View materializada que calcula holdings atuais de forma otimizada. Refresh automático via trigger.';

COMMENT ON COLUMN holdings_view.quantity IS 
  'Quantidade atual do holding (compras - vendas)';

COMMENT ON COLUMN holdings_view.avg_price IS 
  'Preço médio de aquisição (custo base)';

COMMENT ON COLUMN holdings_view.unrealized_pnl IS 
  'Lucro/prejuízo não realizado em valor absoluto';

-- ============================================================================
-- 2. PORTFOLIO SUMMARY VIEW (Resumo por usuário)
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS portfolio_summary_view CASCADE;

CREATE MATERIALIZED VIEW portfolio_summary_view AS
SELECT 
  user_id,
  COUNT(*) as holdings_count,
  SUM(market_value) as total_value,
  SUM(book_value) as total_cost,
  SUM(unrealized_pnl) as total_return,
  CASE 
    WHEN SUM(book_value) > 0 
    THEN (SUM(unrealized_pnl) / SUM(book_value)) * 100
    ELSE 0 
  END as total_return_percent,
  NOW() as last_updated
FROM holdings_view
GROUP BY user_id;

-- Criar índice único para permitir refresh CONCURRENTLY
CREATE UNIQUE INDEX idx_portfolio_summary_user 
  ON portfolio_summary_view(user_id);

COMMENT ON MATERIALIZED VIEW portfolio_summary_view IS 
  'Resumo agregado do portfolio por usuário';

-- ============================================================================
-- 3. ASSET ALLOCATION VIEW (Distribuição por tipo de ativo)
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS asset_allocation_view CASCADE;

CREATE MATERIALIZED VIEW asset_allocation_view AS
WITH user_totals AS (
  SELECT 
    user_id,
    SUM(market_value) as total_portfolio_value
  FROM holdings_view
  GROUP BY user_id
)
SELECT 
  h.user_id,
  h.asset_type,
  COUNT(*) as holdings_count,
  SUM(h.market_value) as total_value,
  SUM(h.unrealized_pnl) as total_pnl,
  CASE 
    WHEN ut.total_portfolio_value > 0 
    THEN (SUM(h.market_value) / ut.total_portfolio_value) * 100
    ELSE 0 
  END as allocation_percent,
  NOW() as last_updated
FROM holdings_view h
JOIN user_totals ut ON ut.user_id = h.user_id
GROUP BY h.user_id, h.asset_type, ut.total_portfolio_value;

CREATE INDEX idx_asset_allocation_user 
  ON asset_allocation_view(user_id);

COMMENT ON MATERIALIZED VIEW asset_allocation_view IS 
  'Distribuição de portfolio por tipo de ativo (Stock, ETF, etc)';

-- ============================================================================
-- 4. SECTOR ALLOCATION VIEW (Distribuição por setor)
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS sector_allocation_view CASCADE;

CREATE MATERIALIZED VIEW sector_allocation_view AS
WITH user_totals AS (
  SELECT 
    user_id,
    SUM(market_value) as total_portfolio_value
  FROM holdings_view
  GROUP BY user_id
)
SELECT 
  h.user_id,
  h.sector,
  COUNT(*) as holdings_count,
  SUM(h.market_value) as total_value,
  SUM(h.unrealized_pnl) as total_pnl,
  CASE 
    WHEN ut.total_portfolio_value > 0 
    THEN (SUM(h.market_value) / ut.total_portfolio_value) * 100
    ELSE 0 
  END as allocation_percent,
  NOW() as last_updated
FROM holdings_view h
JOIN user_totals ut ON ut.user_id = h.user_id
GROUP BY h.user_id, h.sector, ut.total_portfolio_value;

CREATE INDEX idx_sector_allocation_user 
  ON sector_allocation_view(user_id);

COMMENT ON MATERIALIZED VIEW sector_allocation_view IS 
  'Distribuição de portfolio por setor';

-- ============================================================================
-- 5. FUNCTIONS E TRIGGERS PARA AUTO-REFRESH
-- ============================================================================

-- Função para notificar que precisa refresh
-- NOTA: InvestmentTransaction não tem userId, então apenas notificamos
CREATE OR REPLACE FUNCTION notify_refresh_holdings()
RETURNS TRIGGER AS $$
BEGIN
  -- Notificar que houve mudança (para background worker)
  -- Não podemos usar NEW.user_id porque InvestmentTransaction não tem essa coluna
  PERFORM pg_notify('refresh_holdings', 'refresh_needed');
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger para InvestmentTransaction
DROP TRIGGER IF EXISTS trigger_notify_holdings_refresh ON "InvestmentTransaction";
CREATE TRIGGER trigger_notify_holdings_refresh
AFTER INSERT OR UPDATE OR DELETE ON "InvestmentTransaction"
FOR EACH ROW
EXECUTE FUNCTION notify_refresh_holdings();

-- Trigger para SecurityPrice (quando preços são atualizados)
DROP TRIGGER IF EXISTS trigger_notify_price_refresh ON "SecurityPrice";
CREATE TRIGGER trigger_notify_price_refresh
AFTER INSERT OR UPDATE ON "SecurityPrice"
FOR EACH STATEMENT
EXECUTE FUNCTION notify_refresh_holdings();

-- Função para refresh manual (pode ser chamada por API ou cron job)
-- NOTA: CONCURRENTLY requer índice único em cada view
CREATE OR REPLACE FUNCTION refresh_portfolio_views()
RETURNS void AS $$
BEGIN
  -- Refresh holdings_view (tem índice único, pode usar CONCURRENTLY)
  REFRESH MATERIALIZED VIEW CONCURRENTLY holdings_view;
  
  -- Refresh portfolio_summary_view (tem índice único, pode usar CONCURRENTLY)
  REFRESH MATERIALIZED VIEW CONCURRENTLY portfolio_summary_view;
  
  -- Refresh outras views (sem índice único, não pode usar CONCURRENTLY)
  -- Estas views são pequenas e rápidas, então não precisa de CONCURRENTLY
  REFRESH MATERIALIZED VIEW asset_allocation_view;
  REFRESH MATERIALIZED VIEW sector_allocation_view;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_portfolio_views() IS 
  'Refresh manual de todas as views de portfolio. Executar via cron job ou API.';

-- ============================================================================
-- 6. PERMISSÕES RLS (Row Level Security)
-- ============================================================================

-- NOTA: Materialized Views não suportam RLS diretamente no PostgreSQL
-- A segurança deve ser aplicada na aplicação (código) ou através de views normais com RLS
-- Removendo tentativa de habilitar RLS em materialized views

-- Alternativa: Criar views normais com RLS que consultam as materialized views
-- (comentado por enquanto - pode ser implementado depois se necessário)

/*
-- Views com RLS que consultam materialized views
CREATE OR REPLACE VIEW holdings_view_secure AS
SELECT * FROM holdings_view
WHERE user_id = auth.uid();

ALTER VIEW holdings_view_secure ENABLE ROW LEVEL SECURITY;

CREATE POLICY holdings_view_secure_policy ON holdings_view_secure
  FOR SELECT
  USING (user_id = auth.uid());
*/

COMMIT;

-- ============================================================================
-- REFRESH INICIAL
-- ============================================================================

-- NOTA: Refresh inicial deve ser executado APÓS o COMMIT
-- Executar refresh inicial (pode demorar alguns minutos)
-- IMPORTANTE: Execute esta linha separadamente após o COMMIT
-- SELECT refresh_portfolio_views();

-- ============================================================================
-- VERIFICAÇÃO
-- ============================================================================

-- Verificar tamanho das views
SELECT 
  schemaname,
  matviewname,
  pg_size_pretty(pg_relation_size(matviewname::regclass)) as view_size,
  pg_size_pretty(pg_total_relation_size(matviewname::regclass)) as total_size_with_indexes
FROM pg_matviews
WHERE schemaname = 'public'
ORDER BY pg_relation_size(matviewname::regclass) DESC;

-- Verificar quantos registros foram criados
SELECT 'holdings_view' as view_name, COUNT(*) as row_count FROM holdings_view
UNION ALL
SELECT 'portfolio_summary_view', COUNT(*) FROM portfolio_summary_view
UNION ALL
SELECT 'asset_allocation_view', COUNT(*) FROM asset_allocation_view
UNION ALL
SELECT 'sector_allocation_view', COUNT(*) FROM sector_allocation_view;

-- Testar query simples
-- SELECT * FROM holdings_view WHERE user_id = 'SEU_USER_ID' LIMIT 5;

-- ============================================================================
-- MANUTENÇÃO E MONITORAMENTO
-- ============================================================================

-- Para refresh manual das views:
-- SELECT refresh_portfolio_views();

-- Para verificar quando foi último refresh:
-- SELECT matviewname, last_refresh 
-- FROM pg_matview_refresh_info 
-- WHERE matviewname IN ('holdings_view', 'portfolio_summary_view', 'asset_allocation_view', 'sector_allocation_view');

-- Para setup de cron job (executar refresh a cada 5 minutos):
-- SELECT cron.schedule('refresh-portfolio-views', '*/5 * * * *', 'SELECT refresh_portfolio_views()');

-- Para remover cron job:
-- SELECT cron.unschedule('refresh-portfolio-views');

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================

-- 1. PERFORMANCE:
--    - Views materializadas são MUITO mais rápidas que views normais
--    - Trade-off: dados podem estar alguns minutos desatualizados
--    - Refresh concorrente permite leitura durante atualização

-- 2. REFRESH STRATEGY:
--    - Opção 1: Cron job a cada 5-15 minutos (recomendado para produção)
--    - Opção 2: Trigger-based refresh (para dados em tempo real, mais caro)
--    - Opção 3: On-demand refresh via API call

-- 3. DISCO:
--    - Views materializadas ocupam espaço em disco
--    - Monitorar crescimento e fazer VACUUM periódico
--    - Estimado: 1-5 MB por 1000 holdings

-- 4. MEMORIA:
--    - Refresh concorrente usa memória temporária
--    - Para bancos grandes (>100k holdings), aumentar work_mem

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
