# Cenários de Subscriptions, Trials, Cancelamentos e Renovações

Documento simples explicando como o app resolve cada cenário de subscription.

---

## 1. INÍCIO DE TRIAL

**Cenário:** Usuário inicia trial de 14 dias

**Como funciona:**
- Endpoint: `/api/billing/start-trial`
- Verifica se usuário já tem subscription ativa/trial
- Cria subscription no Stripe com trial de 14 dias
- Salva no banco com status `"trialing"` e datas `trialStartDate` e `trialEndDate`
- Usuário tem acesso completo durante o trial

**Status no banco:** `status: "trialing"`

---

## 2. TRIAL ATIVO

**Cenário:** Usuário está dentro do período de trial

**Como funciona:**
- Função `isTrialValid()` verifica se `trialEndDate > now`
- Layout protegido permite acesso se trial válido
- Usuário tem acesso completo a todas funcionalidades

**Status no banco:** `status: "trialing"` + `trialEndDate > now`

---

## 3. EXPIRAÇÃO DO TRIAL

**Cenário:** Trial chegou ao fim (`trialEndDate <= now`)

**Como funciona:**
- `isTrialValid()` retorna `false`
- `getUserSubscription()` pode retornar `null` se trial expirado
- Layout protegido permite acesso (não bloqueia), mas mostra modal de upgrade
- Se usuário não tem payment method no Stripe:
  - Stripe muda status para `incomplete_expired`
  - Webhook atualiza banco para `status: "cancelled"`
- Se usuário tem payment method:
  - Stripe tenta cobrar automaticamente
  - Se sucesso: status vira `"active"` (renovação automática)
  - Se falha: status vira `"past_due"` ou `"cancelled"`

**Status no banco:** `status: "trialing"` (até webhook) → `"cancelled"` ou `"active"` ou `"past_due"`

**Implementado:**
- ✅ Verificação de expiração no servidor
- ✅ Webhook handler para atualizar status
- ✅ Mapeamento de `incomplete_expired` → `cancelled`

---

## 4. ASSINATURA PAGA (CHECKOUT)

**Cenário:** Usuário faz checkout e paga plano

**Como funciona:**
- Stripe cria subscription e envia webhook `checkout.session.completed`
- Webhook `handleCheckoutSessionCompleted` processa
- Cria/atualiza subscription no banco com status `"active"`
- Cancela outras subscriptions ativas do mesmo usuário (só uma ativa por vez)
- Invalida cache da subscription

**Status no banco:** `status: "active"`

---

## 5. RENOVAÇÃO AUTOMÁTICA

**Cenário:** Subscription renova automaticamente no final do período

**Como funciona:**
- Stripe cobra automaticamente no `currentPeriodEnd`
- Se pagamento sucesso: webhook `invoice.payment_succeeded` é enviado
- Webhook `customer.subscription.updated` também é enviado
- `handleSubscriptionChange` atualiza `currentPeriodStart` e `currentPeriodEnd`
- Status permanece `"active"`
- Cache é invalidado

**Status no banco:** `status: "active"` (períodos atualizados)

**Implementado:**
- ✅ Webhook `invoice.payment_succeeded` (apenas log)
- ✅ Webhook `customer.subscription.updated` atualiza períodos
- ✅ Cache invalidation automático

---

## 6. FALHA NO PAGAMENTO

**Cenário:** Pagamento falha na renovação

**Como funciona:**
- Stripe tenta cobrar e falha
- Webhook `invoice.payment_failed` é enviado
- `handleInvoicePaymentFailed` atualiza status para `"past_due"`
- Usuário ainda tem acesso (layout não bloqueia completamente)
- Stripe tenta novamente automaticamente (depende da configuração)

**Status no banco:** `status: "past_due"`

**Implementado:**
- ✅ Webhook handler atualiza para `past_due`
- ✅ Layout permite acesso mas mostra modal de upgrade

---

## 7. CANCELAMENTO NO FINAL DO PERÍODO

**Cenário:** Usuário cancela mas mantém acesso até fim do período

**Como funciona:**
- Usuário vai para Stripe Customer Portal (via `/api/stripe/cancel-subscription`)
- Cancela subscription no portal escolhendo "cancelar no final do período"
- Stripe envia webhook `customer.subscription.updated`
- `handleSubscriptionChange` atualiza `cancelAtPeriodEnd: true`
- Status permanece `"active"` até `currentPeriodEnd`
- Usuário mantém acesso completo até o fim
- Quando período acaba: Stripe envia `customer.subscription.deleted`
- Status muda para `"cancelled"`

**Status no banco:** `status: "active"` + `cancelAtPeriodEnd: true` → depois `"cancelled"`

**Implementado:**
- ✅ Portal do Stripe para cancelamento
- ✅ Webhook atualiza `cancelAtPeriodEnd`
- ✅ Webhook de deleção atualiza status quando período acaba

---

## 8. CANCELAMENTO IMEDIATO

**Cenário:** Usuário cancela e perde acesso imediatamente

**Como funciona:**
- Usuário cancela no Stripe Customer Portal escolhendo cancelamento imediato
- Stripe envia webhook `customer.subscription.deleted`
- `handleSubscriptionDeletion` atualiza status para `"cancelled"`
- Cache é invalidado
- Usuário perde acesso imediatamente

**Status no banco:** `status: "cancelled"`

**Implementado:**
- ✅ Webhook handler para deleção
- ✅ Atualização imediata de status
- ✅ Cache invalidation

---

## 9. TROCA DE PLANO

**Cenário:** Usuário muda de plano (upgrade/downgrade)

**Como funciona:**
- Endpoint `/api/billing/update-subscription-plan`
- Cancela subscription atual no Stripe (no final do período ou imediato)
- Cria nova subscription com novo plano
- Webhooks processam as mudanças
- Outras subscriptions ativas são canceladas automaticamente
- Cache é invalidado

**Status no banco:** Subscription antiga `"cancelled"`, nova `"active"`

**Implementado:**
- ✅ Endpoint para trocar plano
- ✅ Cancelamento automático de outras subscriptions
- ✅ Criação de nova subscription

---

## 10. MÚLTIPLAS SUBSCRIPTIONS

**Cenário:** Usuário tenta ter múltiplas subscriptions ativas

**Como funciona:**
- Sistema permite apenas UMA subscription ativa por usuário
- Quando nova subscription é criada (via webhook ou checkout):
  - Busca outras subscriptions ativas/trialing do mesmo usuário
  - Cancela automaticamente todas as outras
  - Mantém apenas a nova
- Implementado em `handleSubscriptionChange`

**Status no banco:** Apenas uma com `status: "active"` ou `"trialing"`

**Implementado:**
- ✅ Verificação e cancelamento automático de outras subscriptions
- ✅ Garantia de apenas uma subscription ativa

---

## 11. HOUSEHOLD MEMBERS

**Cenário:** Membro do household herda plano do owner

**Como funciona:**
- `getUserSubscription()` verifica se usuário é membro de household
- Se for membro, busca subscription do owner
- Retorna subscription do owner como se fosse do membro
- Se owner cancela, todos membros perdem acesso

**Status no banco:** Membro usa subscription do owner

**Implementado:**
- ✅ Herança de subscription para membros
- ✅ Verificação em `getUserSubscription()`

---

## 12. SINCRONIZAÇÃO COM STRIPE

**Cenário:** Status no banco está desatualizado

**Como funciona:**
- Endpoint `/api/stripe/sync-subscription` força sincronização
- Busca subscription ativa no Stripe
- Atualiza banco com dados do Stripe
- Cancela subscriptions free se criar paid
- Invalida cache

**Status no banco:** Atualizado conforme Stripe

**Implementado:**
- ✅ Endpoint de sincronização manual
- ✅ Atualização de períodos e status

---

## MAPEAMENTO DE STATUS

**Stripe → Banco de Dados:**

```
"active" → "active"
"canceled" → "cancelled"
"unpaid" → "cancelled"
"past_due" → "past_due"
"trialing" → "trialing"
"incomplete" → "trialing"
"incomplete_expired" → "cancelled"
```

**Função:** `mapStripeStatus()` em `lib/api/stripe.ts`

---

## WEBHOOKS CONFIGURADOS

1. **`checkout.session.completed`** - Checkout concluído
2. **`customer.subscription.created`** - Nova subscription criada
3. **`customer.subscription.updated`** - Subscription atualizada (renovação, cancelamento no final)
4. **`customer.subscription.deleted`** - Subscription cancelada/deletada
5. **`invoice.payment_succeeded`** - Pagamento bem-sucedido (renovação)
6. **`invoice.payment_failed`** - Falha no pagamento

**Handler:** `handleWebhookEvent()` em `lib/api/stripe.ts`

---

## CACHE E INVALIDAÇÃO

**Como funciona:**
- Cache de subscriptions com TTL de 30 segundos
- Cache invalidado automaticamente quando:
  - Subscription é criada/atualizada/deletada
  - Webhooks são processados
  - Usuário faz checkout ou cancela

**Função:** `invalidateSubscriptionCache()` em `lib/api/plans.ts`

---

## VERIFICAÇÃO DE ACESSO

**Onde é verificado:**
- `app/(protected)/layout.tsx` - Layout de rotas protegidas
- `lib/api/plans.ts` - `getUserSubscription()` e `isTrialValid()`
- `components/subscription-guard.tsx` - Guard component

**Regras:**
- `status: "active"` → Acesso completo
- `status: "trialing"` + trial válido → Acesso completo
- `status: "trialing"` + trial expirado → Acesso permitido (mostra modal)
- `status: "past_due"` → Acesso permitido (mostra modal)
- `status: "cancelled"` → Acesso permitido (mostra modal)
- Sem subscription → Modal de seleção de plano

**Nota:** O app não bloqueia completamente o acesso quando trial expira ou subscription é cancelada. Permite visualização mas mostra modais de upgrade.

---

## RESUMO DOS CENÁRIOS

| Cenário | Status Inicial | Status Final | Acesso |
|---------|---------------|--------------|--------|
| Trial inicia | - | `trialing` | Completo |
| Trial ativo | `trialing` | `trialing` | Completo |
| Trial expira (sem payment) | `trialing` | `cancelled` | Modal upgrade |
| Trial expira (com payment) | `trialing` | `active` | Completo |
| Checkout pago | - | `active` | Completo |
| Renovação automática | `active` | `active` | Completo |
| Falha pagamento | `active` | `past_due` | Modal upgrade |
| Cancelamento no final | `active` | `active` → `cancelled` | Completo até fim |
| Cancelamento imediato | `active` | `cancelled` | Modal upgrade |
| Troca de plano | `active` | `cancelled` + `active` | Completo (novo plano) |

---

**Última atualização:** Janeiro 2025

