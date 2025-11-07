# Dashboard - Fontes de Dados

Este documento descreve todas as fontes de dados do dashboard e confirma que **tudo vem do Supabase**.

## Estrutura do Dashboard

O dashboard é carregado através de `app/dashboard/data-loader.tsx`, que busca todos os dados em paralelo usando funções de API que consultam diretamente o Supabase.

## Fontes de Dados

### 1. Transações (`getTransactions`)
- **Arquivo**: `lib/api/transactions.ts`
- **Tabela Supabase**: `Transaction`
- **Uso no Dashboard**:
  - Transações do mês selecionado
  - Transações do mês anterior (para comparação)
  - Transações dos últimos 6 meses (para gráficos)
- **Relacionamentos**: Inclui `Account`, `Category`, `Subcategory`

### 2. Investimentos (`getTotalInvestmentsValue`)
- **Arquivo**: `lib/api/simple-investments.ts`
- **Tabelas Supabase**: 
  - `Account` (filtro por tipo "investment")
  - `AccountInvestmentValue`
  - `SimpleInvestmentEntry`
- **Uso no Dashboard**: Valor total de investimentos (exibido no card "Savings/Investments")

### 3. Orçamentos (`getBudgets`)
- **Arquivo**: `lib/api/budgets.ts`
- **Tabelas Supabase**:
  - `Budget`
  - `Category`
  - `Macro`
  - `BudgetCategory`
  - `Transaction` (para calcular gasto real)
- **Uso no Dashboard**: Gráfico de execução de orçamentos

### 4. Transações Futuras (`getUpcomingTransactions`)
- **Arquivo**: `lib/api/transactions.ts`
- **Tabelas Supabase**:
  - `Transaction` (transações recorrentes)
  - `Debt` (pagamentos de dívidas)
  - `Account`, `Category`, `Subcategory`
- **Uso no Dashboard**: Lista de transações futuras

### 5. Saúde Financeira (`calculateFinancialHealth`)
- **Arquivo**: `lib/api/financial-health.ts`
- **Tabela Supabase**: `Transaction` (via `getTransactionsInternal`)
- **Uso no Dashboard**: Widget de saúde financeira com score, classificação, alertas e sugestões
- **Cálculo**: Baseado em receitas e despesas do mês selecionado

### 6. Metas (`getGoals`)
- **Arquivo**: `lib/api/goals.ts`
- **Tabelas Supabase**:
  - `Goal`
  - `Transaction` (para calcular base de renda)
- **Uso no Dashboard**: Visão geral de metas financeiras

### 7. Contas (`getAccounts`)
- **Arquivo**: `lib/api/accounts.ts`
- **Tabelas Supabase**:
  - `Account`
  - `Transaction` (para calcular saldos)
  - `AccountOwner`
  - `User`
- **Uso no Dashboard**: 
  - Cálculo do saldo total (contas checking + savings)
  - Cálculo do saldo do mês anterior

## Cálculos Locais

Alguns cálculos são feitos localmente usando dados do Supabase:

1. **Saldo Total**: Soma dos saldos de contas checking e savings
   - Os saldos são calculados em `getAccounts()` usando `initialBalance` + transações do Supabase

2. **Saldo do Mês Anterior**: Calculado em `data-loader.tsx`
   - Busca todas as transações até o final do mês anterior
   - Calcula o saldo de cada conta baseado em `initialBalance` + transações

3. **Receitas/Despesas do Mês**: Calculado em `summary-cards.tsx`
   - Filtra transações do mês selecionado
   - Soma receitas e despesas separadamente

4. **Dados dos Gráficos**: Processados localmente
   - `CashFlowSection`: Agrupa transações por mês
   - `ChartsSection`: Agrupa despesas por categoria

## Cache

As funções de API usam `unstable_cache` do Next.js para otimizar performance:
- Cache de 30-60 segundos dependendo do tipo de dado
- Tags de revalidação para invalidar cache quando necessário
- Tokens de autenticação passados via cookies

## Conclusão

✅ **Todas as informações do dashboard vêm do Supabase**
- Nenhuma fonte de dados hardcoded
- Nenhuma referência a Prisma ou outros bancos de dados
- Todos os cálculos usam dados do Supabase como base

## Verificação

Para verificar que tudo está funcionando:
1. Todas as funções em `lib/api/*.ts` usam `createServerClient()` do Supabase
2. Todas fazem queries diretas nas tabelas do Supabase
3. Nenhuma referência a Prisma ou mock data no dashboard

