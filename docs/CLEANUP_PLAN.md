# 🧹 Plano de Limpeza de Arquivos

**Data:** 2025-02-01  
**Status:** Em execução

---

## 📋 Itens Identificados para Limpeza

### 1. ✅ Arquivos Deprecated
- `Deprecated/lib-api-plans.ts` - Não está sendo usado (verificado)
  - **Ação:** Manter na pasta Deprecated como referência histórica
  - **Status:** OK - não precisa remover

### 2. 📚 Documentação Duplicada/Obsoleta

#### Documentação de Migração (Consolidar)
- `MIGRATION_STATUS.md` - Status intermediário
- `MIGRATION_SUCCESS.md` - Status de sucesso
- `MIGRATION_100_PERCENT.md` - Status 100%
- `MIGRATION_COMPLETE.md` - Migração completa
- `MIGRATION_CHECKLIST.md` - Checklist (pode estar obsoleto)
- `TO_100_PERCENT.md` - Tarefas para 100%
- `REMAINING_TASKS.md` - Tarefas restantes

**Ação:** Consolidar em um único arquivo `MIGRATION_HISTORY.md` ou arquivar

#### Documentação Obsoleta
- `TABELAS_NAO_UTILIZADAS.md` - Já foi resolvido (tabela removida)
- `HOUSEHOLD_MIGRATION_REMAINING_TASKS.md` - Pode estar obsoleto
- `HOUSEHOLD_MEMBERS_INCONSISTENCIES.md` - Pode estar resolvido

**Ação:** Mover para arquivo de histórico ou remover

### 3. 📄 Arquivos SQL na Pasta docs
- `20251115_add_performance_indexes.sql`
- `20251115_clean_invalid_data.sql`
- `20251115_create_materialized_views.sql`

**Ação:** Verificar se já foram executados. Se sim, mover para `docs/archive/` ou remover.

---

## 🎯 Ações Recomendadas

### Fase 1: Consolidar Documentação de Migração
1. Criar `docs/MIGRATION_HISTORY.md` com resumo consolidado
2. Mover docs antigos para `docs/archive/` ou remover

### Fase 2: Limpar Documentação Obsoleta
1. Verificar se problemas foram resolvidos
2. Mover para `docs/archive/` ou remover

### Fase 3: Organizar Arquivos SQL
1. Verificar se SQLs foram executados
2. Se sim, mover para `docs/archive/` ou `supabase/migrations/` (se apropriado)

---

## ⚠️ Cuidados

- Não remover documentação que ainda é referenciada
- Manter histórico importante
- Fazer backup antes de remover arquivos

