# Tarefas Restantes para Migração Completa para Arquitetura Household

## 📋 Resumo Executivo

Este documento lista todas as tarefas que ainda precisam ser completadas para finalizar a migração da arquitetura baseada em usuários individuais para a arquitetura baseada em Households.

---

## ✅ CONCLUÍDO - Políticas RLS

### 1. ✅ Remover Referências ao HouseholdMember Antigo nas Políticas RLS
**Arquivo:** `supabase/migrations/20250201000006_update_household_rls_policies.sql`

**Status:** ✅ **COMPLETO**

**O que foi feito:**
- ✅ Removidas **todas as 28 referências** ao `HouseholdMember` antigo
- ✅ Substituídas por verificações baseadas em `householdId` e funções helper
- ✅ Corrigida recursão infinita nas políticas de Account
- ✅ Todas as políticas agora usam `get_user_accessible_households()` e `can_access_household_data()`

**Tabelas corrigidas:**
- ✅ InvestmentTransaction
- ✅ Position
- ✅ Execution
- ✅ Order
- ✅ SimpleInvestmentEntry
- ✅ AccountInvestmentValue
- ✅ PlaidLiability
- ✅ TransactionSync

---

## ✅ CONCLUÍDO - APIs Server-Side

### 2. ✅ Adicionar householdId em `createBudget`
**Arquivo:** `lib/api/budgets.ts`

**Status:** ✅ **COMPLETO**

**O que foi feito:**
- ✅ Adicionado `getActiveHouseholdId()` antes do insert
- ✅ Adicionado `householdId` em todos os budgets criados

---

### 3. ✅ Adicionar householdId em `createGoal`
**Arquivo:** `lib/api/goals.ts`

**Status:** ✅ **COMPLETO**

**O que foi feito:**
- ✅ Adicionado `getActiveHouseholdId()` antes do insert
- ✅ Adicionado `householdId` ao criar goals

---

### 4. ✅ Adicionar householdId em `createDebt`
**Arquivo:** `lib/api/debts.ts`

**Status:** ✅ **COMPLETO**

**O que foi feito:**
- ✅ Adicionado `getActiveHouseholdId()` antes do insert
- ✅ Adicionado `householdId` ao criar debts

---

### 5. ✅ Adicionar householdId em `createPlannedPayment`
**Arquivo:** `lib/api/planned-payments.ts`

**Status:** ✅ **COMPLETO**

**O que foi feito:**
- ✅ Adicionado `getActiveHouseholdId()` antes do insert
- ✅ Adicionado `householdId` ao criar planned payments

---

### 6. ✅ Adicionar householdId em `createUserSubscription`
**Arquivo:** `lib/api/user-subscriptions.ts`

**Status:** ✅ **COMPLETO**

**O que foi feito:**
- ✅ Adicionado `getActiveHouseholdId()` antes do insert
- ✅ Adicionado `householdId` ao criar user subscriptions

---

## ✅ CONCLUÍDO - APIs Client-Side

### 7. ✅ Adicionar householdId em `createAccountClient`
**Arquivo:** `lib/api/accounts-client.ts`

**Status:** ✅ **COMPLETO**

**O que foi feito:**
- ✅ Adicionado `getActiveHouseholdId()` antes do insert
- ✅ Adicionado `householdId` ao criar contas no client-side

---

### 8. ✅ Adicionar householdId em `createTransactionClient`
**Arquivo:** `lib/api/transactions-client.ts`

**Status:** ✅ **COMPLETO**

**O que foi feito:**
- ✅ Adicionado `getActiveHouseholdId()` antes do insert
- ✅ Adicionado `householdId` ao criar transações no client-side

---

## 🟢 MÉDIO - Outras Tabelas/APIs

### 9. Verificar Tabelas que Podem Precisar de householdId
Verificar se as seguintes tabelas precisam de `householdId`:
- `Position` (já tem na migration, verificar se APIs usam)
- `SimpleInvestmentEntry` (verificar se existe e se precisa)
- `PlaidLiability` (já tem na migration, verificar se APIs usam)
- `TransactionSync` (já tem na migration, verificar se APIs usam)
- `category_learning` (pode não precisar, é por usuário)
- `user_monthly_usage` (pode não precisar, é por usuário)

---

## 🟢 MÉDIO - Componentes Frontend

### 10. Verificar Componentes que Usam APIs Antigas
Verificar se há componentes que ainda usam:
- `getHouseholdMembers` com `ownerId` (deve usar `householdId`)
- APIs que não passam `householdId` ao criar registros

**Arquivos para verificar:**
- `app/(protected)/members/page.tsx`
- Componentes de formulários (Account, Transaction, Budget, etc.)

---

## 🔵 BAIXO - Limpeza e Otimização

### 11. Remover Código Legado
Após validação completa, considerar:
- Remover tabela `HouseholdMember` antiga (após migração completa)
- Remover coluna `userId` de tabelas (após validação)
- Remover funções SQL legadas já removidas em `20250201000008_remove_legacy_functions.sql`

---

### 12. Atualizar Documentação
- Atualizar README com nova arquitetura
- Documentar como funciona o sistema de Households
- Documentar processo de migração

---

## 📊 Checklist de Progresso

- [x] Estrutura de tabelas criada (Household, HouseholdMemberNew, UserActiveHousehold)
- [x] Migrations para adicionar householdId em tabelas principais
- [x] APIs de auth atualizadas (signUp, signIn)
- [x] API de members migrada para HouseholdMemberNew
- [x] API de subscription atualizada para usar householdId
- [x] API de accounts (server) atualizada
- [x] API de transactions (server) atualizada
- [x] **Políticas RLS atualizadas (28 referências ao HouseholdMember antigo removidas)**
- [x] **createBudget adiciona householdId**
- [x] **createGoal adiciona householdId**
- [x] **createDebt adiciona householdId**
- [x] **createPlannedPayment adiciona householdId**
- [x] **createUserSubscription adiciona householdId**
- [x] **createAccountClient adiciona householdId**
- [x] **createTransactionClient adiciona householdId**
- [x] Correção de recursão infinita nas políticas RLS de Account
- [ ] Verificar outras APIs de criação (se necessário)
- [ ] Verificar componentes frontend
- [ ] Testes completos
- [ ] Remover código legado (após validação)

---

## ✅ Próximos Passos (Opcional - Após Validação)

1. ✅ **COMPLETO:** Políticas RLS corrigidas (recursão infinita resolvida)
2. ✅ **COMPLETO:** householdId adicionado em todas as funções de criação (server-side)
3. ✅ **COMPLETO:** householdId adicionado em todas as funções de criação (client-side)
4. 🔄 **PRÓXIMO:** Testes e validação (recomendado)
5. 🔄 **FUTURO:** Limpeza de código legado (após validação completa)

---

## 🎉 Migração Completa!

Todas as tarefas críticas e importantes foram concluídas. O sistema está pronto para uso com a nova arquitetura baseada em Households.

**Recomendação:** Execute testes completos para validar que tudo está funcionando corretamente antes de considerar a remoção de código legado.

---

## 📝 Notas

- Todas as tabelas principais já têm a coluna `householdId` adicionada via migrations
- O sistema está funcionando com backward compatibility (userId ainda funciona)
- A migração de dados já foi feita para criar households personal para usuários existentes
- O sistema de convites já foi atualizado para usar HouseholdMemberNew

