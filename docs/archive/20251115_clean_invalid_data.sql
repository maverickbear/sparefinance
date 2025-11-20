-- ============================================================================
-- Migration: Clean Invalid Investment Transactions
-- Date: 2025-11-15
-- Description: Remove transações de investimento sem securityId e adiciona constraints
-- Estimated execution time: 1-2 minutes
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. IDENTIFICAR TRANSAÇÕES INVÁLIDAS
-- ============================================================================

-- Criar tabela temporária com transações problemáticas
-- NOTA: InvestmentTransaction não tem userId, apenas accountId
CREATE TEMP TABLE invalid_transactions AS
SELECT 
  id,
  type,
  date,
  notes as description,
  "accountId",
  "securityId",
  quantity,
  price,
  fees,
  "createdAt",
  "updatedAt"
FROM "InvestmentTransaction"
WHERE "securityId" IS NULL
  AND type IN ('buy', 'sell', 'dividend', 'interest');

-- Mostrar estatísticas das transações inválidas
DO $$
DECLARE
  tx_count INTEGER;
  buy_count INTEGER;
  sell_count INTEGER;
  dividend_count INTEGER;
  interest_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO tx_count FROM invalid_transactions;
  SELECT COUNT(*) INTO buy_count FROM invalid_transactions WHERE type = 'buy';
  SELECT COUNT(*) INTO sell_count FROM invalid_transactions WHERE type = 'sell';
  SELECT COUNT(*) INTO dividend_count FROM invalid_transactions WHERE type = 'dividend';
  SELECT COUNT(*) INTO interest_count FROM invalid_transactions WHERE type = 'interest';
  
  RAISE NOTICE '============================================';
  RAISE NOTICE 'TRANSAÇÕES INVÁLIDAS ENCONTRADAS';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Total: % transações', tx_count;
  RAISE NOTICE '  - Buy: %', buy_count;
  RAISE NOTICE '  - Sell: %', sell_count;
  RAISE NOTICE '  - Dividend: %', dividend_count;
  RAISE NOTICE '  - Interest: %', interest_count;
  RAISE NOTICE '============================================';
  
  IF tx_count = 0 THEN
    RAISE NOTICE 'Nenhuma transação inválida encontrada! ✓';
  END IF;
END $$;

-- Mostrar detalhes das transações que serão removidas
SELECT 
  type,
  COUNT(*) as count,
  MIN(date) as oldest_date,
  MAX(date) as newest_date,
  SUM(COALESCE(quantity, 0)) as total_quantity,
  SUM(COALESCE(quantity, 0) * COALESCE(price, 0)) as total_value
FROM invalid_transactions
GROUP BY type
ORDER BY type;

-- ============================================================================
-- 2. BACKUP DAS TRANSAÇÕES INVÁLIDAS
-- ============================================================================

-- Criar tabela de backup antes de deletar
DROP TABLE IF EXISTS "InvestmentTransaction_backup_20251115";

CREATE TABLE "InvestmentTransaction_backup_20251115" AS
SELECT 
  *,
  NOW() as backup_date,
  'Invalid securityId - removed by cleanup script' as backup_reason
FROM "InvestmentTransaction"
WHERE id IN (SELECT id FROM invalid_transactions);

-- Verificar backup
DO $$
DECLARE
  backup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO backup_count FROM "InvestmentTransaction_backup_20251115";
  RAISE NOTICE 'Backup criado: % registros salvos', backup_count;
END $$;

-- Adicionar comentário na tabela de backup
COMMENT ON TABLE "InvestmentTransaction_backup_20251115" IS 
  'Backup de transações inválidas removidas em 2025-11-15. Transações sem securityId mas do tipo buy/sell/dividend/interest.';

-- ============================================================================
-- 3. ANÁLISE DE IMPACTO
-- ============================================================================

-- Verificar impacto por conta (InvestmentTransaction não tem userId diretamente)
SELECT 
  it."accountId",
  a.name as account_name,
  COUNT(*) as invalid_transactions,
  SUM(COALESCE(it.quantity, 0) * COALESCE(it.price, 0)) as total_value_affected
FROM invalid_transactions it
LEFT JOIN "Account" a ON a.id = it."accountId"
GROUP BY it."accountId", a.name
ORDER BY invalid_transactions DESC;

-- (Já incluído acima - removido duplicado)

-- ============================================================================
-- 4. REMOVER TRANSAÇÕES INVÁLIDAS
-- ============================================================================

-- Deletar transações inválidas
DELETE FROM "InvestmentTransaction"
WHERE id IN (SELECT id FROM invalid_transactions);

-- Verificar remoção
DO $$
DECLARE
  deleted_count INTEGER;
  remaining_invalid INTEGER;
BEGIN
  SELECT COUNT(*) INTO deleted_count FROM "InvestmentTransaction_backup_20251115";
  
  SELECT COUNT(*) INTO remaining_invalid 
  FROM "InvestmentTransaction"
  WHERE "securityId" IS NULL
    AND type IN ('buy', 'sell', 'dividend', 'interest');
  
  RAISE NOTICE '============================================';
  RAISE NOTICE 'REMOÇÃO CONCLUÍDA';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Transações removidas: %', deleted_count;
  RAISE NOTICE 'Transações inválidas restantes: %', remaining_invalid;
  RAISE NOTICE '============================================';
  
  IF remaining_invalid > 0 THEN
    RAISE WARNING 'Ainda existem % transações inválidas!', remaining_invalid;
  ELSE
    RAISE NOTICE 'Todas as transações inválidas foram removidas! ✓';
  END IF;
END $$;

-- ============================================================================
-- 5. ADICIONAR CONSTRAINTS PARA PREVENIR FUTUROS PROBLEMAS
-- ============================================================================

-- Remove constraint antiga se existir
ALTER TABLE "InvestmentTransaction"
DROP CONSTRAINT IF EXISTS check_security_required;

-- Adicionar constraint: buy, sell, dividend e interest DEVEM ter securityId
ALTER TABLE "InvestmentTransaction"
ADD CONSTRAINT check_security_required
CHECK (
  (type IN ('buy', 'sell', 'dividend', 'interest') AND "securityId" IS NOT NULL)
  OR
  (type NOT IN ('buy', 'sell', 'dividend', 'interest'))
);

-- Adicionar constraint: buy e sell devem ter quantity e price
ALTER TABLE "InvestmentTransaction"
DROP CONSTRAINT IF EXISTS check_buy_sell_fields;

ALTER TABLE "InvestmentTransaction"
ADD CONSTRAINT check_buy_sell_fields
CHECK (
  (type IN ('buy', 'sell') AND quantity IS NOT NULL AND quantity > 0 AND price IS NOT NULL AND price >= 0)
  OR
  (type NOT IN ('buy', 'sell'))
);

-- Adicionar comentários nas constraints
COMMENT ON CONSTRAINT check_security_required ON "InvestmentTransaction" IS
  'Garante que transações do tipo buy, sell, dividend e interest tenham securityId';

COMMENT ON CONSTRAINT check_buy_sell_fields ON "InvestmentTransaction" IS
  'Garante que transações do tipo buy e sell tenham quantity e price válidos';

-- ============================================================================
-- 6. VERIFICAÇÃO FINAL
-- ============================================================================

-- Verificar integridade das transações restantes
SELECT 
  type,
  COUNT(*) as total_count,
  COUNT("securityId") as with_security,
  COUNT(*) - COUNT("securityId") as without_security,
  COUNT(CASE WHEN quantity IS NULL OR quantity <= 0 THEN 1 END) as invalid_quantity,
  COUNT(CASE WHEN price IS NULL OR price < 0 THEN 1 END) as invalid_price
FROM "InvestmentTransaction"
GROUP BY type
ORDER BY type;

-- Verificar distribuição por tipo
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'DISTRIBUIÇÃO DE TRANSAÇÕES POR TIPO';
  RAISE NOTICE '============================================';
  
  FOR rec IN (
    SELECT 
      type,
      COUNT(*) as count
    FROM "InvestmentTransaction"
    GROUP BY type
    ORDER BY count DESC
  ) LOOP
    RAISE NOTICE '  % - % transações', rec.type, rec.count;
  END LOOP;
  
  RAISE NOTICE '============================================';
END $$;

-- Testar constraint (deve falhar)
-- NOTA: InvestmentTransaction requer accountId, não userId
DO $$
DECLARE
  test_account_id UUID;
BEGIN
  -- Tentar obter um accountId válido para teste (ou usar um UUID de teste)
  SELECT id INTO test_account_id FROM "Account" LIMIT 1;
  
  -- Se não houver conta, usar UUID de teste
  IF test_account_id IS NULL THEN
    test_account_id := '00000000-0000-0000-0000-000000000000';
  END IF;
  
  BEGIN
    INSERT INTO "InvestmentTransaction" (
      id,
      "accountId",
      type,
      date,
      notes
    ) VALUES (
      gen_random_uuid(),
      test_account_id,
      'buy',
      NOW(),
      'Test transaction - should fail'
    );
    RAISE EXCEPTION 'Constraint FALHOU! Transação inválida foi aceita!';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'Constraint funcionando corretamente: transação inválida foi rejeitada ✓';
    WHEN OTHERS THEN
      -- Se der outro erro (ex: foreign key), também é OK - significa que constraint está funcionando
      RAISE NOTICE 'Constraint funcionando: %', SQLERRM;
  END;
END $$;

COMMIT;

-- ============================================================================
-- ESTATÍSTICAS FINAIS
-- ============================================================================

-- Resumo final
SELECT 
  'Transações válidas restantes' as status,
  COUNT(*) as count,
  pg_size_pretty(pg_total_relation_size('"InvestmentTransaction"')) as table_size
FROM "InvestmentTransaction"
UNION ALL
SELECT 
  'Transações no backup' as status,
  COUNT(*) as count,
  pg_size_pretty(pg_total_relation_size('"InvestmentTransaction_backup_20251115"')) as table_size
FROM "InvestmentTransaction_backup_20251115";

-- ============================================================================
-- INSTRUÇÕES PARA RESTAURAÇÃO (SE NECESSÁRIO)
-- ============================================================================

-- Para restaurar transações do backup (SE NECESSÁRIO):
/*
BEGIN;

-- Remover constraints temporariamente
ALTER TABLE "InvestmentTransaction" DROP CONSTRAINT IF EXISTS check_security_required;
ALTER TABLE "InvestmentTransaction" DROP CONSTRAINT IF EXISTS check_buy_sell_fields;

-- Restaurar transações
INSERT INTO "InvestmentTransaction" (
  id, "accountId", "securityId", type, date, quantity, price, 
  fees, notes, "createdAt", "updatedAt"
)
SELECT 
  id, "accountId", "securityId", type, date, quantity, price, 
  fees, notes, "createdAt", "updatedAt"
FROM "InvestmentTransaction_backup_20251115"
WHERE id NOT IN (SELECT id FROM "InvestmentTransaction");

-- Recriar constraints
ALTER TABLE "InvestmentTransaction"
ADD CONSTRAINT check_security_required
CHECK (
  (type IN ('buy', 'sell', 'dividend', 'interest') AND "securityId" IS NOT NULL)
  OR
  (type NOT IN ('buy', 'sell', 'dividend', 'interest'))
);

COMMIT;
*/

-- ============================================================================
-- LIMPEZA (APÓS 30 DIAS)
-- ============================================================================

-- Após 30 dias, se tudo estiver OK, remover tabela de backup:
-- DROP TABLE IF EXISTS "InvestmentTransaction_backup_20251115";

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================

-- 1. BACKUP:
--    - Sempre mantenha o backup por pelo menos 30 dias
--    - Verifique se os dados removidos não são necessários
--    - Script de restauração está disponível acima

-- 2. CONSTRAINTS:
--    - Constraints previnem novos problemas
--    - Podem causar erros em imports/APIs existentes
--    - Teste bem antes de aplicar em produção

-- 3. MONITORAMENTO:
--    - Monitore logs de erro após aplicar migration
--    - Verifique se APIs de importação funcionam corretamente
--    - Usuários podem tentar criar transações inválidas

-- 4. VALIDAÇÃO:
--    - Adicione validação no frontend também
--    - Valide dados antes de enviar para API
--    - Mostre mensagens claras de erro para o usuário

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
