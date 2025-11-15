# 🚀 Migration Application Guide

## 📋 Overview

Este guia fornece instruções detalhadas para aplicar as migrations de otimização do Spare Finance de forma segura.

**Migrations**:
1. `20241116000000_fix_critical_database_issues.sql` - Correções críticas + índices básicos
2. `20241116100000_add_performance_indexes.sql` - Índices adicionais de performance

**Tempo Estimado**: 5-30 minutos (depende do volume de dados)  
**Downtime**: Opcional (recomendado para segurança)

---

## ⚠️ PRÉ-REQUISITOS

### 1. Backup Completo

```bash
# Local Development (Docker)
docker exec spare_finance-db-1 pg_dump -U postgres -d spare_finance > backup_$(date +%Y%m%d_%H%M%S).sql

# Supabase Production
# Via Dashboard: Database > Backups > Create Backup
# Via CLI:
supabase db dump -f backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Verificar Conexões Ativas

```sql
-- Ver conexões ativas
SELECT 
  pid,
  usename,
  application_name,
  client_addr,
  state,
  query_start
FROM pg_stat_activity
WHERE datname = 'spare_finance'
AND state <> 'idle';
```

### 3. Preparar Ambiente

```bash
# Clonar projeto (se não tiver)
git clone <repo-url>
cd spare_finance

# Checkout para branch correta
git checkout main
git pull origin main

# Verificar arquivos de migration
ls -la supabase/migrations/
ls -la scripts/
```

---

## 📝 PASSO 1: Validação Pré-Migration

Execute o script de validação para identificar possíveis problemas:

```bash
# Local Development (Docker)
docker exec -i spare_finance-db-1 psql -U postgres -d spare_finance < scripts/validate-before-migration.sql

# Supabase Local
supabase db execute < scripts/validate-before-migration.sql

# Supabase Production (via psql)
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" < scripts/validate-before-migration.sql
```

### ✅ Checklist de Validação

Verifique se o output mostra:

- [ ] **NULL userId Check**: 0 registros com userId NULL
- [ ] **Orphaned FKs**: 0 referências órfãs
- [ ] **Table Sizes**: Verificar se é razoável
- [ ] **Existing Indexes**: Confirmar índices atuais
- [ ] **RLS Policies**: Confirmar que existem policies

### 🔴 Se Encontrar Problemas

#### Problema 1: Registros com userId NULL

```sql
-- Opção A: Deletar registros órfãos (dados de teste)
DELETE FROM "InvestmentAccount" WHERE "userId" IS NULL;
DELETE FROM "Budget" WHERE "userId" IS NULL;
DELETE FROM "Debt" WHERE "userId" IS NULL;
DELETE FROM "Goal" WHERE "userId" IS NULL;

-- Opção B: Atribuir a um userId válido
-- Primeiro, encontre um userId válido:
SELECT "id" FROM "User" LIMIT 1;

-- Depois, atualize:
UPDATE "InvestmentAccount" SET "userId" = '<valid-user-id>' WHERE "userId" IS NULL;
-- Repita para outras tabelas
```

#### Problema 2: Foreign Keys Órfãs

```sql
-- Deletar transações com accountId inválido
DELETE FROM "Transaction" t
WHERE NOT EXISTS (
  SELECT 1 FROM "Account" a WHERE a."id" = t."accountId"
);

-- Repetir para outras tabelas conforme necessário
```

---

## 🚀 PASSO 2: Aplicar Migrations

### Opção A: Local Development (Docker)

```bash
# Migration 1: Correções Críticas
docker exec -i spare_finance-db-1 psql -U postgres -d spare_finance < supabase/migrations/20241116000000_fix_critical_database_issues.sql

# Verificar se aplicou sem erros
echo $?  # Deve ser 0

# Migration 2: Índices de Performance
docker exec -i spare_finance-db-1 psql -U postgres -d spare_finance < supabase/migrations/20241116100000_add_performance_indexes.sql

# Verificar novamente
echo $?  # Deve ser 0
```

### Opção B: Supabase Local

```bash
# Supabase CLI aplica migrations automaticamente
supabase db reset  # ⚠️ APENAS EM DEV - apaga todos os dados!

# Ou aplicar manualmente:
supabase db execute < supabase/migrations/20241116000000_fix_critical_database_issues.sql
supabase db execute < supabase/migrations/20241116100000_add_performance_indexes.sql
```

### Opção C: Supabase Production

```bash
# Método 1: Via Dashboard
# 1. Database > Migrations
# 2. Upload migration files
# 3. Review & Apply

# Método 2: Via CLI
supabase db push

# Método 3: Via psql direto
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" < supabase/migrations/20241116000000_fix_critical_database_issues.sql
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" < supabase/migrations/20241116100000_add_performance_indexes.sql
```

### 🔍 Monitorar Durante Aplicação

Em outro terminal, monitore o progresso:

```sql
-- Ver queries em execução
SELECT 
  pid,
  now() - query_start as duration,
  state,
  query
FROM pg_stat_activity
WHERE state <> 'idle'
ORDER BY duration DESC;

-- Ver locks
SELECT 
  l.locktype,
  l.mode,
  l.granted,
  r.relname,
  a.query
FROM pg_locks l
JOIN pg_stat_activity a ON a.pid = l.pid
LEFT JOIN pg_class r ON r.oid = l.relation
WHERE NOT l.granted
ORDER BY l.locktype;
```

---

## ✅ PASSO 3: Verificação Pós-Migration

Execute o script de verificação:

```bash
# Local Development (Docker)
docker exec -i spare_finance-db-1 psql -U postgres -d spare_finance < scripts/verify-migration-success.sql

# Supabase
supabase db execute < scripts/verify-migration-success.sql
```

### ✅ Checklist de Verificação

- [ ] **NOT NULL Constraints**: Todas as colunas userId estão NOT NULL
- [ ] **CHECK Constraints**: budget_amount_positive, goal_targetamount_positive, debt_initialamount_positive criados
- [ ] **Indexes**: Todos os índices listados foram criados
- [ ] **FK Renames**: Group_userId_fkey e Budget_macroId_fkey renomeados
- [ ] **Query Performance**: EXPLAIN ANALYZE mostra uso dos índices
- [ ] **Data Integrity**: 0 registros com userId NULL

---

## 🧪 PASSO 4: Testes de Aplicação

Execute testes para garantir que a aplicação funciona:

```bash
# Type check
npm run type-check

# Unit tests
npm run test

# Build (para verificar se compila)
npm run build

# Start development server
npm run dev

# Testar fluxos principais:
# 1. Login/Signup
# 2. Dashboard load
# 3. Create transaction
# 4. Create budget
# 5. View reports
```

### 🔍 Verificar Logs

```bash
# Supabase logs (se usando Supabase)
supabase functions logs

# Application logs
tail -f logs/app.log  # ou onde seus logs são salvos

# Postgres logs (local)
docker logs spare_finance-db-1 --tail 100 -f
```

---

## 📊 PASSO 5: Monitoramento Pós-Deploy

### Primeiras 24 Horas

#### 1. Query Performance

```sql
-- Verificar queries lentas
SELECT 
  query,
  calls,
  mean_time,
  max_time,
  stddev_time
FROM pg_stat_statements
WHERE mean_time > 50
ORDER BY mean_time DESC
LIMIT 20;
```

#### 2. Index Usage

```sql
-- Verificar uso dos novos índices
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY idx_scan DESC;
```

#### 3. Cache Hit Rate

```sql
-- Deve ser > 95%
SELECT 
  sum(heap_blks_read) as heap_read,
  sum(heap_blks_hit)  as heap_hit,
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as cache_hit_ratio
FROM pg_statio_user_tables;
```

#### 4. Table Bloat

```sql
-- Verificar se precisa VACUUM
SELECT 
  schemaname,
  tablename,
  n_live_tup,
  n_dead_tup,
  ROUND(100 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_pct
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_dead_tup DESC;

-- Se dead_pct > 10%, executar:
-- VACUUM ANALYZE "Transaction";
```

### Primeira Semana

- [ ] Verificar erros no Sentry (se configurado)
- [ ] Revisar métricas de performance
- [ ] Coletar feedback de usuários
- [ ] Verificar custos de infraestrutura
- [ ] Documentar lições aprendidas

---

## 🔄 ROLLBACK (Se Necessário)

### Quando Fazer Rollback?

- ❌ Erros críticos impedindo uso da aplicação
- ❌ Degradação severa de performance (>50%)
- ❌ Perda de dados detectada
- ❌ Bugs bloqueadores não resolvidos em 2h

### Como Fazer Rollback

#### 1. Restaurar do Backup

```bash
# Local Development (Docker)
docker exec -i spare_finance-db-1 psql -U postgres -d spare_finance < backup_YYYYMMDD_HHMMSS.sql

# Supabase
# Via Dashboard: Database > Backups > Restore
```

#### 2. Rollback Manual (Se Backup Não Disponível)

```sql
-- Remover constraints
ALTER TABLE "InvestmentAccount" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Budget" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Debt" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Goal" ALTER COLUMN "userId" DROP NOT NULL;

-- Reverter renames de FK
ALTER TABLE "Group" RENAME CONSTRAINT "Group_userId_fkey" TO "Macro_userId_fkey";
ALTER TABLE "Budget" RENAME CONSTRAINT "Budget_macroId_fkey" TO "Budget_groupId_fkey";

-- Remover CHECK constraints
ALTER TABLE "Budget" DROP CONSTRAINT IF EXISTS "budget_amount_positive";
ALTER TABLE "Goal" DROP CONSTRAINT IF EXISTS "goal_targetamount_positive";
ALTER TABLE "Debt" DROP CONSTRAINT IF EXISTS "debt_initialamount_positive";

-- Remover índices (opcional - não causam problemas)
DROP INDEX IF EXISTS "idx_transaction_date";
DROP INDEX IF EXISTS "idx_transaction_userid_date";
-- ... etc
```

#### 3. Reiniciar Aplicação

```bash
# Limpar cache Next.js
rm -rf .next

# Rebuild
npm run build

# Restart
pm2 restart spare-finance  # ou seu método de deploy
```

---

## 📈 Métricas de Sucesso

### Targets

| Métrica | Antes | Target | Como Medir |
|---------|-------|--------|------------|
| Dashboard Load | ~200ms | <50ms | Chrome DevTools Network |
| Transaction List | ~150ms | <30ms | API response time |
| Budget Progress | ~100ms | <20ms | API response time |
| Cache Hit Rate | ~80% | >95% | pg_stat_statements |
| P95 Query Time | ~500ms | <100ms | pg_stat_statements |
| Error Rate | - | <0.1% | Application logs |

### Como Medir

```typescript
// app/(protected)/dashboard/page.tsx
console.time('dashboard-load');
const data = await loadDashboardData(selectedDate);
console.timeEnd('dashboard-load');
```

```sql
-- Query performance
SELECT 
  'dashboard-load' as metric,
  mean_time as avg_ms,
  max_time as max_ms,
  calls as call_count
FROM pg_stat_statements
WHERE query LIKE '%loadDashboardData%'
LIMIT 1;
```

---

## 🆘 Troubleshooting

### Problema: Migration trava em "CREATE INDEX"

**Causa**: Tabela muito grande, criação de índice é lenta

**Solução**:
```sql
-- Criar índice concurrently (não bloqueia writes)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_transaction_date" 
  ON "Transaction" ("date" DESC);
```

### Problema: "column userId cannot be cast to NOT NULL"

**Causa**: Existem registros com userId NULL

**Solução**:
```sql
-- Identificar registros
SELECT COUNT(*) FROM "Budget" WHERE "userId" IS NULL;

-- Deletar ou atualizar
DELETE FROM "Budget" WHERE "userId" IS NULL;
-- OU
UPDATE "Budget" SET "userId" = '<valid-user-id>' WHERE "userId" IS NULL;

-- Tentar migration novamente
```

### Problema: "constraint already exists"

**Causa**: Migration já foi aplicada parcialmente

**Solução**: Usar `IF NOT EXISTS` ou `IF EXISTS` (já está nas migrations)

### Problema: Performance piorou após migration

**Causa**: Estatísticas desatualizadas

**Solução**:
```sql
ANALYZE "Transaction";
ANALYZE "Account";
ANALYZE "Budget";
ANALYZE "Goal";
ANALYZE "Debt";

-- Ou todas de uma vez:
VACUUM ANALYZE;
```

---

## 📚 Recursos

### Documentação
- [PostgreSQL Indexes](https://www.postgresql.org/docs/current/indexes.html)
- [Supabase Migrations](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [RLS Performance](https://supabase.com/docs/guides/database/postgres/row-level-security)

### Scripts Úteis
- `scripts/validate-before-migration.sql` - Validação pré-migration
- `scripts/verify-migration-success.sql` - Verificação pós-migration
- `docs/RLS_OPTIMIZATION_GUIDE.md` - Guia de otimização RLS
- `docs/GAPS_AND_NEXT_STEPS.md` - Próximos passos

### Suporte
- **Documentação**: `docs/` directory
- **Issues**: GitHub Issues
- **Logs**: Supabase Dashboard > Database > Logs

---

## ✅ Checklist Final

### Antes da Migration
- [ ] Backup completo realizado
- [ ] Script de validação executado
- [ ] Problemas identificados corrigidos
- [ ] Equipe notificada
- [ ] Maintenance window agendado (se necessário)

### Durante a Migration
- [ ] Migration 1 aplicada com sucesso
- [ ] Migration 2 aplicada com sucesso
- [ ] Sem erros no output
- [ ] Logs monitorados

### Depois da Migration
- [ ] Script de verificação executado
- [ ] Todos os checks passaram
- [ ] Aplicação testada
- [ ] Performance melhorou
- [ ] Nenhum erro nos logs

### Primeira Semana
- [ ] Métricas de performance coletadas
- [ ] Usuários não reportaram problemas
- [ ] Cache hit rate > 95%
- [ ] Query times dentro do target
- [ ] Documentação atualizada

---

**🎉 Parabéns!** Se chegou até aqui, a migration foi um sucesso!

*Última atualização: 16 de Novembro de 2024*

