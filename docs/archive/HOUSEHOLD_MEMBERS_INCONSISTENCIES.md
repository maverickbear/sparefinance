# Inconsistências no Sistema de Household Members

## 🔴 CRÍTICO - Corrigido

### 1. Bug em `guardAccountLimit` - Contava TODAS as contas do sistema
**Status:** ✅ CORRIGIDO

**Problema:**
- A função `guardAccountLimit` em `lib/api/feature-guard.ts` estava fazendo `SELECT * FROM Account` sem filtro de `userId`
- Isso contava TODAS as contas de TODOS os usuários do sistema
- Um usuário poderia ser bloqueado de criar contas mesmo que não tivesse atingido seu limite pessoal

**Solução:**
- Corrigido para usar a mesma lógica de `checkAccountLimit`
- Agora conta apenas contas do usuário (via `userId` ou `AccountOwner`)

---

## ⚠️ INCONSISTÊNCIAS DE DESIGN

### 2. Limites não são compartilhados entre household members

**Contexto importante:**
- ✅ **Apenas o plano Pro permite household members** (não Essential)
- ✅ **Plano Pro tem limites ilimitados** (`maxTransactions: -1`, `maxAccounts: -1`)
- ⚠️ **Mas o código atual conta limites separados** para owner e cada member

**Situação atual:**
- Owner e members têm limites **separados** para transações e contas
- Todos usam os **mesmos limites** do plan do owner (Pro = ilimitado)
- Como Pro é ilimitado, não há problema prático **atualmente**

**Questão de design:**
Se no futuro houver um plan com household members mas com limites finitos:
- **Limites devem ser compartilhados?**
  - Owner + Members compartilham o mesmo pool (ex: 1000 transações/mês total)
- **Limites devem ser separados?**
  - Cada member tem seus próprios limites (ex: owner 1000, cada member 1000)
  - Mas isso permite "explorar" o sistema criando múltiplos members

**Recomendação:**
- **Para Pro (ilimitado):** Comportamento atual está OK (não há limite para compartilhar)
- **Para futuros plans:** Decidir se limites serão compartilhados ou separados
- **Código atual:** Funciona, mas não está preparado para plans com limites finitos + household

**Código afetado:**
- `lib/api/subscription.ts` - `checkTransactionLimit()` (linha 359)
- `lib/api/subscription.ts` - `checkAccountLimit()` (linha 438)
- `lib/api/feature-guard.ts` - `guardTransactionLimit()` (linha 92)
- `lib/api/feature-guard.ts` - `guardAccountLimit()` (linha 180)

---

### 3. Registros inválidos no banco (ownerId == memberId)

**Problema:**
- Existem registros em `HouseholdMember` onde `ownerId == memberId`
- Isso acontece porque o código de signup/signin cria esses registros
- O código agora ignora esses registros, mas eles ainda existem no banco

**Impacto:**
- Não causa erro funcional (código trata corretamente)
- Mas é inconsistência de dados
- Pode causar confusão em queries e relatórios

**Solução recomendada:**
1. Criar migração SQL para deletar registros onde `ownerId = memberId`
2. Adicionar constraint CHECK para prevenir no futuro:
   ```sql
   ALTER TABLE "HouseholdMember"
   ADD CONSTRAINT "HouseholdMember_owner_member_check"
   CHECK ("ownerId" != "memberId" OR "memberId" IS NULL);
   ```
3. Remover código que cria esses registros em signup/signin

**Arquivos afetados:**
- `lib/api/auth.ts` - `signUp()` (linha 98)
- `lib/api/auth.ts` - `signIn()` (linha 199)
- `lib/api/auth-client.ts` - `signUpClient()` (linha 356)
- `lib/api/auth-client.ts` - `signInClient()` (linha 356)
- `app/auth/callback/route.ts` - (linha 133)
- `app/api/stripe/create-account-and-link/route.ts` - (linha 101)

---

### 4. Verificação de subscription do owner

**Problema:**
- Se o owner não tem subscription ativa, o member recebe limites padrão (free)
- Mas o member foi convidado esperando ter acesso ao plan do owner
- Não há validação se o owner realmente tem subscription válida antes de permitir acesso

**Cenário problemático:**
```
1. Owner tem subscription Pro (único que permite household)
2. Owner convida Member
3. Member aceita convite
4. Owner cancela subscription Pro
5. Member ainda pode usar o sistema com limites free (não deveria?)
```

**Questão:**
- Members devem perder acesso quando owner cancela subscription?
- Ou devem manter acesso com limites free?

**Recomendação:**
- Members devem perder acesso quando owner não tem subscription ativa
- `canUserWrite()` já verifica subscription, mas pode não estar sendo usado em todos os lugares
- Adicionar validação explícita em `getUserSubscriptionData()` para members

---

### 5. Inconsistências na documentação pública

**Status:** ✅ CORRIGIDO

**Problema:**
- A documentação pública (FAQ, Terms of Service, Privacy Policy) dizia que **Essential também tem household members**
- Mas o código e banco de dados confirmam que **apenas Pro tem**

**Arquivos corrigidos:**
- ✅ `app/faq/page.tsx` - Corrigido para mencionar apenas Pro plan
- ✅ `app/terms-of-service/page.tsx` - Removido household members da lista do Essential
- ✅ `app/privacy-policy/page.tsx` - Corrigido para mencionar apenas Pro plan
- ✅ `lib/utils/plan-errors.ts` - Corrigido mensagem de erro para mencionar apenas Pro

**Código correto (já estava):**
- `lib/api/feature-guard.ts` - Linha 275: Comentário diz "Pro-only"
- `app/(protected)/members/page.tsx` - Linha 150: `requiredPlan="pro"`
- `components/common/feature-guard.tsx` - Linha 67: `hasHousehold` marcado como "Pro feature"

---

## 📋 RESUMO

### Bugs Corrigidos
- ✅ `guardAccountLimit` agora conta apenas contas do usuário
- ✅ Documentação pública corrigida para mencionar apenas Pro plan

### Inconsistências Pendentes
1. ⚠️ Registros inválidos no banco (migração necessária)
2. ⚠️ Validação de subscription do owner (comportamento não definido)

### Próximos Passos
1. **Criar migração:**
   - Limpar registros inválidos (ownerId == memberId)
   - Adicionar constraint para prevenir no futuro

2. **Remover criação de registros inválidos:**
   - Remover código que cria `ownerId == memberId` em signup/signin

3. **Definir comportamento de subscription:**
   - O que acontece quando owner cancela?
   - Validar subscription do owner antes de permitir acesso de members

