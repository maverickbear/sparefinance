-- ============================================================================
-- QUERIES DE TESTE PARA TABELAS DO SUPABASE
-- ============================================================================
-- Este arquivo contém queries SQL para testar cada tabela do banco de dados
-- Execute cada seção no Supabase Dashboard SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. TABELA: User
-- ============================================================================

-- 1.1 Contar total de usuários
SELECT COUNT(*) as total_users FROM "User";

-- 1.2 Listar todos os usuários (limitado a 10)
SELECT 
  id, 
  email, 
  name, 
  role, 
  "createdAt", 
  "updatedAt"
FROM "User"
ORDER BY "createdAt" DESC
LIMIT 10;

-- 1.3 Verificar usuários por role
SELECT 
  role, 
  COUNT(*) as count
FROM "User"
GROUP BY role
ORDER BY count DESC;

-- 1.4 Verificar integridade: usuários sem email
SELECT COUNT(*) as users_without_email
FROM "User"
WHERE email IS NULL OR email = '';

-- 1.5 Verificar usuários recentes
SELECT 
  id, 
  email, 
  "createdAt"
FROM "User"
WHERE "createdAt" > NOW() - INTERVAL '30 days'
ORDER BY "createdAt" DESC;

-- ============================================================================
-- 2. TABELA: Account
-- ============================================================================

-- 2.1 Contar total de contas
SELECT COUNT(*) as total_accounts FROM "Account";

-- 2.2 Listar contas com informações básicas
SELECT 
  id, 
  name, 
  type, 
  "userId", 
  "isConnected",
  "createdAt"
FROM "Account"
ORDER BY "createdAt" DESC
LIMIT 20;

-- 2.3 Contar contas por tipo
SELECT 
  type, 
  COUNT(*) as count
FROM "Account"
GROUP BY type
ORDER BY count DESC;

-- 2.4 Verificar contas sem userId (problema de integridade)
SELECT COUNT(*) as accounts_without_user
FROM "Account"
WHERE "userId" IS NULL;

-- 2.5 Verificar contas conectadas vs desconectadas
SELECT 
  "isConnected", 
  COUNT(*) as count
FROM "Account"
GROUP BY "isConnected";

-- 2.6 Verificar contas com Plaid
SELECT 
  COUNT(*) as plaid_accounts,
  COUNT(DISTINCT "plaidItemId") as unique_plaid_items
FROM "Account"
WHERE "plaidItemId" IS NOT NULL;

-- ============================================================================
-- 3. TABELA: AccountOwner
-- ============================================================================

-- 3.1 Contar total de relacionamentos account-owner
SELECT COUNT(*) as total_account_owners FROM "AccountOwner";

-- 3.2 Listar relacionamentos
SELECT 
  ao.id,
  ao."accountId",
  a.name as account_name,
  ao."ownerId",
  u.email as owner_email,
  ao."createdAt"
FROM "AccountOwner" ao
LEFT JOIN "Account" a ON ao."accountId" = a.id
LEFT JOIN "User" u ON ao."ownerId" = u.id
ORDER BY ao."createdAt" DESC
LIMIT 20;

-- 3.3 Verificar contas com múltiplos owners
SELECT 
  "accountId",
  COUNT(*) as owner_count
FROM "AccountOwner"
GROUP BY "accountId"
HAVING COUNT(*) > 1
ORDER BY owner_count DESC;

-- ============================================================================
-- 4. TABELA: Transaction
-- ============================================================================

-- 4.1 Contar total de transações
SELECT COUNT(*) as total_transactions FROM "Transaction";

-- 4.2 Listar transações recentes
SELECT 
  id,
  date,
  type,
  amount,
  "accountId",
  "categoryId",
  "subcategoryId",
  description,
  "userId",
  "createdAt"
FROM "Transaction"
ORDER BY date DESC
LIMIT 20;

-- 4.3 Contar transações por tipo
SELECT 
  type, 
  COUNT(*) as count,
  SUM(CAST(amount AS numeric)) as total_amount
FROM "Transaction"
GROUP BY type
ORDER BY count DESC;

-- 4.4 Verificar transações sem userId (problema de integridade)
SELECT COUNT(*) as transactions_without_user
FROM "Transaction"
WHERE "userId" IS NULL;

-- 4.5 Transações por mês
SELECT 
  DATE_TRUNC('month', date) as month,
  COUNT(*) as transaction_count,
  SUM(CAST(amount AS numeric)) as total_amount
FROM "Transaction"
GROUP BY DATE_TRUNC('month', date)
ORDER BY month DESC
LIMIT 12;

-- 4.6 Verificar transações recorrentes
SELECT 
  COUNT(*) as recurring_count,
  COUNT(*) FILTER (WHERE recurring = true) as is_recurring
FROM "Transaction";

-- 4.7 Transações sem categoria
SELECT 
  COUNT(*) as transactions_without_category,
  ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM "Transaction"), 0), 2) as percentage
FROM "Transaction"
WHERE "categoryId" IS NULL;

-- ============================================================================
-- 5. TABELA: Budget
-- ============================================================================

-- 5.1 Contar total de orçamentos
SELECT COUNT(*) as total_budgets FROM "Budget";

-- 5.2 Listar orçamentos
SELECT 
  id,
  period,
  amount,
  "categoryId",
  "subcategoryId",
  "macroId",
  "userId",
  note,
  "createdAt"
FROM "Budget"
ORDER BY period DESC, "createdAt" DESC
LIMIT 20;

-- 5.3 Verificar orçamentos sem userId (problema de integridade)
SELECT COUNT(*) as budgets_without_user
FROM "Budget"
WHERE "userId" IS NULL;

-- 5.4 Orçamentos por período
SELECT 
  DATE_TRUNC('month', period) as month,
  COUNT(*) as budget_count,
  SUM(amount) as total_budget_amount
FROM "Budget"
GROUP BY DATE_TRUNC('month', period)
ORDER BY month DESC
LIMIT 12;

-- 5.5 Verificar orçamentos com valores inválidos
SELECT COUNT(*) as invalid_budgets
FROM "Budget"
WHERE amount <= 0;

-- ============================================================================
-- 6. TABELA: Category
-- ============================================================================

-- 6.1 Contar total de categorias
SELECT COUNT(*) as total_categories FROM "Category";

-- 6.2 Listar categorias
SELECT 
  id,
  name,
  "macroId",
  "userId",
  "createdAt",
  "updatedAt"
FROM "Category"
ORDER BY "createdAt" DESC
LIMIT 20;

-- 6.3 Categorias do sistema vs do usuário
SELECT 
  CASE WHEN "userId" IS NULL THEN 'System' ELSE 'User' END as category_type,
  COUNT(*) as count
FROM "Category"
GROUP BY CASE WHEN "userId" IS NULL THEN 'System' ELSE 'User' END;

-- 6.4 Categorias por grupo (macro)
SELECT 
  g.name as group_name,
  COUNT(c.id) as category_count
FROM "Category" c
LEFT JOIN "Group" g ON c."macroId" = g.id
GROUP BY g.name
ORDER BY category_count DESC;

-- ============================================================================
-- 7. TABELA: Subcategory
-- ============================================================================

-- 7.1 Contar total de subcategorias
SELECT COUNT(*) as total_subcategories FROM "Subcategory";

-- 7.2 Listar subcategorias
SELECT 
  s.id,
  s.name,
  s."categoryId",
  c.name as category_name,
  s."userId",
  s.logo,
  s."createdAt"
FROM "Subcategory" s
LEFT JOIN "Category" c ON s."categoryId" = c.id
ORDER BY s."createdAt" DESC
LIMIT 20;

-- 7.3 Subcategorias por categoria
SELECT 
  c.name as category_name,
  COUNT(s.id) as subcategory_count
FROM "Category" c
LEFT JOIN "Subcategory" s ON c.id = s."categoryId"
GROUP BY c.name
ORDER BY subcategory_count DESC
LIMIT 20;

-- 7.4 Verificar subcategorias órfãs (sem categoria válida)
SELECT COUNT(*) as orphaned_subcategories
FROM "Subcategory" s
LEFT JOIN "Category" c ON s."categoryId" = c.id
WHERE c.id IS NULL;

-- ============================================================================
-- 8. TABELA: Group
-- ============================================================================

-- 8.1 Contar total de grupos
SELECT COUNT(*) as total_groups FROM "Group";

-- 8.2 Listar grupos
SELECT 
  id,
  name,
  type,
  "userId",
  "createdAt",
  "updatedAt"
FROM "Group"
ORDER BY "createdAt" DESC
LIMIT 20;

-- 8.3 Grupos do sistema vs do usuário
SELECT 
  CASE WHEN "userId" IS NULL THEN 'System' ELSE 'User' END as group_type,
  type,
  COUNT(*) as count
FROM "Group"
GROUP BY 
  CASE WHEN "userId" IS NULL THEN 'System' ELSE 'User' END,
  type
ORDER BY group_type, type;

-- ============================================================================
-- 9. TABELA: Debt
-- ============================================================================

-- 9.1 Contar total de dívidas
SELECT COUNT(*) as total_debts FROM "Debt";

-- 9.2 Listar dívidas
SELECT 
  id,
  name,
  "loanType",
  "initialAmount",
  "currentBalance",
  "interestRate",
  "monthlyPayment",
  "isPaidOff",
  "isPaused",
  "userId",
  "createdAt"
FROM "Debt"
ORDER BY "createdAt" DESC
LIMIT 20;

-- 9.3 Verificar dívidas sem userId (problema de integridade)
SELECT COUNT(*) as debts_without_user
FROM "Debt"
WHERE "userId" IS NULL;

-- 9.4 Dívidas por tipo
SELECT 
  "loanType",
  COUNT(*) as count,
  SUM("currentBalance") as total_balance,
  AVG("interestRate") as avg_interest_rate
FROM "Debt"
WHERE "isPaidOff" = false
GROUP BY "loanType"
ORDER BY count DESC;

-- 9.5 Dívidas pagas vs não pagas
SELECT 
  "isPaidOff",
  COUNT(*) as count,
  SUM("currentBalance") as total_balance
FROM "Debt"
GROUP BY "isPaidOff";

-- ============================================================================
-- 10. TABELA: Goal
-- ============================================================================

-- 10.1 Contar total de metas
SELECT COUNT(*) as total_goals FROM "Goal";

-- 10.2 Listar metas
SELECT 
  id,
  name,
  "targetAmount",
  "currentBalance",
  "isCompleted",
  "isPaused",
  priority,
  "userId",
  "createdAt"
FROM "Goal"
ORDER BY "createdAt" DESC
LIMIT 20;

-- 10.3 Verificar metas sem userId (problema de integridade)
SELECT COUNT(*) as goals_without_user
FROM "Goal"
WHERE "userId" IS NULL;

-- 10.4 Metas completadas vs não completadas
SELECT 
  "isCompleted",
  COUNT(*) as count,
  SUM("targetAmount") as total_target,
  SUM("currentBalance") as total_current
FROM "Goal"
GROUP BY "isCompleted";

-- 10.5 Metas por prioridade
SELECT 
  priority,
  COUNT(*) as count,
  AVG("targetAmount") as avg_target
FROM "Goal"
WHERE "isCompleted" = false
GROUP BY priority
ORDER BY 
  CASE priority
    WHEN 'High' THEN 1
    WHEN 'Medium' THEN 2
    WHEN 'Low' THEN 3
  END;

-- ============================================================================
-- 11. TABELA: Subscription
-- ============================================================================

-- 11.1 Contar total de assinaturas
SELECT COUNT(*) as total_subscriptions FROM "Subscription";

-- 11.2 Listar assinaturas
SELECT 
  id,
  "userId",
  "planId",
  status,
  "stripeSubscriptionId",
  "currentPeriodStart",
  "currentPeriodEnd",
  "cancelAtPeriodEnd",
  "trialEndDate",
  "createdAt"
FROM "Subscription"
ORDER BY "createdAt" DESC
LIMIT 20;

-- 11.3 Assinaturas por status
SELECT 
  status,
  COUNT(*) as count
FROM "Subscription"
GROUP BY status
ORDER BY count DESC;

-- 11.4 Assinaturas em trial
SELECT 
  COUNT(*) as active_trials,
  COUNT(*) FILTER (WHERE "trialEndDate" > NOW()) as active_trials_count
FROM "Subscription"
WHERE "trialEndDate" IS NOT NULL;

-- 11.5 Assinaturas pendentes (sem userId)
SELECT COUNT(*) as pending_subscriptions
FROM "Subscription"
WHERE "userId" IS NULL;

-- ============================================================================
-- 12. TABELA: Plan
-- ============================================================================

-- 12.1 Contar total de planos
SELECT COUNT(*) as total_plans FROM "Plan";

-- 12.2 Listar planos
SELECT 
  id,
  name,
  "priceMonthly",
  "priceYearly",
  "stripeProductId",
  "createdAt",
  "updatedAt"
FROM "Plan"
ORDER BY "priceMonthly" ASC;

-- 12.3 Verificar planos sem preço
SELECT COUNT(*) as plans_without_price
FROM "Plan"
WHERE "priceMonthly" = 0 AND "priceYearly" = 0;

-- ============================================================================
-- 13. TABELA: InvestmentAccount
-- ============================================================================

-- 13.1 Contar total de contas de investimento
SELECT COUNT(*) as total_investment_accounts FROM "InvestmentAccount";

-- 13.2 Listar contas de investimento
SELECT 
  id,
  name,
  type,
  "userId",
  "isQuestradeConnected",
  "questradeAccountNumber",
  cash,
  "marketValue",
  "totalEquity",
  "createdAt"
FROM "InvestmentAccount"
ORDER BY "createdAt" DESC
LIMIT 20;

-- 13.3 Verificar contas sem userId (problema de integridade)
SELECT COUNT(*) as investment_accounts_without_user
FROM "InvestmentAccount"
WHERE "userId" IS NULL;

-- 13.4 Contas conectadas vs desconectadas
SELECT 
  "isQuestradeConnected",
  COUNT(*) as count,
  SUM(COALESCE("totalEquity", 0)) as total_equity
FROM "InvestmentAccount"
GROUP BY "isQuestradeConnected";

-- ============================================================================
-- 14. TABELA: Security
-- ============================================================================

-- 14.1 Contar total de securities
SELECT COUNT(*) as total_securities FROM "Security";

-- 14.2 Listar securities
SELECT 
  id,
  symbol,
  name,
  class,
  sector,
  "createdAt"
FROM "Security"
ORDER BY symbol
LIMIT 20;

-- 14.3 Securities por classe
SELECT 
  class,
  COUNT(*) as count
FROM "Security"
GROUP BY class
ORDER BY count DESC;

-- 14.4 Securities por setor
SELECT 
  sector,
  COUNT(*) as count
FROM "Security"
WHERE sector IS NOT NULL
GROUP BY sector
ORDER BY count DESC;

-- ============================================================================
-- 15. TABELA: Position
-- ============================================================================

-- 15.1 Contar total de posições
SELECT COUNT(*) as total_positions FROM "Position";

-- 15.2 Listar posições
SELECT 
  p.id,
  p."accountId",
  ia.name as account_name,
  p."securityId",
  s.symbol,
  s.name as security_name,
  p."openQuantity",
  p."currentMarketValue",
  p."currentPrice",
  p."averageEntryPrice",
  p."openPnl",
  p."lastUpdatedAt"
FROM "Position" p
LEFT JOIN "InvestmentAccount" ia ON p."accountId" = ia.id
LEFT JOIN "Security" s ON p."securityId" = s.id
ORDER BY p."currentMarketValue" DESC
LIMIT 20;

-- 15.3 Valor total de posições por conta
SELECT 
  ia.name as account_name,
  COUNT(p.id) as position_count,
  SUM(p."currentMarketValue") as total_market_value
FROM "Position" p
LEFT JOIN "InvestmentAccount" ia ON p."accountId" = ia.id
GROUP BY ia.name
ORDER BY total_market_value DESC;

-- ============================================================================
-- 16. TABELA: TransactionSync
-- ============================================================================

-- 16.1 Contar total de sincronizações
SELECT COUNT(*) as total_syncs FROM "TransactionSync";

-- 16.2 Listar sincronizações recentes
SELECT 
  id,
  "accountId",
  "plaidTransactionId",
  "transactionId",
  status,
  "syncDate"
FROM "TransactionSync"
ORDER BY "syncDate" DESC
LIMIT 20;

-- 16.3 Sincronizações por status
SELECT 
  status,
  COUNT(*) as count
FROM "TransactionSync"
GROUP BY status
ORDER BY count DESC;

-- 16.4 Verificar sincronizações órfãs (sem transactionId)
SELECT 
  COUNT(*) as orphaned_syncs,
  ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM "TransactionSync"), 0), 2) as percentage
FROM "TransactionSync"
WHERE "transactionId" IS NULL;

-- ============================================================================
-- 17. TABELA: PlaidConnection
-- ============================================================================

-- 17.1 Contar total de conexões Plaid
SELECT COUNT(*) as total_plaid_connections FROM "PlaidConnection";

-- 17.2 Listar conexões
SELECT 
  id,
  "userId",
  "institutionId",
  "institutionName",
  "errorCode",
  "errorMessage",
  "createdAt",
  "updatedAt"
FROM "PlaidConnection"
ORDER BY "createdAt" DESC
LIMIT 20;

-- 17.3 Conexões com erro
SELECT 
  COUNT(*) as connections_with_errors,
  COUNT(DISTINCT "errorCode") as unique_error_codes
FROM "PlaidConnection"
WHERE "errorCode" IS NOT NULL;

-- ============================================================================
-- 18. TABELA: QuestradeConnection
-- ============================================================================

-- 18.1 Contar total de conexões Questrade
SELECT COUNT(*) as total_questrade_connections FROM "QuestradeConnection";

-- 18.2 Listar conexões
SELECT 
  id,
  "userId",
  "apiServerUrl",
  "tokenExpiresAt",
  "lastSyncedAt",
  "createdAt"
FROM "QuestradeConnection"
ORDER BY "createdAt" DESC
LIMIT 20;

-- 18.3 Verificar tokens expirados
SELECT 
  COUNT(*) as expired_tokens,
  COUNT(*) FILTER (WHERE "tokenExpiresAt" < NOW()) as currently_expired
FROM "QuestradeConnection";

-- ============================================================================
-- 19. TABELA: ContactForm
-- ============================================================================

-- 19.1 Contar total de formulários de contato
SELECT COUNT(*) as total_contact_forms FROM "ContactForm";

-- 19.2 Listar formulários recentes
SELECT 
  id,
  "userId",
  name,
  email,
  subject,
  status,
  "createdAt"
FROM "ContactForm"
ORDER BY "createdAt" DESC
LIMIT 20;

-- 19.3 Formulários por status
SELECT 
  status,
  COUNT(*) as count
FROM "ContactForm"
GROUP BY status
ORDER BY count DESC;

-- ============================================================================
-- 20. TABELA: Feedback
-- ============================================================================

-- 20.1 Contar total de feedbacks
SELECT COUNT(*) as total_feedbacks FROM "Feedback";

-- 20.2 Listar feedbacks recentes
SELECT 
  id,
  "userId",
  rating,
  feedback,
  "createdAt"
FROM "Feedback"
ORDER BY "createdAt" DESC
LIMIT 20;

-- 20.3 Distribuição de ratings
SELECT 
  rating,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM "Feedback"), 0), 2) as percentage
FROM "Feedback"
GROUP BY rating
ORDER BY rating DESC;

-- 20.4 Rating médio
SELECT 
  AVG(rating) as avg_rating,
  COUNT(*) as total_feedbacks
FROM "Feedback";

-- ============================================================================
-- 21. TABELA: HouseholdMember
-- ============================================================================

-- 21.1 Contar total de membros de household
SELECT COUNT(*) as total_household_members FROM "HouseholdMember";

-- 21.2 Listar membros
SELECT 
  id,
  "ownerId",
  "memberId",
  email,
  name,
  status,
  role,
  "invitedAt",
  "acceptedAt"
FROM "HouseholdMember"
ORDER BY "invitedAt" DESC
LIMIT 20;

-- 21.3 Membros por status
SELECT 
  status,
  COUNT(*) as count
FROM "HouseholdMember"
GROUP BY status
ORDER BY count DESC;

-- 21.4 Membros pendentes (não aceitos)
SELECT 
  COUNT(*) as pending_members,
  COUNT(*) FILTER (WHERE "acceptedAt" IS NULL) as not_accepted
FROM "HouseholdMember"
WHERE status = 'pending';

-- ============================================================================
-- 22. TABELA: PromoCode
-- ============================================================================

-- 22.1 Contar total de códigos promocionais
SELECT COUNT(*) as total_promo_codes FROM "PromoCode";

-- 22.2 Listar códigos
SELECT 
  id,
  code,
  "discountType",
  "discountValue",
  duration,
  "isActive",
  "expiresAt",
  "maxRedemptions",
  "createdAt"
FROM "PromoCode"
ORDER BY "createdAt" DESC
LIMIT 20;

-- 22.3 Códigos ativos vs inativos
SELECT 
  "isActive",
  COUNT(*) as count
FROM "PromoCode"
GROUP BY "isActive";

-- 22.4 Códigos expirados
SELECT 
  COUNT(*) as expired_codes,
  COUNT(*) FILTER (WHERE "expiresAt" < NOW()) as currently_expired
FROM "PromoCode"
WHERE "expiresAt" IS NOT NULL;

-- ============================================================================
-- 23. QUERIES DE INTEGRIDADE E RELACIONAMENTOS
-- ============================================================================

-- 23.1 Verificar foreign keys órfãs - Transactions sem Account válida
SELECT COUNT(*) as orphaned_transactions
FROM "Transaction" t
LEFT JOIN "Account" a ON t."accountId" = a.id
WHERE a.id IS NULL;

-- 23.2 Verificar foreign keys órfãs - Transactions sem User válido
SELECT COUNT(*) as transactions_without_valid_user
FROM "Transaction" t
LEFT JOIN "User" u ON t."userId" = u.id
WHERE u.id IS NULL;

-- 23.3 Verificar foreign keys órfãs - Budgets sem User válido
SELECT COUNT(*) as budgets_without_valid_user
FROM "Budget" b
LEFT JOIN "User" u ON b."userId" = u.id
WHERE u.id IS NULL;

-- 23.4 Verificar foreign keys órfãs - Debts sem User válido
SELECT COUNT(*) as debts_without_valid_user
FROM "Debt" d
LEFT JOIN "User" u ON d."userId" = u.id
WHERE u.id IS NULL;

-- 23.5 Verificar foreign keys órfãs - Goals sem User válido
SELECT COUNT(*) as goals_without_valid_user
FROM "Goal" g
LEFT JOIN "User" u ON g."userId" = u.id
WHERE u.id IS NULL;

-- 23.6 Verificar foreign keys órfãs - Subcategories sem Category válida
SELECT COUNT(*) as orphaned_subcategories
FROM "Subcategory" s
LEFT JOIN "Category" c ON s."categoryId" = c.id
WHERE c.id IS NULL;

-- 23.7 Verificar foreign keys órfãs - Categories sem Group válido
SELECT COUNT(*) as orphaned_categories
FROM "Category" c
LEFT JOIN "Group" g ON c."macroId" = g.id
WHERE g.id IS NULL;

-- ============================================================================
-- 24. QUERIES DE ESTATÍSTICAS GERAIS
-- ============================================================================

-- 24.1 Estatísticas gerais do banco
SELECT 
  'Users' as table_name, COUNT(*) as row_count FROM "User"
UNION ALL
SELECT 'Accounts', COUNT(*) FROM "Account"
UNION ALL
SELECT 'Transactions', COUNT(*) FROM "Transaction"
UNION ALL
SELECT 'Budgets', COUNT(*) FROM "Budget"
UNION ALL
SELECT 'Categories', COUNT(*) FROM "Category"
UNION ALL
SELECT 'Subcategories', COUNT(*) FROM "Subcategory"
UNION ALL
SELECT 'Debts', COUNT(*) FROM "Debt"
UNION ALL
SELECT 'Goals', COUNT(*) FROM "Goal"
UNION ALL
SELECT 'Subscriptions', COUNT(*) FROM "Subscription"
UNION ALL
SELECT 'InvestmentAccounts', COUNT(*) FROM "InvestmentAccount"
ORDER BY row_count DESC;

-- 24.2 Usuários mais ativos (por número de transações)
SELECT 
  u.email,
  u.name,
  COUNT(t.id) as transaction_count,
  SUM(CAST(t.amount AS numeric)) as total_amount
FROM "User" u
LEFT JOIN "Transaction" t ON u.id = t."userId"
GROUP BY u.id, u.email, u.name
ORDER BY transaction_count DESC
LIMIT 10;

-- 24.3 Contas mais usadas
SELECT 
  a.name,
  a.type,
  COUNT(t.id) as transaction_count,
  SUM(CAST(t.amount AS numeric)) as total_amount
FROM "Account" a
LEFT JOIN "Transaction" t ON a.id = t."accountId"
GROUP BY a.id, a.name, a.type
ORDER BY transaction_count DESC
LIMIT 10;

-- ============================================================================
-- 25. QUERIES DE PERFORMANCE E ÍNDICES
-- ============================================================================

-- 25.1 Verificar índices existentes na tabela Transaction
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'Transaction'
ORDER BY indexname;

-- 25.2 Verificar índices existentes na tabela Account
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'Account'
ORDER BY indexname;

-- 25.3 Verificar tamanho das tabelas
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;

-- ============================================================================
-- FIM DAS QUERIES DE TESTE
-- ============================================================================

