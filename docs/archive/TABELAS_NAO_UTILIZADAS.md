# Análise de Tabelas Não Utilizadas

## 📋 Resumo Executivo

Após análise completa do schema e código da aplicação, identifiquei **1 tabela** que pode ser removida com segurança.

---

## 🗑️ Tabelas que Podem Ser Removidas

### 1. **BudgetSubcategory** ❌

**Status:** Não utilizada - pode ser removida

**Evidências:**
- O comentário no código (`lib/api/budgets.ts:411`) indica: *"Note: subcategoryId is now stored directly in Budget, not in BudgetSubcategory"*
- A tabela `Budget` agora armazena `subcategoryId` diretamente (coluna `subcategoryId` na tabela `Budget`)
- Não há inserções na tabela `BudgetSubcategory` no código atual
- Apenas há SELECTs para leitura (provavelmente para dados legados), mas não há criação de novos registros

**Impacto da Remoção:**
- ⚠️ **Atenção**: Verificar se há dados legados na tabela antes de remover
- ✅ Não há impacto funcional, pois a funcionalidade foi migrada para `Budget.subcategoryId`
- ✅ Pode remover as políticas RLS relacionadas
- ✅ Pode remover os índices relacionados

**Ação Recomendada:**
1. Verificar se há registros na tabela: `SELECT COUNT(*) FROM "BudgetSubcategory";`
2. Se houver dados legados, migrar para `Budget.subcategoryId` se necessário
3. Remover foreign keys, índices e políticas RLS
4. Remover a tabela

---

## ✅ Tabelas que ESTÃO sendo utilizadas (não remover)

### Tabelas de Questrade (Investimentos)
- **Candle** ✅ - Usada para armazenar dados históricos de preços do Questrade
- **Execution** ✅ - Usada para armazenar execuções de ordens do Questrade
- **Order** ✅ - Usada para armazenar ordens do Questrade
- **Position** ✅ - Usada para armazenar posições atuais do Questrade

### Tabelas de Budget
- **Budget** ✅ - Tabela principal de orçamentos
- **BudgetCategory** ✅ - Usada para relacionar budgets agrupados com múltiplas categorias

### Tabelas de Investimentos
- **AccountInvestmentValue** ✅ - Usada para armazenar valores de investimento de contas simples
- **SimpleInvestmentEntry** ✅ - Usada para entradas de investimentos simples

### Tabelas de Sincronização
- **TransactionSync** ✅ - Usada para rastrear sincronização de transações do Plaid

### Outras Tabelas
- Todas as outras tabelas do schema estão sendo utilizadas ativamente

---

## 📝 Notas Importantes

1. **BudgetSubcategory** foi substituída por `Budget.subcategoryId` diretamente
2. A migração já foi feita no código, mas a tabela ainda existe no schema
3. Recomenda-se verificar dados legados antes de remover completamente

---

## 🔍 Como Verificar Dados Legados

Execute estas queries antes de remover:

```sql
-- Verificar se há registros em BudgetSubcategory
SELECT COUNT(*) FROM "BudgetSubcategory";

-- Verificar se há budgets com subcategoryId mas sem BudgetSubcategory correspondente
SELECT b.id, b."subcategoryId", bs.id as budget_subcategory_id
FROM "Budget" b
LEFT JOIN "BudgetSubcategory" bs ON bs."budgetId" = b.id
WHERE b."subcategoryId" IS NOT NULL;
```

---

## 📅 Data da Análise

Análise realizada em: 2025-01-XX
Schema analisado: `supabase/schema_reference.sql`
Código analisado: Todo o repositório

