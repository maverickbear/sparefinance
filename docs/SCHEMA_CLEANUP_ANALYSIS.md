# 🔍 Análise de Limpeza do Schema - Pair Programming

## 📋 Resumo Executivo

Análise comparativa entre o schema do banco de dados (`schema_reference.sql`) e o código da aplicação para identificar itens obsoletos que podem ser removidos.

**Data da Análise:** 2025-02-01

---

## 🗑️ 1. TABELAS LEGADAS PARA REMOVER

### 1.1. **HouseholdMember** (Tabela Antiga) ❌

**Status:** Obsoleta - pode ser removida após validação

**Evidências:**
- ✅ Nova arquitetura usa `HouseholdMemberNew` (baseada em `householdId`/`userId`)
- ✅ Todas as políticas RLS foram atualizadas para usar `HouseholdMemberNew`
- ✅ Código da aplicação usa apenas `HouseholdMemberNew`
- ⚠️ Ainda existe no schema com políticas RLS, triggers e índices

**Referências no Schema:**
- Tabela: linha 1340-1357
- Políticas RLS: linhas 4151, 4297, 4460, 4635
- Trigger: linha 3304 (`household_member_cache_update_trigger`)
- Índices: linhas 2764-2776, 3104-3108
- Foreign Keys: linhas 3486-3492

**Funções que Ainda Referenciam:**
- `trigger_update_member_subscription_cache()` - linha 774-796 (usa `HouseholdMember.memberId`)
- `update_household_members_subscription_cache()` - linha 825-843 (usa `HouseholdMember`)

**Ação Recomendada:**
1. ✅ Verificar se há dados na tabela: `SELECT COUNT(*) FROM "HouseholdMember";`
2. ✅ Atualizar funções que ainda referenciam `HouseholdMember` para usar `HouseholdMemberNew`
3. ✅ Remover trigger `household_member_cache_update_trigger` da tabela antiga
4. ✅ Remover políticas RLS da tabela antiga
5. ✅ Remover índices e foreign keys
6. ✅ Remover a tabela

**Impacto:** Baixo - tabela não é mais usada pelo código

---

### 1.2. **BudgetSubcategory** ✅

**Status:** Já removida do schema

**Evidências:**
- ✅ Tabela não existe mais no `schema_reference.sql`
- ✅ Migration 20250127000000 indica que foi removida anteriormente
- ✅ Código usa apenas `Budget.subcategoryId` diretamente

**Ação:** Nenhuma necessária - já foi removida

---

## 🔧 2. FUNÇÕES SQL OBSOLETAS

### 2.1. **trigger_update_member_subscription_cache()** ⚠️

**Status:** Usa tabela antiga `HouseholdMember`

**Localização:** `schema_reference.sql` linha 774-796

**Problema:**
```sql
-- Usa HouseholdMember.memberId (tabela antiga)
IF NEW."status" = 'active' AND NEW."memberId" IS NOT NULL THEN
  PERFORM "public"."update_user_subscription_cache"(NEW."memberId");
END IF;
```

**Solução:**
- Atualizar para usar `HouseholdMemberNew.userId` se ainda necessário
- OU remover se o trigger não for mais necessário (cache é atualizado via `trigger_update_subscription_cache`)

**Trigger Associado:**
- `household_member_cache_update_trigger` na tabela `HouseholdMember` (linha 3304)

**Ação:** Atualizar ou remover após remover tabela `HouseholdMember`

---

### 2.2. **update_household_members_subscription_cache()** ⚠️

**Status:** Usa tabela antiga `HouseholdMember`

**Localização:** `schema_reference.sql` linha 825-843

**Problema:**
```sql
-- Usa HouseholdMember (tabela antiga)
SELECT "memberId"
FROM "public"."HouseholdMember"
WHERE "ownerId" = p_owner_id
```

**Solução:**
- Atualizar para usar `HouseholdMemberNew` baseado em `householdId`
- OU remover se não for mais necessário (subscriptions agora são por household)

**Chamada:**
- `trigger_update_subscription_cache()` linha 813

**Ação:** Atualizar para usar `HouseholdMemberNew` ou remover

---

## 🎯 3. TRIGGERS OBSOLETOS

### 3.1. **household_member_cache_update_trigger** ❌

**Status:** Trigger na tabela obsoleta `HouseholdMember`

**Localização:** `schema_reference.sql` linha 3304

**Problema:**
- Trigger está na tabela `HouseholdMember` que não é mais usada
- Função `trigger_update_member_subscription_cache()` também usa tabela antiga

**Ação:** Remover após atualizar/remover funções relacionadas

---

## 📊 4. POLÍTICAS RLS OBSOLETAS

### 4.1. Políticas na Tabela `HouseholdMember` ❌

**Políticas a Remover:**
- `Users can delete household members` (linha 4151)
- `Users can insert household members` (linha 4297)
- `Users can update household members` (linha 4460)
- `Users can view household members` (linha 4635)

**Ação:** Remover todas após remover a tabela

---

## 🔍 5. CAMPOS/COLUNAS PARA REVISAR

### 5.1. Coluna `userId` em Tabelas com `householdId` ⚠️

**Status:** Mantida para backward compatibility

**Tabelas Afetadas:**
- `Transaction` - tem `userId` e `householdId`
- `Account` - tem `userId` e `householdId`
- `Budget` - tem `userId` e `householdId`
- `Debt` - tem `userId` e `householdId`
- `Goal` - tem `userId` e `householdId`
- E outras...

**Análise:**
- ✅ Políticas RLS mantêm `OR "userId" = auth.uid()` para compatibilidade
- ✅ Código cria registros com `householdId` (nova arquitetura)
- ⚠️ Coluna `userId` ainda é obrigatória em algumas tabelas

**Recomendação:**
- Manter por enquanto para backward compatibility
- Considerar tornar `userId` opcional em futura migration
- Remover verificação `OR "userId" = auth.uid()` após validação completa

---

## 📝 6. ÍNDICES OBSOLETOS

### 6.1. Índices na Tabela `HouseholdMember` ❌

**Índices a Remover:**
- `HouseholdMember_email_idx` (linha 2764)
- `HouseholdMember_memberId_idx` (linha 2768)
- `HouseholdMember_ownerId_idx` (linha 2772)
- `HouseholdMember_status_idx` (linha 2776)
- `idx_householdmember_memberid_status` (linha 3104)
- `idx_householdmember_ownerid` (linha 3108)

**Ação:** Remover após remover a tabela

---

## 🎯 7. PLANO DE AÇÃO RECOMENDADO

### Fase 1: Atualizar Funções SQL (Alta Prioridade)
1. ✅ Atualizar `update_household_members_subscription_cache()` para usar `HouseholdMemberNew`
2. ✅ Atualizar `trigger_update_member_subscription_cache()` para usar `HouseholdMemberNew` OU remover
3. ✅ Verificar se `trigger_update_subscription_cache()` precisa ser atualizado

### Fase 2: Remover Tabela HouseholdMember (Média Prioridade)
1. ✅ Verificar dados: `SELECT COUNT(*) FROM "HouseholdMember";`
2. ✅ Remover trigger `household_member_cache_update_trigger`
3. ✅ Remover políticas RLS (4 políticas)
4. ✅ Remover índices (6 índices)
5. ✅ Remover foreign keys
6. ✅ Remover a tabela

### Fase 3: Remover BudgetSubcategory (Baixa Prioridade)
1. ✅ Verificar dados: `SELECT COUNT(*) FROM "BudgetSubcategory";`
2. ✅ Remover políticas RLS
3. ✅ Remover índices e constraints
4. ✅ Remover a tabela

### Fase 4: Limpeza de Código (Baixa Prioridade)
1. ✅ Verificar se há imports/referências a `HouseholdMember` no código TypeScript
2. ✅ Remover interfaces/types obsoletos
3. ✅ Atualizar documentação

---

## 📊 8. ESTATÍSTICAS

### Tabelas para Remover: 2
- `HouseholdMember` (antiga)
- `BudgetSubcategory`

### Funções para Atualizar: 2
- `trigger_update_member_subscription_cache()`
- `update_household_members_subscription_cache()`

### Triggers para Remover: 1
- `household_member_cache_update_trigger`

### Políticas RLS para Remover: 5
- 4 na tabela `HouseholdMember`
- 1+ na tabela `BudgetSubcategory` (se existir)

### Índices para Remover: 6+
- 6 na tabela `HouseholdMember`
- 3+ na tabela `BudgetSubcategory` (se existir)

---

## ⚠️ 9. AVISOS IMPORTANTES

1. **Backup:** Sempre fazer backup antes de remover tabelas
2. **Validação:** Verificar se não há dados importantes antes de remover
3. **Testes:** Testar completamente após cada remoção
4. **Rollback:** Manter migrations reversíveis quando possível

---

## 📚 10. REFERÊNCIAS

- `docs/MIGRATION_COMPLETE.md` - Status da migração para Household
- `docs/TABELAS_NAO_UTILIZADAS.md` - Análise anterior de tabelas não utilizadas
- `supabase/migrations/20250201000011_remove_legacy_householdmember_references.sql` - Remoção de referências RLS
- `supabase/migrations/20250201000008_remove_legacy_functions.sql` - Remoção de funções legadas

---

## ✅ MIGRATIONS CRIADAS

### ✅ Migration 20250201000018: Atualizar Funções SQL
**Arquivo:** `supabase/migrations/20250201000018_update_subscription_cache_functions_household.sql`

**Mudanças:**
- ✅ Atualiza `update_household_members_subscription_cache()` para usar `householdId` e `HouseholdMemberNew`
- ✅ Atualiza `trigger_update_subscription_cache()` para suportar subscriptions por `householdId`
- ✅ Remove `trigger_update_member_subscription_cache()` (obsoleta)
- ✅ Remove trigger `household_member_cache_update_trigger` da tabela antiga

### ✅ Migration 20250201000019: Remover Tabela HouseholdMember
**Arquivo:** `supabase/migrations/20250201000019_remove_legacy_householdmember_table.sql`

**Mudanças:**
- ✅ Remove trigger (já removido na migration anterior)
- ✅ Remove 4 políticas RLS
- ✅ Remove 6 índices
- ✅ Remove foreign keys e constraints
- ✅ Remove a tabela `HouseholdMember`

---

## ⚠️ 11. NOTAS SOBRE CÓDIGO TYPESCRIPT

### Interfaces/Types `HouseholdMember`
**Status:** ✅ OK - Não precisa ser alterado

**Análise:**
- As interfaces TypeScript `HouseholdMember` em `lib/api/members.ts` e `lib/api/members-client.ts` são **tipos de dados**, não referências à tabela do banco
- Essas interfaces são usadas para tipagem e são compatíveis com `HouseholdMemberNew`
- Não há necessidade de renomear essas interfaces

### Migrations Antigas
**Status:** ⚠️ Documentar - Não executar novamente

**Migrations que ainda referenciam `HouseholdMember`:**
- `20250130000000_enable_household_member_access.sql` - Migration antiga, não deve ser executada novamente
- `20250129000000_add_subscription_cache_to_user.sql` - Já foi atualizada pela migration 20250201000016

**Ação:** Essas migrations são históricas e não devem ser executadas em novos ambientes.

---

## ✅ PRÓXIMOS PASSOS

1. ✅ **COMPLETO:** Migration para atualizar funções SQL (20250201000018)
2. ✅ **COMPLETO:** Migration para remover tabela `HouseholdMember` (20250201000019)
3. ✅ **COMPLETO:** Executar migrations em ambiente de desenvolvimento
4. ⏳ **PENDENTE:** Validar que não há regressões (testes funcionais)
5. ⏳ **PENDENTE:** Atualizar `schema_reference.sql` (gerar novo snapshot do schema)
6. ⏳ **PENDENTE:** Executar em produção após validação completa

## ✅ STATUS ATUAL

**Data de Conclusão:** 2025-02-01

**Migrations Executadas:**
- ✅ `20250201000018_update_subscription_cache_functions_household.sql`
- ✅ `20250201000019_remove_legacy_householdmember_table.sql`

**Resultado:**
- ✅ Tabela `HouseholdMember` removida com sucesso
- ✅ Funções SQL atualizadas para usar `HouseholdMemberNew` e `householdId`
- ✅ Triggers obsoletos removidos
- ✅ Políticas RLS obsoletas removidas

