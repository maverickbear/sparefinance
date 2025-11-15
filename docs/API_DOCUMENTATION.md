# 📡 API Documentation

## 🎯 Overview

This document provides comprehensive documentation for all API endpoints in Spare Finance.

**Base URL**: `/api`  
**Authentication**: Required for all protected routes  
**Format**: JSON

---

## 📋 Table of Contents

- [Authentication](#authentication)
- [Transactions](#transactions)
- [Accounts](#accounts)
- [Budgets](#budgets)
- [Goals](#goals)
- [Debts](#debts)
- [Categories](#categories)
- [Plaid Integration](#plaid-integration)
- [Stripe Integration](#stripe-integration)
- [AI Features](#ai-features)
- [Error Handling](#error-handling)

---

## 🔐 Authentication

All API routes use Supabase Auth. Include the session token in requests:

```typescript
// Client-side (automatic with Supabase client)
const { data, error } = await supabase
  .from('Transaction')
  .select('*')

// Server-side (Next.js API routes)
import { createServerClient } from '@/lib/supabase-server'
const supabase = await createServerClient()
```

---

## 💰 Transactions

### Get Transactions

**Endpoint**: `GET /api/transactions`

**Query Parameters**:
```typescript
{
  startDate?: string      // ISO date
  endDate?: string        // ISO date
  categoryId?: string     // UUID
  accountId?: string      // UUID
  type?: 'income' | 'expense' | 'transfer'
  search?: string        // Search in descriptions
  recurring?: boolean
  page?: number          // Pagination
  limit?: number         // Items per page
}
```

**Response**:
```typescript
{
  transactions: Array<{
    id: string
    date: string
    type: 'income' | 'expense' | 'transfer'
    amount: number
    accountId: string
    categoryId?: string
    subcategoryId?: string
    description?: string
    recurring: boolean
    account?: {
      id: string
      name: string
      type: string
    }
    category?: {
      id: string
      name: string
    }
  }>
  total: number
}
```

**Example**:
```typescript
// Client-side usage
const response = await fetch('/api/transactions?startDate=2024-01-01&endDate=2024-12-31&type=expense')
const { transactions, total } = await response.json()

// Server action usage (recommended)
import { getTransactions } from '@/lib/api/transactions'
const result = await getTransactions({
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  type: 'expense'
})
```

---

### Create Transaction

**Endpoint**: `POST /api/transactions`

**Request Body**:
```typescript
{
  date: string | Date
  type: 'income' | 'expense' | 'transfer'
  amount: number
  accountId: string
  categoryId?: string
  subcategoryId?: string
  description?: string
  recurring?: boolean
  expenseType?: 'fixed' | 'variable'
  toAccountId?: string  // For transfers only
}
```

**Response**:
```typescript
{
  id: string
  date: string
  type: string
  amount: number
  // ... other fields
}
```

**Example**:
```typescript
import { createTransaction } from '@/lib/api/transactions'

const transaction = await createTransaction({
  date: new Date(),
  type: 'expense',
  amount: 50.00,
  accountId: 'account-uuid',
  categoryId: 'category-uuid',
  description: 'Grocery shopping',
  recurring: false
})
```

---

### Update Transaction

**Endpoint**: `PATCH /api/transactions/[id]`

**Request Body**: Partial<TransactionFormData>

**Response**: Updated transaction

**Example**:
```typescript
import { updateTransaction } from '@/lib/api/transactions'

await updateTransaction('transaction-id', {
  amount: 55.00,
  description: 'Grocery shopping (updated)'
})
```

---

### Delete Transaction

**Endpoint**: `DELETE /api/transactions/[id]`

**Response**: `{ success: true }`

**Example**:
```typescript
import { deleteTransaction } from '@/lib/api/transactions'
await deleteTransaction('transaction-id')
```

---

## 🏦 Accounts

### Get Accounts

**Endpoint**: `GET /api/accounts`

**Response**:
```typescript
Array<{
  id: string
  name: string
  type: 'checking' | 'savings' | 'credit' | 'investment'
  balance: number
  initialBalance?: number
  creditLimit?: number
  householdName?: string
  ownerIds: string[]
}>
```

**Example**:
```typescript
import { getAccounts } from '@/lib/api/accounts'
const accounts = await getAccounts()
```

---

### Create Account

**Endpoint**: `POST /api/accounts`

**Request Body**:
```typescript
{
  name: string
  type: 'checking' | 'savings' | 'credit' | 'investment'
  initialBalance?: number
  creditLimit?: number  // For credit accounts
  ownerIds?: string[]   // Household members
}
```

**Example**:
```typescript
import { createAccount } from '@/lib/api/accounts'

const account = await createAccount({
  name: 'Main Checking',
  type: 'checking',
  initialBalance: 1000.00
})
```

---

## 💰 Budgets

### Get Budgets

**Endpoint**: `GET /api/budgets?period=2024-11-01`

**Query Parameters**:
```typescript
{
  period: string  // ISO date (YYYY-MM-DD), default: current month
}
```

**Response**:
```typescript
Array<{
  id: string
  period: string
  amount: number
  categoryId?: string
  macroId?: string
  actualSpend: number
  percentage: number
  status: 'ok' | 'warning' | 'over'
  displayName: string
  category?: {
    id: string
    name: string
    icon: string
  }
}>
```

**Example**:
```typescript
import { getBudgets } from '@/lib/api/budgets'
const budgets = await getBudgets(new Date('2024-11-01'))

// Output example:
// [
//   {
//     id: 'budget-uuid',
//     period: '2024-11-01',
//     amount: 500,
//     actualSpend: 350,
//     percentage: 70,
//     status: 'ok',
//     displayName: 'Groceries',
//     category: { name: 'Food', icon: '🛒' }
//   }
// ]
```

---

### Create Budget

**Endpoint**: `POST /api/budgets`

**Request Body**:
```typescript
{
  period: Date
  categoryId?: string    // Single category
  macroId?: string       // Grouped budget
  categoryIds?: string[] // Multiple categories (for grouped)
  amount: number
}
```

**Validation Rules**:
- `amount` must be > 0
- Either `categoryId`, `macroId`, or `categoryIds` must be provided
- Cannot create duplicate budgets for same category/period

**Example**:
```typescript
import { createBudget } from '@/lib/api/budgets'

// Single category budget
const budget = await createBudget({
  period: new Date('2024-11-01'),
  categoryId: 'category-uuid',
  amount: 500.00
})

// Grouped budget
await createBudget({
  period: new Date('2024-11-01'),
  macroId: 'macro-uuid',
  categoryIds: ['cat1', 'cat2', 'cat3'],
  amount: 2000.00
})
```

---

## 🎯 Goals

### Get Goals

**Endpoint**: `GET /api/goals`

**Response**:
```typescript
Array<{
  id: string
  name: string
  targetAmount: number
  currentBalance: number
  incomePercentage: number
  priority: 'low' | 'medium' | 'high'
  isCompleted: boolean
  isPaused: boolean
}>
```

**Example**:
```typescript
import { getGoals } from '@/lib/api/goals'
const goals = await getGoals()
```

---

## 💳 Debts

### Get Debts

**Endpoint**: `GET /api/debts`

**Response**:
```typescript
Array<{
  id: string
  name: string
  loanType: string
  initialAmount: number
  currentBalance: number
  interestRate: number
  monthlyPayment: number
  isPaidOff: boolean
  isPaused: boolean
}>
```

**Example**:
```typescript
import { getDebts } from '@/lib/api/debts'
const debts = await getDebts()
```

---

## 🏷️ Categories

### Get Categories

**Endpoint**: `GET /api/categories`

**Response**:
```typescript
Array<{
  id: string
  name: string
  macroId: string
  macro: {
    id: string
    name: string
    type: 'income' | 'expense'
  }
}>
```

**Example**:
```typescript
import { getCategories } from '@/lib/api/categories'
const categories = await getCategories()
```

---

## 🏦 Plaid Integration

### Create Link Token

**Endpoint**: `POST /api/plaid/create-link-token`

**Response**:
```typescript
{
  link_token: string
  expiration: string
}
```

**Example**:
```typescript
const response = await fetch('/api/plaid/create-link-token', {
  method: 'POST'
})
const { link_token } = await response.json()
```

---

### Exchange Public Token

**Endpoint**: `POST /api/plaid/exchange-public-token`

**Request Body**:
```typescript
{
  public_token: string
  institution: {
    name: string
    institution_id: string
  }
}
```

**Response**:
```typescript
{
  success: true
  accounts: Array<Account>
}
```

---

### Sync Transactions

**Endpoint**: `POST /api/plaid/sync-transactions`

**Request Body**:
```typescript
{
  itemId: string
}
```

**Response**:
```typescript
{
  added: number
  modified: number
  removed: number
}
```

---

## 💳 Stripe Integration

### Create Checkout Session

**Endpoint**: `POST /api/stripe/create-checkout-session`

**Request Body**:
```typescript
{
  priceId: string
  planId: string
}
```

**Response**:
```typescript
{
  sessionId: string
  url: string
}
```

---

### Create Portal Session

**Endpoint**: `POST /api/stripe/create-portal-session`

**Response**:
```typescript
{
  url: string
}
```

---

## 🤖 AI Features

### Chat

**Endpoint**: `POST /api/ai/chat`

**Request Body**:
```typescript
{
  message: string
  context?: {
    transactions?: Transaction[]
    accounts?: Account[]
  }
}
```

**Response**:
```typescript
{
  response: string
  suggestions?: string[]
}
```

---

### Generate Alerts

**Endpoint**: `POST /api/ai/alerts`

**Request Body**:
```typescript
{
  financialData: {
    income: number
    expenses: number
    savings: number
  }
}
```

**Response**:
```typescript
{
  alerts: Array<{
    type: 'warning' | 'info' | 'critical'
    message: string
    action?: string
  }>
}
```

---

## ⚠️ Error Handling

All API endpoints use consistent error responses:

```typescript
{
  error: {
    message: string
    code: string
    statusCode: number
    details?: unknown
    timestamp: string
  }
}
```

### Error Codes

```typescript
const ERROR_CODES = {
  // Auth
  UNAUTHORIZED: 'UNAUTHORIZED',           // 401
  FORBIDDEN: 'FORBIDDEN',                 // 403
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',   // 400
  INVALID_INPUT: 'INVALID_INPUT',         // 400
  
  // Database
  NOT_FOUND: 'NOT_FOUND',                 // 404
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',     // 409
  
  // Business Logic
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',       // 429
  
  // External Services
  STRIPE_ERROR: 'STRIPE_ERROR',           // 502
  PLAID_ERROR: 'PLAID_ERROR',             // 502
  
  // General
  INTERNAL_ERROR: 'INTERNAL_ERROR',       // 500
}
```

### Example Error Handling

```typescript
import { handleError, AppError } from '@/lib/services/error-handler'

try {
  const result = await someOperation()
  return result
} catch (error) {
  // Logs error and returns formatted response
  return handleError(error, { operation: 'someOperation' })
}
```

---

## 🔄 Rate Limiting

All API routes are rate limited:

```typescript
{
  '/api/*': {
    windowMs: 60000,      // 1 minute
    maxRequests: 100
  },
  '/api/auth/*': {
    windowMs: 900000,     // 15 minutes
    maxRequests: 5
  }
}
```

**Rate Limit Headers**:
- `X-RateLimit-Limit`: Max requests allowed
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Time when limit resets

---

## 📊 Pagination

Endpoints that return lists support pagination:

```typescript
// Request
GET /api/transactions?page=1&limit=50

// Response
{
  data: [...],
  pagination: {
    page: 1,
    limit: 50,
    total: 1000,
    pages: 20
  }
}
```

---

## 🧪 Testing

### Using Postman/Insomnia

1. **Set up authentication**
   ```
   Bearer <your-access-token>
   ```

2. **Base URL**
   ```
   https://your-domain.com/api
   ```

3. **Example request**
   ```bash
   curl -X GET \
     https://your-domain.com/api/transactions \
     -H 'Authorization: Bearer <token>' \
     -H 'Content-Type: application/json'
   ```

### Using TypeScript Client

```typescript
// Recommended: Use server actions
import { getTransactions } from '@/lib/api/transactions'
const result = await getTransactions({ ... })

// Alternative: Direct API call
const response = await fetch('/api/transactions', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
})
const data = await response.json()
```

---

---

## 🎯 Goals API

### Get Goals

**Endpoint**: `GET /api/goals`

**Response**:
```typescript
Array<{
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  targetDate: string
  isCompleted: boolean
  accountId?: string
  account?: {
    id: string
    name: string
  }
}>
```

**Example**:
```typescript
import { getGoals } from '@/lib/api/goals'
const goals = await getGoals()

// Filter incomplete goals
const activeGoals = goals.filter(g => !g.isCompleted)
```

---

### Create Goal

**Endpoint**: `POST /api/goals`

**Request Body**:
```typescript
{
  name: string
  targetAmount: number
  targetDate: Date
  accountId?: string  // Link to savings account
  currentAmount?: number  // Initial progress
}
```

**Validation Rules**:
- `targetAmount` must be > 0
- `name` is required and must be 1-100 characters
- `targetDate` must be in the future

**Example**:
```typescript
import { createGoal } from '@/lib/api/goals'

const goal = await createGoal({
  name: 'Emergency Fund',
  targetAmount: 10000,
  targetDate: new Date('2025-12-31'),
  accountId: 'savings-account-uuid'
})
```

---

### Update Goal

**Endpoint**: `PATCH /api/goals/[id]`

**Request Body**: Partial goal data

**Example**:
```typescript
import { updateGoal } from '@/lib/api/goals'

// Update progress
await updateGoal('goal-id', {
  currentAmount: 5000
})

// Mark as completed
await updateGoal('goal-id', {
  isCompleted: true
})
```

---

### Delete Goal

**Endpoint**: `DELETE /api/goals/[id]`

**Example**:
```typescript
import { deleteGoal } from '@/lib/api/goals'
await deleteGoal('goal-id')
```

---

## 💳 Debts API

### Get Debts

**Endpoint**: `GET /api/debts`

**Response**:
```typescript
Array<{
  id: string
  name: string
  initialAmount: number
  currentAmount: number
  interestRate: number
  minimumPayment: number
  dueDay: number
  isPaidOff: boolean
  accountId?: string
  nextPaymentDate: string
}>
```

**Example**:
```typescript
import { getDebts } from '@/lib/api/debts'
const debts = await getDebts()

// Calculate total debt
const totalDebt = debts
  .filter(d => !d.isPaidOff)
  .reduce((sum, d) => sum + d.currentAmount, 0)
```

---

### Create Debt

**Endpoint**: `POST /api/debts`

**Request Body**:
```typescript
{
  name: string
  initialAmount: number
  currentAmount?: number
  interestRate: number
  minimumPayment: number
  dueDay: number
  accountId?: string
}
```

**Validation Rules**:
- `initialAmount` must be >= 0
- `interestRate` must be >= 0 and <= 100
- `minimumPayment` must be > 0
- `dueDay` must be between 1 and 31

**Example**:
```typescript
import { createDebt } from '@/lib/api/debts'

const debt = await createDebt({
  name: 'Credit Card',
  initialAmount: 5000,
  interestRate: 18.99,
  minimumPayment: 150,
  dueDay: 15,
  accountId: 'credit-account-uuid'
})
```

---

### Record Debt Payment

**Endpoint**: `POST /api/debts/[id]/payment`

**Request Body**:
```typescript
{
  amount: number
  date: Date
  createTransaction?: boolean  // Auto-create transaction
}
```

**Example**:
```typescript
import { recordDebtPayment } from '@/lib/api/debts'

await recordDebtPayment('debt-id', {
  amount: 200,
  date: new Date(),
  createTransaction: true  // Creates expense transaction automatically
})
```

---

## 📁 Categories & Subcategories

### Get Categories

**Endpoint**: `GET /api/categories`

**Query Parameters**:
```typescript
{
  type?: 'income' | 'expense'
  userId?: string  // System or user categories
}
```

**Response**:
```typescript
Array<{
  id: string
  name: string
  icon: string
  type: 'income' | 'expense'
  macroId?: string
  userId?: string
  subcategories?: Array<{
    id: string
    name: string
    icon: string
  }>
}>
```

**Example**:
```typescript
import { getCategories } from '@/lib/api/categories'

// Get all expense categories with subcategories
const expenseCategories = await getCategories({ type: 'expense' })

// Get only user-created categories
const customCategories = expenseCategories.filter(c => c.userId)
```

---

### Create Custom Category

**Endpoint**: `POST /api/categories`

**Request Body**:
```typescript
{
  name: string
  icon: string
  type: 'income' | 'expense'
  macroId?: string
}
```

**Example**:
```typescript
import { createCategory } from '@/lib/api/categories'

const category = await createCategory({
  name: 'Freelance Income',
  icon: '💼',
  type: 'income'
})
```

---

### Create Subcategory

**Endpoint**: `POST /api/subcategories`

**Request Body**:
```typescript
{
  name: string
  icon: string
  categoryId: string
}
```

**Example**:
```typescript
import { createSubcategory } from '@/lib/api/subcategories'

const subcategory = await createSubcategory({
  name: 'Gas',
  icon: '⛽',
  categoryId: 'transportation-category-id'
})
```

---

## 🎨 Common Use Cases

### Use Case 1: Dashboard Summary

```typescript
import { 
  getTransactions, 
  getAccounts, 
  getBudgets 
} from '@/lib/api'
import { 
  calculateTotalIncome, 
  calculateTotalExpenses 
} from '@/lib/services/transaction-calculations'

async function getDashboardData(month: Date) {
  // Parallel data loading
  const [transactions, accounts, budgets] = await Promise.all([
    getTransactions({ 
      startDate: startOfMonth(month), 
      endDate: endOfMonth(month) 
    }),
    getAccounts(),
    getBudgets(month)
  ])

  // Calculate metrics
  const income = calculateTotalIncome(transactions)
  const expenses = calculateTotalExpenses(transactions)
  const netWorth = accounts.reduce((sum, a) => sum + a.balance, 0)

  // Budget progress
  const budgetProgress = budgets.map(b => ({
    name: b.displayName,
    spent: b.actualSpend,
    budget: b.amount,
    percentage: b.percentage,
    status: b.status
  }))

  return {
    income,
    expenses,
    netWorth,
    savingsRate: ((income - expenses) / income) * 100,
    budgetProgress
  }
}
```

---

### Use Case 2: Create Transaction with Validation

```typescript
import { createTransaction } from '@/lib/api/transactions'
import { getAccounts } from '@/lib/api/accounts'
import { AppError, ErrorCode } from '@/lib/services/error-handler'

async function createExpenseWithValidation(data: {
  amount: number
  accountId: string
  categoryId: string
  description: string
}) {
  // Validate account exists and has enough balance
  const accounts = await getAccounts()
  const account = accounts.find(a => a.id === data.accountId)

  if (!account) {
    throw new AppError(
      'Account not found',
      ErrorCode.NOT_FOUND
    )
  }

  if (account.type !== 'credit' && account.balance < data.amount) {
    throw new AppError(
      'Insufficient funds',
      ErrorCode.VALIDATION_ERROR,
      { 
        available: account.balance, 
        required: data.amount 
      }
    )
  }

  // Create transaction
  return await createTransaction({
    type: 'expense',
    date: new Date(),
    ...data
  })
}
```

---

### Use Case 3: Bulk Transaction Import

```typescript
import { createTransaction } from '@/lib/api/transactions'

async function importTransactionsFromCSV(csvData: string) {
  const lines = csvData.split('\n').slice(1) // Skip header
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[]
  }

  for (const line of lines) {
    try {
      const [date, description, amount, category] = line.split(',')
      
      await createTransaction({
        date: new Date(date),
        type: parseFloat(amount) < 0 ? 'expense' : 'income',
        amount: Math.abs(parseFloat(amount)),
        description: description.trim(),
        accountId: 'default-account-id',
        categoryId: category.trim()
      })

      results.success++
    } catch (error) {
      results.failed++
      results.errors.push(`Line "${line}": ${error.message}`)
    }
  }

  return results
}
```

---

### Use Case 4: Budget Tracking with Alerts

```typescript
import { getBudgets } from '@/lib/api/budgets'
import { sendNotification } from '@/lib/api/notifications'

async function checkBudgetAlerts(month: Date) {
  const budgets = await getBudgets(month)
  const alerts = []

  for (const budget of budgets) {
    if (budget.percentage >= 90 && budget.status === 'over') {
      alerts.push({
        type: 'critical',
        message: `Budget exceeded for ${budget.displayName}`,
        detail: `Spent $${budget.actualSpend} of $${budget.amount} budget`
      })

      await sendNotification({
        userId: budget.userId,
        type: 'budget_exceeded',
        title: 'Budget Alert',
        message: `You've exceeded your ${budget.displayName} budget by $${budget.actualSpend - budget.amount}`
      })
    } else if (budget.percentage >= 80 && budget.status === 'warning') {
      alerts.push({
        type: 'warning',
        message: `Approaching budget limit for ${budget.displayName}`,
        detail: `${budget.percentage}% used`
      })
    }
  }

  return alerts
}
```

---

### Use Case 5: Financial Health Score

```typescript
import { getFinancialHealth } from '@/lib/api/financial-health'

async function calculateHealthScore() {
  const health = await getFinancialHealth()

  return {
    score: health.score,
    grade: health.score >= 80 ? 'A' : 
           health.score >= 60 ? 'B' :
           health.score >= 40 ? 'C' : 'D',
    factors: {
      savingsRate: health.savingsRate,
      debtToIncome: health.debtToIncomeRatio,
      emergencyFund: health.emergencyFundMonths,
      budgetAdherence: health.budgetAdherence
    },
    recommendations: health.suggestions
  }
}
```

---

## 🔧 Best Practices

### 1. Use Server Actions (Recommended)

```typescript
// ✅ Good: Server actions with type safety
'use server'
import { createTransaction } from '@/lib/api/transactions'

export async function handleCreateTransaction(formData: FormData) {
  const data = {
    amount: parseFloat(formData.get('amount')),
    // ... other fields
  }
  
  return await createTransaction(data)
}
```

```typescript
// ❌ Bad: Direct API calls from client
async function handleSubmit() {
  const response = await fetch('/api/transactions', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}
```

### 2. Error Handling

```typescript
// ✅ Good: Use centralized error handler
import { handleError } from '@/lib/services/error-handler'

try {
  await createTransaction(data)
} catch (error) {
  const errorResponse = handleError(error, 'createTransaction')
  toast.error(errorResponse.error.message)
}
```

### 3. Cache Invalidation

```typescript
// ✅ Good: Automatic cache invalidation
import { createTransaction } from '@/lib/api/transactions'

// This automatically invalidates relevant caches
await createTransaction(data)
// Dashboard, transactions, accounts caches are cleared
```

### 4. Batch Operations

```typescript
// ✅ Good: Use Promise.all for parallel requests
const [transactions, accounts, budgets] = await Promise.all([
  getTransactions(),
  getAccounts(),
  getBudgets()
])

// ❌ Bad: Sequential requests (slower)
const transactions = await getTransactions()
const accounts = await getAccounts()
const budgets = await getBudgets()
```

---

## 📚 Additional Resources

- **Project Documentation**:
  - [Architecture Analysis](./GAPS_AND_NEXT_STEPS.md)
  - [Migration Guide](./MIGRATION_GUIDE.md)
  - [RLS Optimization](./RLS_OPTIMIZATION_GUIDE.md)

- **External Resources**:
  - [Supabase Docs](https://supabase.com/docs)
  - [Stripe API](https://stripe.com/docs/api)
  - [Plaid API](https://plaid.com/docs)
  - [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)

- **Type Definitions**:
  - `lib/types/transaction.types.ts`
  - `lib/types/account.types.ts`
  - `lib/supabase-db.ts`

---

## 🤝 Contributing

When adding new API endpoints:

1. **Add TypeScript types** in `lib/types/`
2. **Implement in** `lib/api/` or `app/api/`
3. **Add validation** using Zod schemas
4. **Use error handler** for consistent errors
5. **Invalidate caches** using cache manager
6. **Add tests** in `tests/`
7. **Document here** with examples

---

*Last updated: November 16, 2024*

