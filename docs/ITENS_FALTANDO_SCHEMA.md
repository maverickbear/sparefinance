# Itens que Podem Estar Faltando no Documento SCHEMA_TABELAS_E_RELACOES.md

## Análise Completa

Após revisão detalhada, identifiquei os seguintes itens que **poderiam** ser adicionados ao documento para torná-lo mais completo:

---

## 1. Funções SQL Importantes ⚠️ (RECOMENDADO)

O documento não menciona as funções SQL críticas do sistema. Estas funções são usadas pela aplicação e são importantes para entender o comportamento do sistema:

### Funções de Transações:
- **`create_transaction_with_limit`**: Cria transações atomicamente com verificação de limite mensal
- **`create_transfer_with_limit`**: Cria transferências atomicamente com verificação de limite (conta como 1 transação)
- **`increment_transaction_count`**: Incrementa contador de transações mensais (usado internamente)

### Funções de PlannedPayment:
- **`convert_planned_payment_to_transaction`**: Converte PlannedPayment em Transaction quando pago (idempotente)

### Funções de Portfolio:
- **`refresh_portfolio_views`**: Atualiza todas as views materializadas de portfolio (executada via cron/API)
- **`get_latest_updates`**: Retorna timestamp da última atualização de cada tabela para um usuário (usado pelo endpoint check-updates)

### Funções de Permissões:
- **`is_account_owner_by_userid`**: Verifica se usuário é dono da conta via userId
- **`is_account_owner_via_accountowner`**: Verifica se usuário é dono via tabela AccountOwner
- **`is_current_user_admin`**: Verifica se usuário atual é admin/super_admin
- **`check_invitation_email_match`**: Verifica se email do convite corresponde ao usuário autenticado

### Funções de Triggers:
- **`notify_refresh_holdings`**: Trigger function que notifica mudanças em investimentos
- **`update_updated_at_column`**: Trigger function que atualiza campo updatedAt automaticamente

**Recomendação:** Adicionar uma seção "Funções SQL Importantes" no documento.

---

## 2. Triggers ⚠️ (RECOMENDADO)

O documento não menciona os triggers que automatizam comportamentos:

### Triggers de Notificação:
- **`trigger_notify_holdings_refresh`**: Dispara após INSERT/UPDATE/DELETE em InvestmentTransaction
- **`trigger_notify_price_refresh`**: Dispara após INSERT/UPDATE em SecurityPrice

### Triggers de Atualização Automática:
- **`update_plan_updated_at`**: Atualiza updatedAt em Plan
- **`update_promo_code_updated_at`**: Atualiza updatedAt em PromoCode
- **`update_subscription_updated_at`**: Atualiza updatedAt em Subscription
- **`update_user_updated_at`**: Atualiza updatedAt em User

**Recomendação:** Adicionar uma seção "Triggers" ou mencionar na seção de "Notas Importantes".

---

## 3. Constraints de Validação (OPCIONAL)

Alguns constraints importantes que garantem integridade dos dados:

### Account:
- `Account_type_check`: Valida tipos permitidos (cash, checking, savings, credit, investment, other)

### Budget:
- `budget_amount_positive`: Garante que amount > 0

### Debt:
- Múltiplos constraints validando valores positivos, ranges de datas, tipos permitidos, etc.

### InvestmentTransaction:
- `check_buy_sell_fields`: Garante que buy/sell tenham quantity e price válidos
- `check_security_required`: Garante que buy/sell/dividend/interest tenham securityId

### Transaction:
- `transaction_date_valid`: Valida range de datas (1900 até 1 ano no futuro)

### PlannedPayment:
- Múltiplos constraints validando status, source, type, etc.

**Recomendação:** Opcional - pode ser mencionado brevemente na seção de cada tabela ou em uma nota geral.

---

## 4. Índices Importantes (OPCIONAL)

O documento não menciona índices, mas alguns são críticos para performance:

### Índices de Performance:
- `idx_transaction_user_date_type`: Índice composto para queries de transações
- `idx_transaction_user_updated`: Índice para queries de atualizações recentes
- `transaction_description_search_trgm_idx`: Índice GIN para busca full-text em descrições
- `user_monthly_usage_user_month_idx`: Índice único para verificação rápida de limites
- Vários índices em UserServiceSubscription para queries frequentes

**Recomendação:** Opcional - pode ser mencionado em uma nota sobre performance.

---

## 5. Primary Keys e Unique Constraints (OPCIONAL)

O documento não menciona explicitamente as primary keys, mas isso pode ser útil:

- Todas as tabelas têm primary keys (geralmente `id`)
- Algumas têm unique constraints (ex: AccountOwner tem unique em accountId+ownerId)
- AccountInvestmentValue tem unique em accountId (relação 1:1)

**Recomendação:** Opcional - pode ser mencionado brevemente ou assumido como padrão.

---

## 6. Relação com auth.users (PODERIA SER MAIS CLARA)

O documento menciona que User está vinculada a `auth.users`, mas poderia ser mais explícito:

- User.id é FK para auth.users.id
- User é criado automaticamente quando usuário se registra no Supabase Auth
- Deletar em auth.users cascade para User

**Recomendação:** Melhorar a descrição da tabela User.

---

## 7. Campos de Timestamp Automáticos (OPCIONAL)

Muitas tabelas têm `createdAt` e `updatedAt` que são atualizados automaticamente:

- `createdAt`: Definido no INSERT
- `updatedAt`: Atualizado via trigger `update_updated_at_column` em algumas tabelas

**Recomendação:** Opcional - pode ser mencionado em uma nota geral.

---

## 8. Comportamento de CASCADE em Foreign Keys (OPCIONAL)

O documento não menciona explicitamente o comportamento de CASCADE/SET NULL nas FKs:

- DELETE CASCADE: Quando User é deletado, todas as contas são deletadas
- DELETE SET NULL: Quando Category é deletada, Transaction.categoryId vira NULL
- UPDATE CASCADE: Quando Account.id muda, todas as referências são atualizadas

**Recomendação:** Opcional - pode ser mencionado brevemente ou assumido como padrão.

---

## Resumo de Prioridades

### 🔴 Alta Prioridade (Recomendado adicionar):
1. **Funções SQL Importantes** - Essenciais para entender como o sistema funciona
2. **Triggers** - Importantes para entender comportamentos automáticos

### 🟡 Média Prioridade (Opcional, mas útil):
3. **Constraints de Validação** - Útil para desenvolvedores entenderem regras de negócio
4. **Relação com auth.users** - Melhorar descrição

### 🟢 Baixa Prioridade (Opcional):
5. **Índices** - Mais técnico, pode ser documentado separadamente
6. **Primary Keys** - Assumido como padrão
7. **Campos de Timestamp** - Assumido como padrão
8. **Comportamento CASCADE** - Assumido como padrão

---

## Sugestão de Estrutura para Adicionar

```markdown
## Funções SQL Importantes

### Funções de Transações
- `create_transaction_with_limit`: ...
- `create_transfer_with_limit`: ...

### Funções de Portfolio
- `refresh_portfolio_views`: ...

## Triggers

### Triggers de Notificação
- `trigger_notify_holdings_refresh`: ...

### Triggers de Atualização Automática
- `update_updated_at_column`: Usado em Plan, PromoCode, Subscription, User
```

---

**Data da análise:** Janeiro 2025

