# Schema do Banco de Dados - Tabelas e Relações

Este documento descreve todas as tabelas existentes no Supabase, suas funções e as relações entre elas.

## Índice

1. [Tabelas Principais](#tabelas-principais)
2. [Tabelas de Investimentos](#tabelas-de-investimentos)
3. [Tabelas de Integração](#tabelas-de-integração)
4. [Tabelas de Sistema](#tabelas-de-sistema)
5. [Tabelas de Agregação](#tabelas-de-agregação)
6. [Funções SQL Importantes](#funções-sql-importantes)
7. [Triggers](#triggers)
8. [Diagrama de Relações](#diagrama-de-relações)

---

## Tabelas Principais

### User
**Descrição:** Armazena informações dos usuários do sistema. Está vinculada à tabela `auth.users` do Supabase Auth.

**Nota importante:** 
- `id` é uma Foreign Key para `auth.users.id` (ON DELETE CASCADE)
- Quando um usuário se registra no Supabase Auth, um registro correspondente deve ser criado nesta tabela
- Quando um usuário é deletado do `auth.users`, o registro correspondente nesta tabela é deletado automaticamente (CASCADE)

**Campos principais:**
- `id` (UUID): ID do usuário (FK para `auth.users`)
- `email`: Email do usuário
- `name`: Nome do usuário
- `role`: Papel do usuário (admin, super_admin, etc.)
- `avatarUrl`: URL do avatar
- `phoneNumber`: Telefone
- `dateOfBirth`: Data de nascimento

**Relações:**
- Referenciada por: Account, Budget, Category, Debt, Goal, Group, HouseholdMember, InvestmentAccount, PlaidConnection, QuestradeConnection, Subscription, UserServiceSubscription, ContactForm, Feedback, Transaction, Subcategory, category_learning, user_monthly_usage

---

### Account
**Descrição:** Representa contas bancárias e financeiras do usuário (corrente, poupança, cartão de crédito, investimento, etc.).

**Campos principais:**
- `id` (text): ID único da conta
- `name`: Nome da conta
- `type`: Tipo (cash, checking, savings, credit, investment, other)
- `userId`: ID do usuário proprietário
- `initialBalance`: Saldo inicial
- `creditLimit`: Limite de crédito (para cartões)
- `plaidAccountId`: ID da conta no Plaid (integração bancária)
- `isConnected`: Se está conectada via Plaid
- `dueDayOfMonth`: Dia de vencimento da fatura (cartões)

**Relações:**
- **Pertence a:** User (userId)
- **Tem muitos:** Transaction, PlannedPayment, Debt, Goal, AccountOwner, AccountInvestmentValue, PlaidLiability, TransactionSync, SimpleInvestmentEntry, InvestmentAccount, InvestmentTransaction

---

### Transaction
**Descrição:** Armazena todas as transações financeiras (receitas, despesas e transferências).

**Campos principais:**
- `id` (text): ID único
- `date`: Data da transação
- `type`: Tipo (expense, income, transfer)
- `amount`: Valor (criptografado)
- `amount_numeric`: Valor numérico (para agregações)
- `accountId`: Conta relacionada
- `categoryId`: Categoria atribuída (opcional)
- `subcategoryId`: Subcategoria atribuída (opcional)
- `suggestedCategoryId`: Categoria sugerida pelo sistema (opcional)
- `suggestedSubcategoryId`: Subcategoria sugerida pelo sistema (opcional)
- `description`: Descrição
- `description_search`: Descrição normalizada para busca
- `tags`: Tags da transação
- `recurring`: Se é recorrente
- `transferToId` / `transferFromId`: IDs para transferências
- `expenseType`: Tipo de despesa (fixed/variable)
- `plaidMetadata`: Metadados do Plaid (JSONB)

**Relações:**
- **Pertence a:** Account (accountId), User (userId)
- **Pode ter:** Category (categoryId), Subcategory (subcategoryId)
- **Pode ter (sugeridas):** Category (suggestedCategoryId), Subcategory (suggestedSubcategoryId)
- **Referenciada por:** PlannedPayment (linkedTransactionId), TransactionSync (transactionId)

---

### Category
**Descrição:** Categorias de transações (ex: Alimentação, Transporte, Salário).

**Campos principais:**
- `id` (text): ID único
- `name`: Nome da categoria
- `groupId`: Grupo ao qual pertence (income/expense)
- `userId`: ID do usuário (opcional, para categorias personalizadas)

**Relações:**
- **Pertence a:** Group (groupId), User (userId - opcional)
- **Tem muitos:** Subcategory, Transaction, Budget, PlannedPayment, BudgetCategory

---

### Subcategory
**Descrição:** Subcategorias dentro de categorias (ex: Restaurante dentro de Alimentação).

**Campos principais:**
- `id` (text): ID único
- `name`: Nome da subcategoria
- `categoryId`: Categoria pai
- `userId`: ID do usuário (opcional)
- `logo`: URL do logo/imagem

**Relações:**
- **Pertence a:** Category (categoryId), User (userId - opcional)
- **Referenciada por:** Transaction, Budget, PlannedPayment, UserServiceSubscription, category_learning

---

### Group
**Descrição:** Grupos de categorias (income ou expense).

**Campos principais:**
- `id` (text): ID único
- `name`: Nome do grupo
- `type`: Tipo (income ou expense)
- `userId`: ID do usuário

**Relações:**
- **Pertence a:** User (userId)
- **Tem muitos:** Category, Budget

---

### Budget
**Descrição:** Orçamentos definidos pelos usuários para categorias/subcategorias em períodos específicos.

**Campos principais:**
- `id` (text): ID único
- `period`: Período do orçamento
- `categoryId`: Categoria (opcional)
- `subcategoryId`: Subcategoria (opcional)
- `amount`: Valor do orçamento
- `groupId`: Grupo relacionado
- `userId`: ID do usuário
- `isRecurring`: Se é recorrente mensalmente

**Relações:**
- **Pertence a:** User (userId), Group (groupId)
- **Pode ter:** Category (categoryId) OU Subcategory (subcategoryId) - não ambos simultaneamente
- **Tem muitos:** BudgetCategory (relação muitos-para-muitos com Category)

---

### BudgetCategory
**Descrição:** Tabela de junção entre Budget e Category (relação muitos-para-muitos).

**Relações:**
- **Pertence a:** Budget (budgetId), Category (categoryId)

---

### Debt
**Descrição:** Dívidas e empréstimos do usuário (hipoteca, empréstimo de carro, cartão de crédito, etc.).

**Campos principais:**
- `id` (text): ID único
- `name`: Nome da dívida
- `loanType`: Tipo (mortgage, car_loan, personal_loan, credit_card, student_loan, etc.)
- `initialAmount`: Valor inicial
- `currentBalance`: Saldo atual
- `interestRate`: Taxa de juros
- `monthlyPayment`: Pagamento mensal
- `accountId`: Conta relacionada (opcional)
- `userId`: ID do usuário
- `status`: Status (active, closed)
- `nextDueDate`: Próxima data de vencimento

**Relações:**
- **Pertence a:** User (userId)
- **Pode ter:** Account (accountId)
- **Referenciada por:** PlannedPayment (debtId)

---

### Goal
**Descrição:** Metas financeiras dos usuários (ex: economizar para viagem, comprar casa).

**Campos principais:**
- `id` (text): ID único
- `name`: Nome da meta
- `targetAmount`: Valor alvo
- `currentBalance`: Saldo atual
- `incomePercentage`: Porcentagem da renda
- `isCompleted`: Se foi completada
- `userId`: ID do usuário
- `accountId`: Conta relacionada (opcional)
- `priority`: Prioridade (High, Medium, Low)

**Relações:**
- **Pertence a:** User (userId)
- **Pode ter:** Account (accountId)

---

### PlannedPayment
**Descrição:** Pagamentos planejados futuros que se tornarão Transactions quando pagos. Não afetam saldos de contas.

**Campos principais:**
- `id` (text): ID único
- `date`: Data do pagamento
- `type`: Tipo (expense, income, transfer)
- `amount`: Valor
- `accountId`: Conta de origem
- `toAccountId`: Conta de destino (para transferências)
- `categoryId`: Categoria (opcional)
- `subcategoryId`: Subcategoria (opcional)
- `status`: Status (scheduled, paid, skipped, cancelled)
- `source`: Origem (recurring, debt, manual, subscription)
- `linkedTransactionId`: ID da Transaction quando convertido
- `debtId`: ID da dívida (se originado de uma dívida)
- `subscriptionId`: ID da assinatura (se originado de uma assinatura)

**Relações:**
- **Pertence a:** User (userId), Account (accountId)
- **Pode ter:** Account (toAccountId), Category (categoryId), Subcategory (subcategoryId), Debt (debtId), UserServiceSubscription (subscriptionId), Transaction (linkedTransactionId)

---

### UserServiceSubscription
**Descrição:** Assinaturas de serviços recorrentes que automaticamente criam Planned Payments.

**Campos principais:**
- `id` (text): ID único
- `userId`: ID do usuário
- `serviceName`: Nome do serviço
- `amount`: Valor
- `billingFrequency`: Frequência (monthly, weekly, biweekly, semimonthly, daily)
- `billingDay`: Dia do mês ou dia da semana
- `accountId`: Conta para débito
- `subcategoryId`: Subcategoria relacionada (opcional)
- `firstBillingDate`: Data do primeiro pagamento
- `isActive`: Se está ativa

**Relações:**
- **Pertence a:** User (userId), Account (accountId)
- **Pode ter:** Subcategory (subcategoryId)
- **Referenciada por:** PlannedPayment (subscriptionId)

---

### HouseholdMember
**Descrição:** Membros de um household (família/compartilhamento de contas).

**Campos principais:**
- `id` (UUID): ID único
- `ownerId`: ID do proprietário do household
- `memberId`: ID do membro (quando aceito)
- `email`: Email do membro
- `name`: Nome do membro
- `status`: Status (pending, active, declined)
- `role`: Papel (member)
- `invitationToken`: Token de convite

**Relações:**
- **Pertence a:** User (ownerId), User (memberId - opcional)

---

### AccountOwner
**Descrição:** Tabela de junção para múltiplos proprietários de uma conta (compartilhamento).

**Relações:**
- **Pertence a:** Account (accountId), User (ownerId)

---

## Tabelas de Investimentos

### InvestmentAccount
**Descrição:** Contas de investimento (conectadas via Questrade ou manuais).

**Campos principais:**
- `id` (text): ID único
- `name`: Nome da conta
- `type`: Tipo da conta
- `userId`: ID do usuário
- `accountId`: Conta relacionada (opcional)
- `questradeConnectionId`: ID da conexão Questrade
- `questradeAccountNumber`: Número da conta Questrade
- `isQuestradeConnected`: Se está conectada ao Questrade
- `cash`: Saldo em dinheiro
- `marketValue`: Valor de mercado das posições
- `totalEquity`: Patrimônio total
- `buyingPower`: Poder de compra
- `currency`: Moeda (padrão: CAD)

**Relações:**
- **Pertence a:** User (userId)
- **Pode ter:** Account (accountId), QuestradeConnection (questradeConnectionId)
- **Tem muitos:** Order, Execution, Position

---

### InvestmentTransaction
**Descrição:** Transações de investimento (compras, vendas, dividendos, juros, transferências).

**Campos principais:**
- `id` (text): ID único
- `date`: Data da transação
- `accountId`: Conta de investimento
- `securityId`: Ativo relacionado (opcional)
- `type`: Tipo (buy, sell, dividend, interest, transfer, deposit, withdrawal)
- `quantity`: Quantidade (para buy/sell)
- `price`: Preço (para buy/sell)
- `fees`: Taxas
- `transferToId` / `transferFromId`: IDs para transferências

**Relações:**
- **Pertence a:** Account (accountId) - referência direta a Account, não a InvestmentAccount
- **Pode ter:** Security (securityId)

**Nota:** InvestmentTransaction referencia Account diretamente (não InvestmentAccount). Na prática, são usadas com Accounts do tipo 'investment'.

---

### Security
**Descrição:** Ativos financeiros (ações, ETFs, etc.).

**Campos principais:**
- `id` (text): ID único
- `symbol`: Símbolo do ativo
- `name`: Nome do ativo
- `class`: Classe do ativo
- `sector`: Setor (Technology, Finance, Healthcare, etc.)

**Relações:**
- **Tem muitos:** SecurityPrice, Candle, InvestmentTransaction, Position

---

### SecurityPrice
**Descrição:** Histórico de preços dos ativos.

**Campos principais:**
- `id` (text): ID único
- `securityId`: ID do ativo
- `date`: Data do preço
- `price`: Preço

**Relações:**
- **Pertence a:** Security (securityId)

---

### Position
**Descrição:** Posições atuais (holdings) de ativos nas contas de investimento (sincronizadas do Questrade).

**Campos principais:**
- `id` (text): ID único
- `accountId`: Conta de investimento
- `securityId`: Ativo
- `openQuantity`: Quantidade aberta
- `closedQuantity`: Quantidade fechada
- `currentMarketValue`: Valor de mercado atual
- `currentPrice`: Preço atual
- `averageEntryPrice`: Preço médio de entrada
- `closedPnl`: Lucro/prejuízo realizado
- `openPnl`: Lucro/prejuízo não realizado

**Relações:**
- **Pertence a:** InvestmentAccount (accountId), Security (securityId)

---

### Order
**Descrição:** Ordens de compra/venda do Questrade.

**Campos principais:**
- `id` (text): ID único
- `accountId`: Conta de investimento
- `questradeOrderId`: ID da ordem no Questrade
- `symbolId`: ID do símbolo
- `symbol`: Símbolo
- `side`: Lado (buy/sell)
- `orderType`: Tipo de ordem
- `state`: Estado da ordem
- `totalQuantity`: Quantidade total
- `filledQuantity`: Quantidade preenchida

**Relações:**
- **Pertence a:** InvestmentAccount (accountId)

---

### Execution
**Descrição:** Execuções de ordens do Questrade.

**Campos principais:**
- `id` (text): ID único
- `accountId`: Conta de investimento
- `questradeExecutionId`: ID da execução no Questrade
- `orderId`: ID da ordem
- `symbol`: Símbolo
- `quantity`: Quantidade executada
- `price`: Preço de execução
- `totalCost`: Custo total
- `commission`: Comissão

**Relações:**
- **Pertence a:** InvestmentAccount (accountId)

---

### Candle
**Descrição:** Dados históricos de preços (candles) do Questrade.

**Campos principais:**
- `id` (text): ID único
- `securityId`: ID do ativo
- `symbolId`: ID do símbolo
- `start` / `end`: Período do candle
- `open` / `high` / `low` / `close`: Preços OHLC
- `volume`: Volume
- `interval`: Intervalo (1min, 5min, 1hour, etc.)

**Relações:**
- **Pertence a:** Security (securityId)

---

### SimpleInvestmentEntry
**Descrição:** Entradas simples de investimento (não conectadas ao Questrade).

**Relações:**
- **Pertence a:** Account (accountId)

---

### AccountInvestmentValue
**Descrição:** Valor total de investimento por conta.

**Relações:**
- **Pertence a:** Account (accountId) - relação 1:1

---

## Tabelas de Integração

### PlaidConnection
**Descrição:** Conexões com bancos via Plaid (integração bancária).

**Campos principais:**
- `id` (text): ID único
- `userId`: ID do usuário
- `itemId`: ID do item no Plaid
- `accessToken`: Token de acesso (criptografado)
- `institutionId`: ID da instituição
- `institutionName`: Nome da instituição
- `errorCode` / `errorMessage`: Erros de sincronização

**Relações:**
- **Pertence a:** User (userId)

---

### PlaidLiability
**Descrição:** Passivos sincronizados do Plaid (cartões de crédito, empréstimos).

**Campos principais:**
- `id` (text): ID único
- `accountId`: Conta relacionada
- `liabilityType`: Tipo (credit_card, student_loan, mortgage, etc.)
- `apr`: APR
- `interestRate`: Taxa de juros
- `minimumPayment`: Pagamento mínimo
- `currentBalance`: Saldo atual
- `availableCredit`: Crédito disponível

**Relações:**
- **Pertence a:** Account (accountId)

---

### QuestradeConnection
**Descrição:** Conexões com Questrade (API de investimentos).

**Campos principais:**
- `id` (text): ID único
- `userId`: ID do usuário
- `accessToken`: Token de acesso (criptografado)
- `refreshToken`: Token de refresh (criptografado)
- `apiServerUrl`: URL do servidor API
- `tokenExpiresAt`: Data de expiração do token

**Relações:**
- **Pertence a:** User (userId)
- **Referenciada por:** InvestmentAccount (questradeConnectionId)

---

### TransactionSync
**Descrição:** Sincronização de transações do Plaid.

**Campos principais:**
- `id` (text): ID único
- `accountId`: Conta
- `plaidTransactionId`: ID da transação no Plaid
- `transactionId`: ID da Transaction criada
- `status`: Status da sincronização

**Relações:**
- **Pertence a:** Account (accountId)
- **Pode ter:** Transaction (transactionId)

---

## Tabelas de Sistema

### Subscription
**Descrição:** Assinaturas de planos do serviço (Stripe).

**Campos principais:**
- `id` (text): ID único
- `userId`: ID do usuário (pode ser NULL para assinaturas pendentes)
- `planId`: ID do plano
- `status`: Status (active, cancelled, etc.)
- `stripeSubscriptionId`: ID no Stripe
- `stripeCustomerId`: ID do cliente no Stripe
- `currentPeriodStart` / `currentPeriodEnd`: Período atual
- `trialStartDate` / `trialEndDate`: Período de trial
- `gracePeriodDays`: Dias de graça após expiração

**Relações:**
- **Pertence a:** User (userId - opcional), Plan (planId)

---

### Plan
**Descrição:** Planos de assinatura disponíveis.

**Campos principais:**
- `id` (text): ID único
- `name`: Nome do plano
- `priceMonthly` / `priceYearly`: Preços
- `features`: Features do plano (JSONB)
- `stripePriceIdMonthly` / `stripePriceIdYearly`: IDs no Stripe
- `stripeProductId`: ID do produto no Stripe

**Relações:**
- **Tem muitos:** Subscription

---

### PromoCode
**Descrição:** Códigos promocionais de desconto.

**Campos principais:**
- `id` (text): ID único
- `code`: Código promocional
- `discountType`: Tipo (percent, fixed)
- `discountValue`: Valor do desconto
- `duration`: Duração (once, forever, repeating)
- `expiresAt`: Data de expiração
- `isActive`: Se está ativo
- `planIds`: IDs dos planos aplicáveis (JSONB)

---

### SystemSettings
**Descrição:** Configurações do sistema (modo de manutenção, etc.).

**Campos principais:**
- `id` (text): ID único
- `maintenanceMode`: Se está em modo de manutenção

**Acesso:** Apenas super_admin pode ler/escrever.

---

### ContactForm
**Descrição:** Formulários de contato dos usuários.

**Campos principais:**
- `id` (UUID): ID único
- `userId`: ID do usuário (opcional)
- `name` / `email` / `subject` / `message`: Dados do formulário
- `status`: Status (pending, read, replied, resolved)
- `adminNotes`: Notas do admin

**Relações:**
- **Pode ter:** User (userId)

---

### Feedback
**Descrição:** Feedback e avaliações dos usuários.

**Campos principais:**
- `id` (UUID): ID único
- `userId`: ID do usuário
- `rating`: Avaliação (1-5)
- `feedback`: Texto do feedback

**Relações:**
- **Pertence a:** User (userId)

---

## Tabelas de Agregação

### category_learning
**Descrição:** Dados agregados de aprendizado de categorias para sugestões rápidas. Substitui a varredura de 12 meses de transações.

**Campos principais:**
- `user_id`: ID do usuário
- `normalized_description`: Descrição normalizada
- `type`: Tipo (expense, income)
- `category_id`: Categoria mais usada
- `subcategory_id`: Subcategoria mais usada
- `description_and_amount_count`: Contagem de uso com mesmo valor
- `description_only_count`: Contagem de uso com qualquer valor
- `last_used_at`: Última vez usado

**Relações:**
- **Pertence a:** User (user_id), Category (category_id)
- **Pode ter:** Subcategory (subcategory_id)

---

### user_monthly_usage
**Descrição:** Contagem agregada mensal de transações por usuário. Usado para verificação rápida de limites sem queries COUNT(*).

**Campos principais:**
- `user_id`: ID do usuário
- `month_date`: Primeiro dia do mês (ex: 2025-01-01)
- `transactions_count`: Número de transações no mês

**Relações:**
- **Pertence a:** User (user_id)

**Nota:** Para transferências, conta como 1 transação (não 2).

---

## Funções SQL Importantes

O banco de dados possui várias funções SQL que são essenciais para o funcionamento do sistema:

### Funções de Transações

#### `create_transaction_with_limit`
**Descrição:** Cria uma transação atomicamente com verificação de limite mensal de transações.

**Parâmetros principais:**
- `p_user_id`: ID do usuário
- `p_date`: Data da transação
- `p_type`: Tipo (expense, income)
- `p_amount`: Valor (criptografado)
- `p_amount_numeric`: Valor numérico
- `p_max_transactions`: Limite máximo (-1 para ilimitado)

**Retorna:** JSONB com `transaction_id` e `new_count` (contagem atual)

**Comportamento:** Verifica limite, incrementa contador e cria transação em uma única operação atômica.

---

#### `create_transfer_with_limit`
**Descrição:** Cria uma transferência (2 transações) atomicamente com verificação de limite.

**Parâmetros principais:**
- `p_user_id`: ID do usuário
- `p_from_account_id`: Conta de origem
- `p_to_account_id`: Conta de destino
- `p_amount`: Valor
- `p_max_transactions`: Limite máximo

**Retorna:** JSONB com `outgoing_id`, `incoming_id` e `new_count`

**Comportamento:** Cria 2 transações (outgoing e incoming) mas conta como 1 transação para limites.

---

#### `increment_transaction_count`
**Descrição:** Incrementa atomicamente o contador de transações mensais de um usuário.

**Uso:** Função interna usada por `create_transaction_with_limit` e `create_transfer_with_limit`.

---

### Funções de PlannedPayment

#### `convert_planned_payment_to_transaction`
**Descrição:** Converte um PlannedPayment em Transaction quando pago.

**Parâmetros:**
- `p_planned_payment_id`: ID do PlannedPayment

**Retorna:** ID da Transaction criada

**Comportamento:** 
- Idempotente - se já foi convertido, retorna a Transaction existente
- Cria Transaction e atualiza status do PlannedPayment para 'paid'
- Vincula PlannedPayment à Transaction via `linkedTransactionId`

---

### Funções de Portfolio

#### `refresh_portfolio_views`
**Descrição:** Atualiza todas as views materializadas de portfolio.

**Comportamento:**
- Atualiza `holdings_view` (CONCURRENTLY)
- Atualiza `portfolio_summary_view` (CONCURRENTLY)
- Atualiza `asset_allocation_view`
- Atualiza `sector_allocation_view`

**Uso:** 
- Executada via cron job ou API endpoint
- **⚠️ PROBLEMA ATUAL:** Esta função **não é chamada automaticamente** quando transações são deletadas ou modificadas
- Quando um usuário deleta uma transação de investimento, os dados continuam aparecendo nas views até que esta função seja chamada manualmente
- **Solução recomendada:** Chamar esta função após operações de DELETE/UPDATE em InvestmentTransaction, ou implementar um listener que capture as notificações do trigger e atualize as views automaticamente

---

#### `get_latest_updates`
**Descrição:** Retorna timestamp da última atualização de cada tabela para um usuário.

**Parâmetros:**
- `p_user_id`: ID do usuário

**Retorna:** Tabela com `table_name` e `last_update` (timestamp em milissegundos)

**Tabelas verificadas:** Transaction, Account, Budget, Goal, Debt, SimpleInvestmentEntry

**Uso:** Usado pelo endpoint `check-updates` para sincronização incremental.

---

### Funções de Permissões

#### `is_account_owner_by_userid`
**Descrição:** Verifica se o usuário autenticado é dono da conta via campo `userId` da Account.

**Uso:** Usado em políticas RLS.

---

#### `is_account_owner_via_accountowner`
**Descrição:** Verifica se o usuário autenticado é dono da conta via tabela AccountOwner.

**Uso:** Usado em políticas RLS para contas compartilhadas.

---

#### `is_current_user_admin`
**Descrição:** Verifica se o usuário autenticado é admin ou super_admin.

**Retorna:** boolean

**Uso:** Usado em políticas RLS para acesso administrativo.

---

#### `check_invitation_email_match`
**Descrição:** Verifica se o email do convite corresponde ao email do usuário autenticado.

**Uso:** Usado para validar convites de HouseholdMember.

---

## Triggers

O sistema possui triggers que automatizam comportamentos importantes:

### Triggers de Notificação

#### `trigger_notify_holdings_refresh`
**Tabela:** InvestmentTransaction
**Evento:** AFTER INSERT, UPDATE, DELETE
**Função:** `notify_refresh_holdings()`

**Comportamento:** 
- Envia notificação PostgreSQL (`pg_notify('refresh_holdings', 'refresh_needed')`) quando há mudanças em transações de investimento
- **⚠️ IMPORTANTE:** Este trigger **apenas notifica**, mas **NÃO atualiza as views materializadas automaticamente**
- As views (`holdings_view`, `portfolio_summary_view`, etc.) continuam com dados antigos até que `refresh_portfolio_views()` seja chamada manualmente
- A notificação pode ser capturada por um background worker ou listener para atualizar as views, mas isso precisa ser implementado separadamente

---

#### `trigger_notify_price_refresh`
**Tabela:** SecurityPrice
**Evento:** AFTER INSERT, UPDATE
**Função:** `notify_refresh_holdings()`

**Comportamento:** Envia notificação quando preços de ativos são atualizados.

---

### Triggers de Atualização Automática

#### `update_updated_at_column`
**Função:** `update_updated_at_column()`

**Comportamento:** Atualiza automaticamente o campo `updatedAt` antes de qualquer UPDATE.

**Aplicado em:**
- Plan (`update_plan_updated_at`)
- PromoCode (`update_promo_code_updated_at`)
- Subscription (`update_subscription_updated_at`)
- User (`update_user_updated_at`)

**Nota:** Outras tabelas atualizam `updatedAt` via aplicação ou têm triggers específicos.

---

## Diagrama de Relações

### Hierarquia Principal

```
User (usuário)
├── Account (contas)
│   ├── Transaction (transações)
│   │   ├── Category (categoria)
│   │   │   └── Subcategory (subcategoria)
│   │   └── Subcategory (subcategoria)
│   ├── PlannedPayment (pagamentos planejados)
│   │   ├── Category / Subcategory
│   │   ├── Debt (dívida)
│   │   └── UserServiceSubscription (assinatura)
│   ├── Debt (dívida)
│   ├── Goal (meta)
│   ├── AccountOwner (proprietários)
│   └── InvestmentAccount (conta de investimento)
│       ├── InvestmentTransaction (transações de investimento)
│       │   └── Security (ativo)
│       ├── Order (ordens)
│       ├── Execution (execuções)
│       └── Position (posições)
│           └── Security (ativo)
├── Budget (orçamento)
│   ├── Category / Subcategory
│   └── Group (grupo)
│       └── Category
├── Category (categoria)
│   ├── Subcategory (subcategoria)
│   └── Group (grupo)
├── PlaidConnection (integração bancária)
├── QuestradeConnection (integração Questrade)
├── Subscription (assinatura do serviço)
│   └── Plan (plano)
├── HouseholdMember (membros do household)
└── category_learning (agregação)
    └── Category / Subcategory
```

### Relações de Investimentos

```
User
└── InvestmentAccount
    ├── Order (ordens Questrade)
    ├── Execution (execuções Questrade)
    └── Position (posições)
        └── Security (ativo)
            ├── SecurityPrice (preços históricos)
            ├── Candle (dados de candles)
            └── InvestmentTransaction (transações)
```

### Relações de Integração

```
User
├── PlaidConnection
│   └── Account (via plaidAccountId)
│       └── TransactionSync
│           └── Transaction
└── QuestradeConnection
    └── InvestmentAccount
```

---

## Notas Importantes

1. **Segurança (RLS):** Todas as tabelas principais têm Row Level Security (RLS) habilitado, garantindo que usuários só acessem seus próprios dados.

2. **Criptografia:** Alguns campos sensíveis são criptografados (ex: `amount` em Transaction, tokens em conexões).

3. **Views Materializadas:** O sistema usa views materializadas para performance:
   - `holdings_view`: Posições agregadas de investimentos
   - `portfolio_summary_view`: Resumo do portfolio
   - `sector_allocation_view`: Alocação por setor
   - `asset_allocation_view`: Distribuição por tipo de ativo (Stock, ETF, etc.)

   **⚠️ IMPORTANTE - Atualização Manual Necessária:**
   - Views materializadas são "snapshots" dos dados e **NÃO são atualizadas automaticamente** quando você deleta ou modifica transações de investimento
   - Quando você deleta uma transação, o trigger `trigger_notify_holdings_refresh` apenas envia uma notificação PostgreSQL (`pg_notify`), mas **não atualiza as views**
   - Para que os dados deletados desapareçam das views, é necessário chamar manualmente a função `refresh_portfolio_views()`
   - **Solução atual:** A aplicação invalida o cache do Next.js, mas as views materializadas no banco continuam com dados antigos até serem atualizadas manualmente ou via cron job
   - **Recomendação:** Implementar chamada automática de `refresh_portfolio_views()` após operações de DELETE/UPDATE em InvestmentTransaction, ou configurar um cron job para atualizar periodicamente

4. **Views:** O sistema também possui views normais:
   - `vw_transactions_for_reports`: Transações excluindo transferências (usada para cálculos de receita/despesa evitando dupla contagem)

5. **Transferências:** Transferências são representadas por 2 Transactions (outgoing e incoming) ligadas via `transferToId` e `transferFromId`.

6. **PlannedPayment vs Transaction:** PlannedPayments são pagamentos futuros que não afetam saldos. Quando pagos, viram Transactions.

7. **Agregações:** As tabelas `category_learning` e `user_monthly_usage` são atualizadas automaticamente para melhorar performance.

8. **Categorias Sugeridas:** A tabela Transaction possui campos `suggestedCategoryId` e `suggestedSubcategoryId` que armazenam sugestões do sistema baseadas em aprendizado de máquina, permitindo que o usuário aceite ou rejeite as sugestões.

---

**Última atualização:** Janeiro 2025
**Baseado em:** `supabase/schema_reference.sql`

