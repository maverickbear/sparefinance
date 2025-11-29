/**
 * Balance Calculator Service
 * Optimized calculation of account balances from transactions
 * Uses efficient algorithms to minimize computation time
 */

import { AccountWithBalance, AccountBalance } from '@/src/domain/accounts/accounts.types';
import { TransactionWithRelations } from '@/src/domain/transactions/transactions.types';
import { parseAmount } from './transaction-calculations';

/**
 * Calculates balances for multiple accounts efficiently
 * Uses a single pass through all transactions
 * 
 * @param accounts - Array of accounts with initialBalance
 * @param transactions - Array of all transactions (should be pre-filtered by date if needed)
 * @param upToDate - Optional date to calculate balance up to (defaults to today)
 * @returns Map of accountId -> balance
 */
export function calculateAccountBalances(
  accounts: AccountWithBalance[],
  transactions: TransactionWithRelations[],
  upToDate?: Date
): Map<string, number> {
  const balances = new Map<string, number>();
  
  // Initialize with initial balances
  accounts.forEach((account) => {
    const initialBalance = account.initialBalance ?? 0;
    balances.set(account.id, initialBalance);
  });

  // Determine cutoff date
  const cutoffDate = upToDate || new Date();
  cutoffDate.setHours(23, 59, 59, 999);

  // Single pass through transactions
  for (const tx of transactions) {
    // Skip future transactions
    const txDate = new Date(tx.date);
    if (txDate > cutoffDate) {
      continue;
    }

    // Skip invalid transactions
    const amount = parseAmount(tx.amount);
    if (!amount || !isFinite(amount)) {
      continue;
    }

    const currentBalance = balances.get(tx.accountId) || 0;

    // Handle transfers separately - they move money between accounts
    if (tx.type === 'transfer') {
      // For outgoing transfer (has transferToId), subtract from source account
      if ((tx as any).transferToId) {
        balances.set(tx.accountId, currentBalance - Math.abs(amount));
      }
      // For incoming transfer (has transferFromId), add to destination account
      // Note: The incoming transfer will be processed separately with its own accountId
      if ((tx as any).transferFromId) {
        balances.set(tx.accountId, currentBalance + amount);
      }
    } else if (tx.type === 'income') {
      balances.set(tx.accountId, currentBalance + amount);
    } else if (tx.type === 'expense') {
      balances.set(tx.accountId, currentBalance - Math.abs(amount));
    }
  }

  return balances;
}

/**
 * Calculates balance for a single account
 * 
 * @param accountId - Account ID
 * @param initialBalance - Initial balance of the account
 * @param transactions - Array of transactions for this account
 * @param upToDate - Optional date to calculate balance up to (defaults to today)
 * @returns Current balance
 */
export function calculateSingleAccountBalance(
  accountId: string,
  initialBalance: number,
  transactions: TransactionWithRelations[],
  upToDate?: Date
): number {
  let balance = initialBalance;

  // Determine cutoff date
  const cutoffDate = upToDate || new Date();
  cutoffDate.setHours(23, 59, 59, 999);

  for (const tx of transactions) {
    if (tx.accountId !== accountId) {
      continue;
    }

    // Skip future transactions
    const txDate = new Date(tx.date);
    if (txDate > cutoffDate) {
      continue;
    }

    // Skip invalid transactions
    const amount = parseAmount(tx.amount);
    if (!amount || !isFinite(amount)) {
      continue;
    }

    // Handle transfers separately - they move money between accounts
    if (tx.type === 'transfer') {
      // For outgoing transfer (has transferToId), subtract from source account
      if ((tx as any).transferToId) {
        balance -= Math.abs(amount);
      }
      // For incoming transfer (has transferFromId), add to destination account
      if ((tx as any).transferFromId) {
        balance += amount;
      }
    } else if (tx.type === 'income') {
      balance += amount;
    } else if (tx.type === 'expense') {
      balance -= Math.abs(amount);
    }
  }

  return balance;
}

/**
 * Calculates total balance across all accounts
 * 
 * @param accounts - Array of accounts
 * @param transactions - Array of all transactions
 * @param upToDate - Optional date to calculate balance up to (defaults to today)
 * @returns Total balance across all accounts
 */
export function calculateTotalBalance(
  accounts: AccountWithBalance[],
  transactions: TransactionWithRelations[],
  upToDate?: Date
): number {
  const balances = calculateAccountBalances(accounts, transactions, upToDate);
  
  return Array.from(balances.values()).reduce((sum, balance) => sum + balance, 0);
}

/**
 * Calculates balance change for a period
 * More efficient than calculating full balances for start and end dates
 * 
 * @param transactions - Array of transactions in the period
 * @returns Net balance change
 */
export function calculateBalanceChange(
  transactions: TransactionWithRelations[]
): number {
  return transactions.reduce((sum, tx) => {
    const amount = parseAmount(tx.amount);
    if (!amount || !isFinite(amount)) {
      return sum;
    }

    // Skip transfers - they don't affect net balance (money just moves between accounts)
    if (tx.type === 'transfer') {
      return sum;
    }

    if (tx.type === 'income') {
      return sum + amount;
    } else if (tx.type === 'expense') {
      return sum - Math.abs(amount);
    }

    return sum;
  }, 0);
}

/**
 * Calculates balance by account type
 * 
 * @param accounts - Array of accounts with balances
 * @returns Object with account types as keys and totals as values
 */
export function calculateBalanceByType(
  accounts: AccountWithBalance[]
): Record<string, number> {
  return accounts.reduce((acc, account) => {
    const type = account.type;
    if (!acc[type]) {
      acc[type] = 0;
    }
    acc[type] += account.balance || 0;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Calculates checking vs savings breakdown
 * 
 * @param accounts - Array of accounts with balances
 * @returns Object with checking and savings totals
 */
export function calculateCheckingSavingsBreakdown(
  accounts: AccountWithBalance[]
): { checking: number; savings: number; other: number } {
  const breakdown = {
    checking: 0,
    savings: 0,
    other: 0,
  };

  accounts.forEach((account) => {
    const balance = account.balance || 0;
    
    if (account.type === 'checking') {
      breakdown.checking += balance;
    } else if (account.type === 'savings') {
      breakdown.savings += balance;
    } else {
      breakdown.other += balance;
    }
  });

  return breakdown;
}

/**
 * Optimized version: Calculate last month's balance from current balance
 * Instead of recalculating from all historical transactions
 * 
 * @param currentBalance - Current total balance
 * @param currentMonthTransactions - Transactions from current month
 * @returns Estimated last month's balance
 */
export function calculateLastMonthBalanceFromCurrent(
  currentBalance: number,
  currentMonthTransactions: TransactionWithRelations[]
): number {
  const currentMonthChange = calculateBalanceChange(currentMonthTransactions);
  return currentBalance - currentMonthChange;
}

