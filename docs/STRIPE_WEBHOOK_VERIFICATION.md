# Verificação de Webhooks do Stripe

## Implementação Atual

Nossa implementação de webhooks segue as melhores práticas recomendadas pela documentação oficial do Stripe:

### ✅ Verificação de Assinatura

- **Localização**: `app/api/stripe/webhook/route.ts`
- **Método**: Usa `stripe.webhooks.constructEvent()` que verifica:
  1. A assinatura é válida (prova que veio do Stripe)
  2. O timestamp é recente (prevenção de replay attacks)
  3. Tolerância padrão: 5 minutos (recomendado para produção)

### ✅ Retorno Rápido 2xx

- O endpoint retorna `200 OK` **antes** de processar a lógica complexa
- O processamento assíncrono acontece após o retorno
- Isso previne timeouts e garante que o Stripe receba confirmação rápida

### ✅ Processamento Assíncrono

- Após retornar 2xx, o evento é processado em `handleWebhookEvent()`
- Isso permite processar eventos complexos sem risco de timeout
- Logs detalhados para debugging

## Eventos Tratados

1. **`checkout.session.completed`**: Quando checkout é concluído
2. **`customer.subscription.created`**: Quando subscription é criada
3. **`customer.subscription.updated`**: Quando subscription é atualizada
4. **`customer.subscription.deleted`**: Quando subscription é cancelada
5. **`invoice.payment_succeeded`**: Quando pagamento de invoice é bem-sucedido
6. **`invoice.payment_failed`**: Quando pagamento de invoice falha

## Segurança

### Prevenção de Replay Attacks

O Stripe inclui um timestamp no header `Stripe-Signature`. O método `constructEvent()` verifica automaticamente que o timestamp não é muito antigo (tolerância padrão: 5 minutos).

### Verificação de IP (Opcional)

A documentação do Stripe menciona que você pode verificar os IPs de origem, mas isso é **opcional** se você já está verificando a assinatura. A verificação de assinatura é mais segura e recomendada.

## Referências

- [Stripe Webhooks Documentation](https://docs.stripe.com/webhooks)
- [Webhook Signature Verification](https://docs.stripe.com/webhooks/signatures)
- [Best Practices](https://docs.stripe.com/webhooks/best-practices)

