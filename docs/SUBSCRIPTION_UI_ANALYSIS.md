# Análise de Conflitos e Ajustes Necessários na UI

Documento identificando conflitos entre a documentação de cenários e a implementação atual, além de ajustes necessários na UI.

---

## 🔴 CONFLITOS IDENTIFICADOS

### 1. **useWriteGuard não verifica se trial está válido**

**Problema:**
- `useWriteGuard` verifica apenas `status === "active" || status === "trialing"`
- Não verifica se `trialEndDate > now` quando status é "trialing"
- Permite operações de escrita mesmo quando trial expirou

**Localização:** `hooks/use-write-guard.tsx:15`

**Impacto:**
- Usuários com trial expirado podem criar/editar dados quando não deveriam
- Conflito com a documentação que diz que trial expirado deve ter acesso limitado

**Solução necessária:**
```typescript
// Adicionar verificação de trial válido
const isTrialValid = subscription?.status === "trialing" 
  ? (subscription.trialEndDate ? new Date(subscription.trialEndDate) > new Date() : false)
  : true;

const canWrite = (subscription?.status === "active" || 
  (subscription?.status === "trialing" && isTrialValid));
```

---

### 2. **UpgradeBanner não mostra quando trial expirou**

**Problema:**
- `UpgradeBanner` só mostra quando `status === "cancelled" || status === "past_due"`
- Não mostra quando `status === "trialing"` mas `trialEndDate <= now`
- Usuário com trial expirado não vê banner de upgrade

**Localização:** `components/common/upgrade-banner.tsx:58, 112`

**Impacto:**
- Usuários com trial expirado não são incentivados a fazer upgrade
- UX inconsistente - deveria mostrar banner quando trial expira

**Solução necessária:**
```typescript
// Verificar se trial expirou
const isTrialExpired = userData?.subscription?.status === "trialing" &&
  userData?.subscription?.trialEndDate &&
  new Date(userData.subscription.trialEndDate) <= new Date();

const isSubscriptionInactive = 
  userData?.subscription?.status === "cancelled" || 
  userData?.subscription?.status === "past_due" ||
  isTrialExpired;
```

---

### 3. **Inconsistência na documentação vs implementação**

**Problema:**
- Documentação diz: `getUserSubscription()` pode retornar `null` se trial expirado
- Implementação atual: `getUserSubscription()` retorna subscription mesmo quando trial expirado
- Documentação diz: Layout mostra modal quando trial expira
- Implementação atual: Layout NÃO mostra modal quando trial expira (permite visualização)

**Localização:** 
- Documentação: `docs/SUBSCRIPTION_SCENARIOS.md:40-42`
- Implementação: `lib/api/plans.ts:354-359`, `app/(protected)/layout.tsx:90-102`

**Impacto:**
- Documentação não reflete o comportamento real
- Pode confundir desenvolvedores e QA

**Solução necessária:**
- Atualizar documentação para refletir comportamento atual OU
- Ajustar implementação para seguir documentação (mostrar modal quando trial expira)

**Recomendação:** Manter comportamento atual (permitir visualização) mas atualizar documentação, pois é melhor UX permitir que usuário veja o sistema mesmo com trial expirado.

---

### 4. **SubscriptionGuard não abre modal quando trial expira**

**Problema:**
- `SubscriptionGuard` tem lógica para não abrir modal quando `reason === "trial_expired"`
- Layout protegido não passa `reason: "trial_expired"` quando trial expira
- Modal nunca abre para trial expirado

**Localização:** 
- `components/subscription-guard.tsx:48-52`
- `app/(protected)/layout.tsx:90-102`

**Impacto:**
- Comportamento inconsistente - trial expirado não mostra modal, mas deveria?
- Depende da decisão de produto: mostrar modal ou permitir visualização

**Solução necessária:**
- Decisão de produto necessária: modal obrigatório ou apenas visualização?
- Se modal obrigatório: remover check em `SubscriptionGuard` e passar `reason: "trial_expired"` no layout
- Se apenas visualização: manter comportamento atual mas adicionar banner de upgrade

---

## ⚠️ AJUSTES NECESSÁRIOS

### 1. **Corrigir useWriteGuard para verificar trial válido**

**Prioridade:** ALTA

**Arquivo:** `hooks/use-write-guard.tsx`

**Mudança:**
- Adicionar função `isTrialValid()` ou importar de `lib/api/plans.ts`
- Verificar trial válido antes de permitir escrita

---

### 2. **Corrigir UpgradeBanner para mostrar quando trial expira**

**Prioridade:** MÉDIA

**Arquivo:** `components/common/upgrade-banner.tsx`

**Mudança:**
- Adicionar verificação de trial expirado
- Mostrar banner quando `status === "trialing"` e `trialEndDate <= now`
- Mensagem específica para trial expirado

---

### 3. **Atualizar documentação para refletir comportamento real**

**Prioridade:** BAIXA

**Arquivo:** `docs/SUBSCRIPTION_SCENARIOS.md`

**Mudança:**
- Atualizar seção 3 (EXPIRAÇÃO DO TRIAL) para refletir que:
  - `getUserSubscription()` retorna subscription mesmo quando expirado
  - Layout permite acesso (não bloqueia) quando trial expira
  - Modal não abre automaticamente quando trial expira

---

### 4. **Adicionar verificação de trial válido no SubscriptionContext**

**Prioridade:** MÉDIA

**Arquivo:** `contexts/subscription-context.tsx`

**Mudança:**
- Adicionar campo `isTrialValid` no `SubscriptionData`
- Calcular se trial está válido quando subscription é "trialing"
- Expor através do context para uso em outros componentes

---

## ✅ COMPORTAMENTOS CORRETOS (NÃO PRECISAM AJUSTE)

### 1. **Layout protegido permite acesso quando trial expira**
- ✅ Comportamento correto - melhor UX
- ✅ Permite visualização mas não escrita (quando useWriteGuard for corrigido)

### 2. **SubscriptionGuard não abre modal para trial expirado**
- ✅ Comportamento correto se intencional
- ⚠️ Mas deveria mostrar banner de upgrade

### 3. **Webhooks atualizam status corretamente**
- ✅ Mapeamento de status correto
- ✅ Cancelamento automático de outras subscriptions

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Corrigir `useWriteGuard` para verificar trial válido
- [ ] Corrigir `UpgradeBanner` para mostrar quando trial expira
- [ ] Atualizar documentação `SUBSCRIPTION_SCENARIOS.md`
- [ ] Adicionar `isTrialValid` no `SubscriptionContext`
- [ ] Testar cada cenário após correções
- [ ] Verificar que operações de escrita são bloqueadas quando trial expira
- [ ] Verificar que banner aparece quando trial expira

---

## 🧪 CENÁRIOS PARA TESTAR

1. **Trial ativo** - Deve permitir escrita e não mostrar banner
2. **Trial expirado** - Deve bloquear escrita e mostrar banner
3. **Subscription active** - Deve permitir escrita e não mostrar banner
4. **Subscription cancelled** - Deve bloquear escrita e mostrar banner
5. **Subscription past_due** - Deve bloquear escrita e mostrar banner

---

**Última atualização:** Janeiro 2025

