# Usuários de Teste para Cenários de Subscription

Este documento lista os usuários de teste criados para validar cada cenário de subscription documentado em `SUBSCRIPTION_SCENARIOS.md`.

---

## 🚀 Como Criar Usuários de Teste

Execute o script para criar todos os usuários de teste:

```bash
npx tsx scripts/create-test-users.ts
```

**Requisitos:**
- Variáveis de ambiente configuradas:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

**Nota:** O script usa a service role key para criar usuários diretamente no Supabase Auth, bypassando RLS.

---

## 📋 Usuários de Teste

### 1. INÍCIO DE TRIAL
- **Email:** `trial-start@test.com`
- **Password:** `Test123!@#`
- **Status:** `trialing`
- **Plano:** Basic
- **Trial:** Iniciado hoje, expira em 14 dias
- **Uso:** Testar início de trial e acesso completo durante trial

---

### 2. TRIAL ATIVO
- **Email:** `trial-active@test.com`
- **Password:** `Test123!@#`
- **Status:** `trialing`
- **Plano:** Premium
- **Trial:** Iniciado há 5 dias, expira em 9 dias
- **Uso:** Testar acesso durante trial ativo

---

### 3. EXPIRAÇÃO DO TRIAL (sem payment method)
- **Email:** `trial-expired@test.com`
- **Password:** `Test123!@#`
- **Status:** `trialing` (mas `trialEndDate` passou)
- **Plano:** Basic
- **Trial:** Iniciado há 15 dias, expirou há 1 dia
- **Uso:** Testar comportamento quando trial expira sem payment method
- **Comportamento esperado:** 
  - Acesso permitido (visualização)
  - Operações de escrita bloqueadas
  - Banner de upgrade deve aparecer

---

### 4. ASSINATURA PAGA (CHECKOUT)
- **Email:** `checkout-paid@test.com`
- **Password:** `Test123!@#`
- **Status:** `active`
- **Plano:** Premium
- **Período:** Iniciado hoje, renova em 30 dias
- **Uso:** Testar subscription paga ativa

---

### 5. RENOVAÇÃO AUTOMÁTICA
- **Email:** `auto-renewal@test.com`
- **Password:** `Test123!@#`
- **Status:** `active`
- **Plano:** Basic
- **Período:** Iniciado há 30 dias, renova em 1 dia
- **Uso:** Testar subscription próxima da renovação

---

### 6. FALHA NO PAGAMENTO
- **Email:** `payment-failed@test.com`
- **Password:** `Test123!@#`
- **Status:** `past_due`
- **Plano:** Premium
- **Período:** Iniciado há 10 dias, venceu há 5 dias
- **Uso:** Testar comportamento quando pagamento falha
- **Comportamento esperado:**
  - Acesso permitido (visualização)
  - Operações de escrita bloqueadas
  - Modal de upgrade deve aparecer

---

### 7. CANCELAMENTO NO FINAL DO PERÍODO
- **Email:** `cancel-end-period@test.com`
- **Password:** `Test123!@#`
- **Status:** `active` + `cancelAtPeriodEnd: true`
- **Plano:** Basic
- **Período:** Iniciado há 20 dias, termina em 10 dias
- **Uso:** Testar cancelamento agendado
- **Comportamento esperado:**
  - Acesso completo até fim do período
  - Operações de escrita permitidas

---

### 8. CANCELAMENTO IMEDIATO
- **Email:** `cancel-immediate@test.com`
- **Password:** `Test123!@#`
- **Status:** `cancelled`
- **Plano:** Premium
- **Período:** Iniciado há 10 dias, terminaria em 20 dias (mas cancelado)
- **Uso:** Testar cancelamento imediato
- **Comportamento esperado:**
  - Acesso permitido (visualização)
  - Operações de escrita bloqueadas
  - Banner de upgrade deve aparecer

---

### 9. TROCA DE PLANO
- **Email:** `plan-change@test.com`
- **Password:** `Test123!@#`
- **Status:** `active`
- **Plano:** Basic
- **Período:** Iniciado hoje, renova em 30 dias
- **Uso:** Testar troca de plano (upgrade/downgrade)
- **Nota:** Usuário pode fazer upgrade para Premium ou downgrade

---

### 10. SEM SUBSCRIPTION
- **Email:** `no-subscription@test.com`
- **Password:** `Test123!@#`
- **Status:** Nenhuma subscription
- **Uso:** Testar usuário novo sem subscription
- **Comportamento esperado:**
  - Modal de seleção de plano deve aparecer
  - Acesso bloqueado até selecionar plano

---

## 🧪 Checklist de Testes

Para cada usuário, verificar:

- [ ] Login funciona com email e senha
- [ ] Status de subscription está correto
- [ ] Acesso às rotas protegidas funciona conforme esperado
- [ ] Operações de escrita (criar/editar) funcionam ou são bloqueadas conforme status
- [ ] Banner de upgrade aparece quando necessário
- [ ] Modal de upgrade aparece quando necessário
- [ ] UI reflete corretamente o status da subscription

---

## 🔄 Atualizar Usuários de Teste

Se precisar atualizar os usuários de teste:

1. **Deletar usuários existentes:**
   ```sql
   -- No Supabase SQL Editor
   DELETE FROM "Subscription" WHERE "userId" IN (
     SELECT id FROM "User" WHERE email LIKE '%@test.com'
   );
   DELETE FROM "HouseholdMember" WHERE email LIKE '%@test.com';
   DELETE FROM "User" WHERE email LIKE '%@test.com';
   -- Depois deletar do Supabase Auth Dashboard
   ```

2. **Executar script novamente:**
   ```bash
   npx tsx scripts/create-test-users.ts
   ```

---

## ⚠️ Notas Importantes

1. **Senhas:** Todos os usuários usam a mesma senha `Test123!@#` para facilitar testes
2. **Emails:** Todos os emails terminam com `@test.com` para fácil identificação
3. **Service Role:** O script usa service role key, então bypassa RLS
4. **Stripe:** Os usuários não têm subscriptions reais no Stripe (apenas no banco)
5. **Household Members:** Todos os usuários são owners (não membros de household)

---

## 🐛 Troubleshooting

### Erro: "Missing Supabase environment variables"
- Verifique se `.env.local` tem `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`

### Erro: "Failed to create auth user"
- Verifique se o email já existe no Supabase Auth
- Delete o usuário do Supabase Auth Dashboard antes de recriar

### Erro: "Failed to create subscription"
- Verifique se os planos `basic` e `premium` existem na tabela `Plan`
- Execute a migration de seed de planos se necessário

### Usuário criado mas não consegue fazer login
- Verifique se o email foi confirmado (script auto-confirma)
- Tente resetar a senha no Supabase Auth Dashboard

---

**Última atualização:** Janeiro 2025

