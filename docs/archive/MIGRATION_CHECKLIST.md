# Checklist de Migração - Subscription/Plans/Limits

## ✅ O que já foi migrado

1. ✅ **API Unificada criada** - `lib/api/subscription.ts`
2. ✅ **Contextos unificados** - `contexts/subscription-context.tsx` é o único necessário
3. ✅ **Hooks unificados** - `hooks/use-subscription.ts` é o principal
4. ✅ **API Route principal** - `app/api/billing/subscription/route.ts`
5. ✅ **Layout protegido** - `app/(protected)/layout.tsx`
6. ✅ **Feature Guards** - `lib/api/feature-guard.ts`
7. ✅ **Webhook Stripe** - `lib/api/stripe.ts` (invalidação de cache)
8. ✅ **Reports page** - `app/(protected)/reports/page.tsx`
9. ✅ **Arquivos deprecated movidos** - Para pasta `Deprecated/`

## 🔄 O que falta migrar

### 1. Server Actions (1 arquivo)

#### `lib/actions/billing.ts`
**Status:** ⚠️ Usa `checkPlanLimits` de `lib/api/plans`
**Ação necessária:**
- Substituir `checkPlanLimits` por `getUserSubscriptionData` da API unificada
- Atualizar `checkTransactionLimitWithLimits` e `checkAccountLimitWithLimits` para usar API unificada
- Remover verificação hardcoded de plano "pro"

**Impacto:** Médio - Server Action usado em componentes de billing

---

### 2. API Routes (5 arquivos)

#### `app/api/billing/plans/route.ts`
**Status:** ⚠️ Usa `getPlans` e `getCurrentUserSubscription` de `lib/api/plans`
**Ação necessária:**
- Substituir `getPlans()` por `getPlans()` da API unificada (mesmo nome, mas da nova API)
- Substituir `getCurrentUserSubscription()` por `getCurrentUserSubscriptionData()` e extrair subscription

**Impacto:** Alto - Usado para exibir plans na página de billing

#### `app/api/billing/plans/public/route.ts`
**Status:** ⚠️ Usa `getPlans` de `lib/api/plans`
**Ação necessária:**
- Substituir `getPlans()` por `getPlans()` da API unificada

**Impacto:** Médio - Usado na landing page para pricing

#### `app/api/billing/start-trial/route.ts`
**Status:** ⚠️ Usa `invalidateSubscriptionCache` de `lib/api/plans`
**Ação necessária:**
- Substituir import de `@/lib/api/plans` para `@/lib/api/subscription`

**Impacto:** Baixo - Apenas invalidação de cache

#### `app/api/stripe/sync-subscription/route.ts`
**Status:** ⚠️ Usa `invalidateSubscriptionCache` de `lib/api/plans`
**Ação necessária:**
- Substituir import de `@/lib/api/plans` para `@/lib/api/subscription`

**Impacto:** Baixo - Apenas invalidação de cache

#### `app/api/stripe/create-account-and-link/route.ts`
**Status:** ⚠️ Usa `invalidateSubscriptionCache` de `lib/api/plans`
**Ação necessária:**
- Substituir import de `@/lib/api/plans` para `@/lib/api/subscription`

**Impacto:** Baixo - Apenas invalidação de cache

#### `app/api/stripe/link-subscription/route.ts`
**Status:** ⚠️ Usa `invalidateSubscriptionCache` de `lib/api/plans`
**Ação necessária:**
- Substituir import de `@/lib/api/plans` para `@/lib/api/subscription`

**Impacto:** Baixo - Apenas invalidação de cache

---

### 3. APIs Server (2 arquivos)

#### `lib/api/categories.ts`
**Status:** ⚠️ Usa `checkPlanLimits` de `lib/api/plans` na função `hasPaidPlan`
**Ação necessária:**
- Substituir `checkPlanLimits` por `getUserSubscriptionData` da API unificada
- Verificar se subscription existe (não precisa verificar plan específico)

**Impacto:** Baixo - Função auxiliar para verificar se usuário tem plano pago

#### `lib/api/transactions.ts`
**Status:** ⚠️ Usa `checkPlanLimits` de `lib/api/plans` para obter limits
**Ação necessária:**
- Substituir `checkPlanLimits` por `getUserSubscriptionData` da API unificada
- Usar `limits` diretamente do resultado

**Impacto:** Alto - Usado na criação de transações

---

### 4. Componentes Client-side (7 arquivos)

#### Componentes que ainda usam `usePlanLimits()`:
1. `app/(protected)/dashboard/widgets/investment-portfolio-widget.tsx`
2. `components/banking/connect-bank-button.tsx`
3. `components/forms/csv-import-dialog.tsx`
4. `components/forms/investment-csv-import-dialog.tsx`
5. `app/(protected)/transactions/page.tsx`
6. `components/common/feature-guard.tsx`
7. `app/(protected)/members/page.tsx`

**Status:** ⚠️ Usam `usePlanLimits()` hook deprecated
**Ação necessária:**
- Substituir `usePlanLimits()` por `useSubscription()` 
- Ajustar código para usar `limits` do hook (mesma estrutura)
- Remover imports de `use-plan-limits`

**Impacto:** Médio - Componentes funcionam mas usam hook deprecated

#### `app/layout.tsx`
**Status:** ⚠️ Usa `PlanLimitsProvider` deprecated
**Ação necessária:**
- Verificar se realmente precisa (pode ser que SubscriptionProvider já cubra)
- Se necessário, remover `PlanLimitsProvider` e usar apenas `SubscriptionProvider`

**Impacto:** Baixo - Layout root

---

### 5. Componentes que usam tipos de `lib/api/limits` (2 arquivos)

#### `components/billing/usage-limits.tsx`
**Status:** ⚠️ Importa `LimitCheckResult` de `lib/api/limits`
**Ação necessária:**
- Mudar import para `@/lib/api/subscription` (mesmo tipo, apenas mudar origem)

**Impacto:** Baixo - Apenas tipo TypeScript

#### `components/billing/usage-chart.tsx`
**Status:** ⚠️ Importa `LimitCheckResult` de `lib/api/limits`
**Ação necessária:**
- Mudar import para `@/lib/api/subscription`

**Impacto:** Baixo - Apenas tipo TypeScript

#### `app/(protected)/settings/page.tsx`
**Status:** ⚠️ Importa `PlanFeatures` e `LimitCheckResult` de `lib/api/limits`
**Ação necessária:**
- Mudar imports:
  - `PlanFeatures` → `@/lib/validations/plan` (já deveria ser assim)
  - `LimitCheckResult` → `@/lib/api/subscription`

**Impacto:** Baixo - Apenas tipos TypeScript

---

### 6. Arquivos Admin (1 arquivo)

#### `app/api/admin/plans/route.ts`
**Status:** ❓ Precisa verificar uso
**Ação necessária:**
- Verificar se usa `lib/api/plans`
- Se sim, migrar para API unificada
- Se for apenas CRUD de plans, pode manter separado

**Impacto:** Baixo - Admin apenas

---

### 7. Arquivos de Documentação (3 arquivos)

Estes arquivos mencionam a API antiga mas não precisam ser "migrados", apenas atualizados:
- `app/terms-of-service/page.tsx` - Verificar se realmente usa
- `app/privacy-policy/page.tsx` - Verificar se realmente usa
- `docs/NOVA_IMPLEMENTACAO_SUBSCRIPTION.md` - Atualizar documentação

---

## 📊 Resumo por Prioridade

### 🔴 Alta Prioridade (Impacto Alto)
1. `lib/actions/billing.ts` - Server Action usado em billing
2. `app/api/billing/plans/route.ts` - API route principal de plans
3. `lib/api/transactions.ts` - Usado na criação de transações

### 🟡 Média Prioridade (Impacto Médio)
4. `app/api/billing/plans/public/route.ts` - Landing page pricing
5. Componentes que usam `usePlanLimits()` (7 arquivos)

### 🟢 Baixa Prioridade (Impacto Baixo)
6. Invalidações de cache (4 arquivos Stripe)
7. `lib/api/categories.ts` - Função auxiliar
8. Ajustes de imports de tipos (3 arquivos)
9. `app/layout.tsx` - Verificar necessidade
10. `app/api/admin/plans/route.ts` - Verificar uso

---

## 🎯 Plano de Ação Recomendado

### Fase 1: APIs Críticas (Alta Prioridade)
1. Migrar `lib/api/transactions.ts`
2. Migrar `lib/actions/billing.ts`
3. Migrar `app/api/billing/plans/route.ts`

### Fase 2: Componentes (Média Prioridade)
4. Migrar todos os componentes que usam `usePlanLimits()`
5. Migrar `app/api/billing/plans/public/route.ts`

### Fase 3: Limpeza (Baixa Prioridade)
6. Atualizar invalidações de cache
7. Ajustar imports de tipos
8. Verificar e limpar arquivos restantes

### Fase 4: Remoção Final
9. Remover wrappers deprecated após confirmar que nada mais usa
10. Mover `lib/api/plans.ts` para Deprecated (ou remover se não for mais necessário)

---

## ✅ Checklist de Validação

Após migração, verificar:
- [ ] Nenhum arquivo importa de `@/lib/api/plans` (exceto admin se necessário)
- [ ] Nenhum componente usa `usePlanLimits()` ou `usePlanLimitsContext()`
- [ ] Todos os testes passam
- [ ] Features desativadas no banco são respeitadas
- [ ] Cache funciona corretamente
- [ ] Webhooks invalidam cache corretamente

---

## 📝 Notas

- Os wrappers deprecated (`lib/api/limits.ts`, `contexts/plan-limits-context.tsx`, `hooks/use-plan-limits.ts`) devem ser mantidos até a migração completa
- Após migração completa, mover para `Deprecated/` e depois remover
- `lib/api/plans.ts` pode ser mantido se ainda for usado para admin ou outras funcionalidades específicas

