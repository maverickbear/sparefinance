# Inconsistências Encontradas no Documento SCHEMA_TABELAS_E_RELACOES.md

Este documento lista todas as inconsistências encontradas ao comparar o documento de schema com o schema real do banco de dados.

## 1. Views Materializadas Faltando

### ❌ `asset_allocation_view` não mencionada
**Problema:** O documento menciona apenas 3 views materializadas, mas existe uma 4ª view:
- `holdings_view` ✅ (mencionada)
- `portfolio_summary_view` ✅ (mencionada)
- `sector_allocation_view` ✅ (mencionada)
- `asset_allocation_view` ❌ (NÃO mencionada)

**Descrição da view faltante:**
- **asset_allocation_view**: Distribuição de portfolio por tipo de ativo (Stock, ETF, etc.)

**Correção necessária:** Adicionar na seção "Notas Importantes" ou criar uma seção específica para views.

---

## 2. View Normal Faltando

### ❌ `vw_transactions_for_reports` não mencionada
**Problema:** Existe uma view normal (não materializada) que não está documentada.

**Descrição:**
- **vw_transactions_for_reports**: View que retorna transações excluindo transferências. Usada para cálculos de receita/despesa evitando dupla contagem de transferências.

**Correção necessária:** Adicionar na seção de views ou criar uma seção específica.

---

## 3. Campos Faltando na Tabela Transaction

### ❌ `suggestedCategoryId` e `suggestedSubcategoryId` não mencionados
**Problema:** A tabela Transaction possui dois campos importantes que não estão listados nos "Campos principais":

**Campos faltantes:**
- `suggestedCategoryId`: Categoria sugerida pelo sistema (aprendizado de máquina)
- `suggestedSubcategoryId`: Subcategoria sugerida pelo sistema

**Relações faltantes:**
- Transaction → Category (via `suggestedCategoryId`)
- Transaction → Subcategory (via `suggestedSubcategoryId`)

**Correção necessária:** 
- Adicionar os campos na seção de campos principais da Transaction
- Adicionar as relações na seção de relações da Transaction

---

## 4. Relações Faltando na Transaction

### ❌ Relações com Category e Subcategory via campos "suggested"
**Problema:** O documento menciona que Transaction pode ter Category e Subcategory, mas não menciona que também pode ter categorias/subcategorias **sugeridas**.

**Relações faltantes:**
- Transaction → Category (via `suggestedCategoryId`) - opcional
- Transaction → Subcategory (via `suggestedSubcategoryId`) - opcional

**Correção necessária:** Atualizar a seção de relações da Transaction para incluir:
```
- **Pode ter:** Category (categoryId), Subcategory (subcategoryId)
- **Pode ter (sugeridas):** Category (suggestedCategoryId), Subcategory (suggestedSubcategoryId)
```

---

## 5. Clarificação Necessária: InvestmentTransaction

### ⚠️ Relação com Account vs InvestmentAccount
**Problema:** O documento diz que InvestmentTransaction pertence a Account, o que está tecnicamente correto (há uma FK para Account), mas pode ser confuso porque:

1. InvestmentTransaction tem `accountId` que referencia `Account.id`
2. Mas na prática, InvestmentTransactions são usadas com contas do tipo 'investment'
3. InvestmentAccount também referencia Account, mas é uma tabela separada

**Observação:** Isso não é exatamente uma inconsistência, mas poderia ser mais claro. A relação está correta, mas a explicação poderia mencionar que InvestmentTransactions são usadas com Accounts do tipo 'investment'.

---

## 6. Clarificação Necessária: Budget

### ⚠️ Relação com Category e Subcategory
**Problema:** O documento diz que Budget "pode ter" Category e Subcategory, mas não deixa claro que:
- Um Budget pode ter `categoryId` OU `subcategoryId`, mas não ambos simultaneamente
- Além disso, existe a tabela `BudgetCategory` que cria uma relação muitos-para-muitos entre Budget e Category

**Correção sugerida:** Esclarecer que:
- Budget pode ter `categoryId` (opcional) OU `subcategoryId` (opcional), mas não ambos
- Budget também pode ter múltiplas Categories através da tabela `BudgetCategory` (relação muitos-para-muitos)

---

## 7. Primary Keys Não Mencionadas

### ⚠️ Informação útil faltando
**Problema:** O documento não menciona as primary keys das tabelas, o que pode ser útil para entender a estrutura.

**Observação:** Isso não é uma inconsistência crítica, mas seria uma informação útil para desenvolvedores.

---

## 8. Campos Adicionais que Poderiam Ser Mencionados

### ⚠️ Alguns campos importantes podem estar faltando

**Transaction:**
- `tags`: Tags da transação (mencionado no schema, mas não nos campos principais)
- `plaidMetadata`: Metadados do Plaid (mencionado no schema, mas não nos campos principais)

**Account:**
- `plaidItemId`: ID do item no Plaid (mencionado, mas poderia ter mais detalhes)

**InvestmentAccount:**
- `balanceLastUpdatedAt`: Última atualização do saldo (mencionado, mas poderia estar nos campos principais)

---

## 9. Diagrama de Relações - Melhorias Sugeridas

### ⚠️ Diagrama poderia ser mais completo
**Problema:** O diagrama não mostra todas as relações, especialmente:
- Relações de Transaction com Category/Subcategory sugeridas
- Relação de InvestmentTransaction com Account (que é diferente de InvestmentAccount)
- View `vw_transactions_for_reports`

**Sugestão:** Adicionar uma nota ou expandir o diagrama para incluir essas relações.

---

## Resumo das Correções Necessárias

### Críticas (devem ser corrigidas):
1. ✅ Adicionar `asset_allocation_view` na lista de views materializadas
2. ✅ Adicionar `vw_transactions_for_reports` na lista de views
3. ✅ Adicionar `suggestedCategoryId` e `suggestedSubcategoryId` nos campos principais de Transaction
4. ✅ Adicionar relações de Transaction com Category/Subcategory via campos "suggested"

### Importantes (recomendadas):
5. ⚠️ Esclarecer relação de InvestmentTransaction com Account vs InvestmentAccount
6. ⚠️ Esclarecer relação de Budget com Category/Subcategory (OU vs E)
7. ⚠️ Adicionar campos adicionais importantes (tags, plaidMetadata, etc.)

### Opcionais (melhorias):
8. 💡 Mencionar primary keys das tabelas
9. 💡 Expandir diagrama de relações

---

**Data da análise:** Janeiro 2025
**Baseado em:** Comparação entre `docs/SCHEMA_TABELAS_E_RELACOES.md` e `supabase/schema_reference.sql`

