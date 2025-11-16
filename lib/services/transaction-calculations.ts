/**
 * Transaction Calculation Service
 * Centralized business logic for all transaction calculations
 * This ensures consistency across the entire application
 */

import { TransactionWithRelations, TransactionSummary } from '@/lib/types/transaction.types';

/**
 * Safely parses a transaction amount, handling various input types
 * @param amount - The amount value (can be string, number, null, or undefined)
 * @returns The parsed number, or 0 if invalid
 */
export function parseAmount(amount: any): number {
  if (amount == null || amount === '') {
    return 0;
  }

  // If it's already a number, return it (checking for NaN)
  if (typeof amount === 'number') {
    return isNaN(amount) || !isFinite(amount) ? 0 : amount;
  }

  // If it's a string, try to parse it
  if (typeof amount === 'string') {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || !isFinite(parsed)) {
      return 0;
    }
    return parsed;
  }

  // Try to convert to number as last resort
  const num = Number(amount);
  return isNaN(num) || !isFinite(num) ? 0 : num;
}

/**
 * Validates if a transaction is valid for calculations
 * @param transaction - Transaction to validate
 * @returns true if transaction is valid
 */
export function isValidTransaction(transaction: any): boolean {
  if (!transaction || !transaction.type) {
    return false;
  }

  const amount = parseAmount(transaction.amount);
  return amount > 0 && isFinite(amount);
}

/**
 * Calculates total income from transactions
 * Excludes transfers to avoid double-counting (transfers create both income and expense entries)
 * @param transactions - Array of transactions
 * @returns Total income amount
 */
export function calculateTotalIncome(transactions: TransactionWithRelations[]): number {
  return transactions
    .filter((t) => {
      // Exclude transfers (transactions with transferFromId or transferToId)
      const isTransfer = !!(t as any).transferFromId || !!(t as any).transferToId;
      return t && t.type === 'income' && !isTransfer && isValidTransaction(t);
    })
    .reduce((sum, t) => sum + parseAmount(t.amount), 0);
}

/**
 * Calculates total expenses from transactions
 * Excludes transfers to avoid double-counting (transfers create both income and expense entries)
 * @param transactions - Array of transactions
 * @returns Total expenses amount (always positive)
 */
export function calculateTotalExpenses(transactions: TransactionWithRelations[]): number {
  return transactions
    .filter((t) => {
      // Exclude transfers (transactions with transferFromId or transferToId)
      const isTransfer = !!(t as any).transferFromId || !!(t as any).transferToId;
      return t && t.type === 'expense' && !isTransfer && isValidTransaction(t);
    })
    .reduce((sum, t) => {
      const amount = parseAmount(t.amount);
      return sum + Math.abs(amount);
    }, 0);
}

/**
 * Calculates net amount (income - expenses) from transactions
 * @param transactions - Array of transactions
 * @returns Net amount (positive for surplus, negative for deficit)
 */
export function calculateNetAmount(transactions: TransactionWithRelations[]): number {
  const income = calculateTotalIncome(transactions);
  const expenses = calculateTotalExpenses(transactions);
  return income - expenses;
}

/**
 * Calculates savings rate as a percentage of income
 * @param income - Total income
 * @param expenses - Total expenses
 * @returns Savings rate percentage
 */
export function calculateSavingsRate(income: number, expenses: number): number {
  if (income <= 0) {
    return expenses > 0 ? -100 : 0;
  }
  
  const netAmount = income - expenses;
  return (netAmount / income) * 100;
}

/**
 * Calculates expense ratio as a percentage of income
 * @param income - Total income
 * @param expenses - Total expenses
 * @returns Expense ratio percentage
 */
export function calculateExpenseRatio(income: number, expenses: number): number {
  if (income <= 0) {
    return expenses > 0 ? 100 : 0;
  }
  
  return (expenses / income) * 100;
}

/**
 * Groups transactions by category and calculates totals
 * Excludes transfers to avoid double-counting
 * @param transactions - Array of transactions (should be filtered to expenses)
 * @returns Object with category names as keys and totals as values
 */
export function groupExpensesByCategory(
  transactions: TransactionWithRelations[]
): Record<string, number> {
  return transactions
    .filter((t) => {
      // Exclude transfers (transactions with transferFromId or transferToId)
      const isTransfer = !!(t as any).transferFromId || !!(t as any).transferToId;
      return t && t.type === 'expense' && !isTransfer && isValidTransaction(t);
    })
    .reduce((acc, t) => {
      const categoryName = t.category?.name || 'Uncategorized';
      const amount = parseAmount(t.amount);
      
      if (!acc[categoryName]) {
        acc[categoryName] = 0;
      }
      acc[categoryName] += Math.abs(amount);
      return acc;
    }, {} as Record<string, number>);
}

/**
 * Groups transactions by account and calculates totals
 * @param transactions - Array of transactions
 * @returns Object with account IDs as keys and totals as values
 */
export function groupByAccount(
  transactions: TransactionWithRelations[]
): Record<string, number> {
  return transactions
    .filter((t) => isValidTransaction(t))
    .reduce((acc, t) => {
      const accountId = t.accountId;
      const amount = parseAmount(t.amount);
      
      if (!acc[accountId]) {
        acc[accountId] = 0;
      }
      
      // Add income, subtract expenses
      if (t.type === 'income') {
        acc[accountId] += amount;
      } else if (t.type === 'expense') {
        acc[accountId] -= Math.abs(amount);
      }
      
      return acc;
    }, {} as Record<string, number>);
}

/**
 * Calculates a comprehensive summary of transactions
 * @param transactions - Array of transactions
 * @returns Transaction summary with all key metrics
 */
export function calculateTransactionSummary(
  transactions: TransactionWithRelations[]
): TransactionSummary {
  const totalIncome = calculateTotalIncome(transactions);
  const totalExpenses = calculateTotalExpenses(transactions);
  const netAmount = totalIncome - totalExpenses;
  const byCategory = groupExpensesByCategory(transactions);
  const byAccount = groupByAccount(transactions);
  
  return {
    totalIncome,
    totalExpenses,
    netAmount,
    count: transactions.length,
    byCategory,
    byAccount,
  };
}

/**
 * Calculates the net change in balance from a set of transactions
 * Used for efficient balance calculations
 * @param transactions - Array of transactions
 * @returns Net change in balance
 */
export function calculateNetBalanceChange(
  transactions: TransactionWithRelations[]
): number {
  return transactions
    .filter((t) => isValidTransaction(t))
    .reduce((sum, t) => {
      const amount = parseAmount(t.amount);
      
      if (t.type === 'income') {
        return sum + amount;
      } else if (t.type === 'expense') {
        return sum - Math.abs(amount);
      }
      
      return sum;
    }, 0);
}

/**
 * Filters transactions by date range
 * @param transactions - Array of transactions
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (inclusive)
 * @returns Filtered transactions
 */
export function filterByDateRange(
  transactions: TransactionWithRelations[],
  startDate: Date,
  endDate: Date
): TransactionWithRelations[] {
  return transactions.filter((t) => {
    const txDate = new Date(t.date);
    return txDate >= startDate && txDate <= endDate;
  });
}

/**
 * Filters transactions by type
 * @param transactions - Array of transactions
 * @param type - Transaction type
 * @returns Filtered transactions
 */
export function filterByType(
  transactions: TransactionWithRelations[],
  type: 'income' | 'expense' | 'transfer'
): TransactionWithRelations[] {
  return transactions.filter((t) => t.type === type);
}

/**
 * Filters transactions by category
 * @param transactions - Array of transactions
 * @param categoryId - Category ID
 * @returns Filtered transactions
 */
export function filterByCategory(
  transactions: TransactionWithRelations[],
  categoryId: string
): TransactionWithRelations[] {
  return transactions.filter((t) => t.categoryId === categoryId);
}

/**
 * Filters transactions by account
 * @param transactions - Array of transactions
 * @param accountId - Account ID
 * @returns Filtered transactions
 */
export function filterByAccount(
  transactions: TransactionWithRelations[],
  accountId: string
): TransactionWithRelations[] {
  return transactions.filter((t) => t.accountId === accountId);
}

