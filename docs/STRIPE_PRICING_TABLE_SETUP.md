# Configuração do Stripe Pricing Table

Este guia explica como configurar e usar o Stripe Pricing Table no projeto.

## Pré-requisitos

1. **Stripe Account**: Você precisa ter uma conta no Stripe
2. **Pricing Table criado**: Você já configurou a tela de planos no Stripe Dashboard

## Como obter o Pricing Table ID

1. Acesse o [Stripe Dashboard](https://dashboard.stripe.com)
2. Vá para **Products** > **Pricing tables** (ou **Product catalog** > **Pricing tables**)
3. Selecione ou crie um Pricing Table
4. Clique em **Copy code** para copiar o código de embed
5. O **Pricing Table ID** está no atributo `pricing-table-id` (formato: `prctbl_xxxxx`)

**Exemplo do código fornecido pelo Stripe:**
```html
<script async src="https://js.stripe.com/v3/pricing-table.js"></script>
<stripe-pricing-table 
  pricing-table-id="prctbl_1SStdoEV4odJQ85ha1VuLKPo"
  publishable-key="pk_test_51SQHmTEV4odJQ85hqdJ6CWLTRWM8E0qBKnPn4oZ3YWj7jWyPeX3Z9tefDLTdM9vGM6cWs7MjU4eMGASNo7tnhGeF00eg5Fw0Uq">
</stripe-pricing-table>
```

Neste exemplo, o Pricing Table ID é: `prctbl_1SStdoEV4odJQ85ha1VuLKPo`

## Configuração

### 1. Variáveis de Ambiente

Adicione as seguintes variáveis ao seu arquivo `.env.local`:

```env
# Stripe Keys (já configuradas)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51SQHmTEV4odJQ85hqdJ6CWLTRWM8E0qBKnPn4oZ3YWj7jWyPeX3Z9tefDLTdM9vGM6cWs7MjU4eMGASNo7tnhGeF00eg5Fw0Uq
STRIPE_SECRET_KEY=sk_test_...

# Stripe Pricing Table ID (NOVO)
# Use o ID do código fornecido pelo Stripe Dashboard
NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID=prctbl_1SStdoEV4odJQ85ha1VuLKPo
```

**Nota:** Use os valores do código que você copiou do Stripe Dashboard. O exemplo acima mostra os valores do código que você forneceu.

### 2. Como funciona

O sistema usa 100% o Stripe Pricing Table. Quando o `NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID` está configurado:

- A página `/pricing` mostra o Stripe Pricing Table diretamente do Stripe
- O pricing modal mostra o Stripe Pricing Table
- A landing page mostra o Stripe Pricing Table
- Todos os planos são gerenciados diretamente no Stripe Dashboard

### 3. Fluxo de Checkout

Quando o usuário seleciona um plano no Stripe Pricing Table:

1. O Stripe redireciona para o checkout
2. Após o pagamento, o Stripe envia um webhook `checkout.session.completed`
3. O webhook atualiza a subscription no banco de dados
4. O usuário é redirecionado de volta para a aplicação

**Rastreamento do Usuário:**
- O sistema automaticamente passa o `client-reference-id` (userId) para o Stripe
- Isso permite rastrear qual usuário fez a compra no webhook `checkout.session.completed`
- O `client-reference-id` está disponível em `session.client_reference_id` no webhook

### 4. URLs de Retorno

O Stripe Pricing Table usa as URLs configuradas no Stripe Dashboard:

- **Success URL**: **OBRIGATÓRIO** - Configure no Stripe Dashboard para redirecionar após pagamento bem-sucedido
- **Cancel URL**: **OPCIONAL** - Pode não estar disponível no Dashboard do Pricing Table. Se o usuário cancelar, ele simplesmente volta para a página anterior ou o Stripe usa uma página padrão.

**URL de Sucesso para configurar no Stripe Dashboard:**

**Produção:**
```
https://sparefinance.com/subscription/success?session_id={CHECKOUT_SESSION_ID}
```

**Desenvolvimento local:**
```
http://localhost:3000/subscription/success?session_id={CHECKOUT_SESSION_ID}
```

**Como configurar:**
1. Acesse o Stripe Dashboard
2. Vá em **Products** → **Pricing Tables**
3. Selecione sua Pricing Table
4. Procure por **"After the payment"** ou **"Confirmation page"**
5. Selecione **"Redirect to a URL"**
6. Cole a URL de sucesso acima

**Nota:** 
- O placeholder `{CHECKOUT_SESSION_ID}` é automaticamente substituído pelo Stripe com o ID real da sessão
- A página de sucesso (`/subscription/success`) usa o `session_id` para:
  - Buscar o email do customer (para pré-preencher signup)
  - Detectar se o usuário está autenticado ou não
  - Sincronizar a subscription automaticamente (se autenticado)
- **URL de cancelamento não é necessária**: Se o usuário cancelar o checkout, ele simplesmente volta para onde estava. Não é necessário configurar uma URL específica.

### 5. Gerenciamento de Subscription via Stripe Portal

Na tela de billing (`/settings?tab=billing`), o usuário pode clicar em **"Manage Subscription"** para ser redirecionado ao Stripe Customer Portal, onde pode:

- Cancelar a subscription
- Trocar de plano
- Atualizar método de pagamento
- Reativar subscription cancelada

**Fluxo:**
1. Usuário clica em "Manage Subscription" na tela de billing
2. É redirecionado para o Stripe Customer Portal
3. Faz alterações (cancelar, trocar plano, etc.)
4. Ao fechar o portal, é redirecionado de volta para `/settings?tab=billing&portal_return=true`
5. O app detecta o parâmetro `portal_return=true` e sincroniza automaticamente a subscription do Stripe
6. A subscription é atualizada no banco de dados e a UI é atualizada

**URL de retorno do Portal:** `https://sparefinance.com/settings?tab=billing&portal_return=true`

### 6. Fluxo de Trial para Novos Usuários

**Fluxo Principal (Trial sem Autenticação):**

1. **Usuário vê Pricing Table** (landing page ou `/pricing`)
2. **Clica em "Start Trial"** → Stripe Pricing Table redireciona para Stripe Checkout
3. **Usuário preenche dados no Stripe** (email e payment method)
   - O Stripe cria automaticamente um customer e subscription com trial de 30 dias
   - O payment method é coletado mas não é cobrado durante o trial
4. **Após completar checkout** → Redireciona para `/subscription/success?session_id=xxx`
5. **Página de sucesso detecta** que usuário não está autenticado
6. **Mostra formulário de criação de senha** pré-preenchido com email do Stripe
7. **Usuário cria senha** → Sistema cria conta e vincula subscription automaticamente
8. **Usuário é redirecionado para dashboard** no modo trial

**Vantagens deste fluxo:**
- ✅ Usuário pode iniciar trial sem criar conta primeiro
- ✅ Fluxo mais simples e direto
- ✅ Subscription é automaticamente vinculada quando conta é criada
- ✅ Trial de 30 dias configurado no Stripe (nos prices)

**Configuração Necessária no Stripe Dashboard:**

1. **Configurar Trial Period nos Prices:**
   - Vá em **Products** → Selecione cada produto
   - Para cada price (monthly/yearly), configure **Trial period: 30 days**
   - Isso garante que todas as subscriptions tenham 30 dias de trial

2. **Configurar Success URL no Pricing Table:**
   - Vá em **Products** → **Pricing Tables** → Selecione sua tabela
   - Configure **After the payment** → **Redirect to a URL**
   - URL: `https://sparefinance.com/subscription/success?session_id={CHECKOUT_SESSION_ID}`
   - Para desenvolvimento: `http://localhost:3000/subscription/success?session_id={CHECKOUT_SESSION_ID}`

3. **Verificar Webhook:**
   - O webhook `checkout.session.completed` e `customer.subscription.created` já estão configurados
   - Eles lidam corretamente com subscriptions criadas sem userId
   - A subscription será vinculada quando o usuário criar a conta

**Fluxo Alternativo (Usuário Autenticado):**

Se o usuário já estiver autenticado quando clicar no Pricing Table:
1. **Stripe Checkout abre** (email já preenchido se `customer-email` foi passado)
2. **Usuário completa checkout** → Redireciona para `/subscription/success?session_id=xxx`
3. **Página de sucesso detecta** que usuário está autenticado
4. **Sincroniza subscription automaticamente** via webhook
5. **Mostra mensagem de sucesso** e botões para Dashboard/Billing

**Importante:** 
- O Stripe Checkout **deve** estar configurado para passar `session_id` na URL de retorno
- A Success URL deve ser: `https://sparefinance.com/subscription/success?session_id={CHECKOUT_SESSION_ID}`
- O Stripe automaticamente substitui `{CHECKOUT_SESSION_ID}` pelo ID real da sessão
- O trial period deve estar configurado nos prices no Stripe Dashboard (30 dias)

## Vantagens do Stripe Pricing Table

1. **Gerenciamento centralizado**: Todos os planos são gerenciados no Stripe Dashboard
2. **Atualizações automáticas**: Mudanças nos planos no Stripe são refletidas automaticamente
3. **UI consistente**: Interface padronizada do Stripe
4. **Menos código**: Não precisa manter sincronização entre banco e Stripe

## Desvantagens

1. **Menos customização**: UI limitada às opções do Stripe
2. **Dependência do Stripe**: Se o Stripe estiver fora do ar, a página de pricing não funciona

## Importante

O sistema foi configurado para usar 100% o Stripe Pricing Table. Todas as integrações customizadas de planos foram removidas para simplificar o código e centralizar o gerenciamento no Stripe Dashboard.

## Troubleshooting

### Pricing Table não aparece

1. Verifique se `NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID` está configurado corretamente
2. Verifique se `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` está configurado
3. Verifique o console do navegador para erros
4. Certifique-se de que o Pricing Table está ativo no Stripe Dashboard

### Erro de CORS ou CSP

O `next.config.ts` já está configurado para permitir:
- Scripts do Stripe (`https://js.stripe.com`)
- Frames do Stripe (`https://checkout.stripe.com`)

Se ainda houver problemas, verifique as configurações de CSP no `next.config.ts`.

## Referências

- [Stripe Pricing Table Documentation](https://stripe.com/docs/payments/checkout/pricing-table)
- [Stripe Dashboard - Pricing Tables](https://dashboard.stripe.com/pricing-tables)

