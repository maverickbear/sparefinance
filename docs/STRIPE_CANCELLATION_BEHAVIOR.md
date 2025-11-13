# Comportamento ao Cancelar Subscription no Portal do Stripe

## Visão Geral

Quando uma subscription é cancelada diretamente no portal do Stripe (Customer Portal), o sistema sincroniza automaticamente o status através de webhooks. Este documento descreve o comportamento atual e o que acontece em cada cenário.

## Cenários de Cancelamento

### 1. Cancelamento no Final do Período (`cancel_at_period_end: true`)

**O que acontece:**
- O usuário cancela a subscription no portal do Stripe, mas escolhe manter o acesso até o final do período atual
- O Stripe envia um evento `customer.subscription.updated`
- O webhook `handleSubscriptionChange` é acionado

**Ações tomadas:**
1. O status da subscription no Stripe permanece `"active"` até o final do período
2. O campo `cancelAtPeriodEnd` é atualizado para `true` no banco de dados
3. O status no banco permanece `"active"` até o período acabar
4. O cache da subscription é invalidado para refletir as mudanças imediatamente
5. O usuário mantém acesso às funcionalidades premium até `currentPeriodEnd`

**Quando o período acaba:**
- O Stripe envia um evento `customer.subscription.deleted`
- O status é atualizado para `"cancelled"` no banco
- O cache é invalidado novamente
- O usuário perde acesso às funcionalidades premium

### 2. Cancelamento Imediato

**O que acontece:**
- O usuário cancela a subscription no portal do Stripe e escolhe cancelar imediatamente
- O Stripe envia um evento `customer.subscription.deleted`
- O webhook `handleSubscriptionDeletion` é acionado

**Ações tomadas:**
1. O status da subscription é atualizado para `"cancelled"` no banco de dados
2. O cache da subscription é invalidado para refletir o cancelamento imediatamente
3. O usuário perde acesso às funcionalidades premium imediatamente

## Mapeamento de Status

O sistema mapeia os status do Stripe para o banco de dados da seguinte forma:

```typescript
function mapStripeStatus(status: Stripe.Subscription.Status):
  - "active" → "active"
  - "canceled" → "cancelled"
  - "unpaid" → "cancelled"
  - "past_due" → "past_due"
  - "trialing" → "trialing"
  - "incomplete" → "trialing"
  - "incomplete_expired" → "cancelled"
```

## Sincronização e Cache

### Invalidação de Cache

Quando uma subscription é cancelada via webhook:
- O cache da subscription é **automaticamente invalidado**
- Isso garante que a UI reflita as mudanças imediatamente
- O usuário verá o status atualizado na próxima requisição

### Verificação de Acesso

O sistema verifica o status da subscription ao:
- Carregar dados do dashboard
- Acessar funcionalidades premium
- Verificar limites do plano

Se a subscription estiver `"cancelled"`, o usuário:
- Perde acesso às funcionalidades premium
- É redirecionado para a página de seleção de planos (se necessário)
- Vê mensagens apropriadas sobre o cancelamento

## Fluxo Completo

```
1. Usuário cancela no Portal do Stripe
   ↓
2. Stripe envia webhook (updated ou deleted)
   ↓
3. Webhook handler processa o evento
   ↓
4. Status atualizado no banco de dados
   ↓
5. Cache invalidado
   ↓
6. Próxima requisição do usuário reflete o novo status
   ↓
7. Acesso às funcionalidades ajustado conforme o status
```

## Webhooks Configurados

O sistema escuta os seguintes eventos do Stripe:

- `customer.subscription.created` - Nova subscription criada
- `customer.subscription.updated` - Subscription atualizada (inclui cancelamento no final do período)
- `customer.subscription.deleted` - Subscription cancelada/deletada
- `checkout.session.completed` - Checkout concluído
- `invoice.payment_succeeded` - Pagamento bem-sucedido
- `invoice.payment_failed` - Falha no pagamento

## Notas Importantes

1. **Sincronização Automática**: O sistema sincroniza automaticamente com o Stripe através de webhooks. Não é necessário fazer nada manualmente.

2. **Cache**: O cache é invalidado automaticamente quando webhooks são processados, garantindo que a UI reflita o estado atual.

3. **Acesso até o Final do Período**: Se o cancelamento for no final do período, o usuário mantém acesso até `currentPeriodEnd`.

4. **Sem Plano Free**: Quando uma subscription é cancelada, o usuário não é automaticamente migrado para um plano free (que não existe mais). O usuário precisa assinar um novo plano para continuar usando o serviço.

5. **Membros do Household**: Se o usuário for um membro do household, ele herda o plano do owner. Se o owner cancelar, todos os membros perdem acesso.

## Troubleshooting

### Subscription cancelada mas ainda aparece como ativa

- Verifique se o webhook foi recebido e processado corretamente
- Verifique os logs do webhook handler
- O cache pode estar desatualizado - aguarde alguns segundos ou force refresh

### Usuário ainda tem acesso após cancelamento

- Verifique se `cancelAtPeriodEnd` está `true` e o período ainda não acabou
- Verifique se o status está realmente `"cancelled"` no banco
- Verifique se o cache foi invalidado corretamente

### Webhook não está sendo recebido

- Verifique se o endpoint do webhook está configurado corretamente no Stripe
- Verifique se `STRIPE_WEBHOOK_SECRET` está configurado
- Verifique os logs do servidor para erros de verificação de assinatura

