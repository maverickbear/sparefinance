/**
 * Helper functions for transaction calculations in the dashboard
 * Re-exports from centralized service layer for backward compatibility
 */

import { endOfDay, startOfDay, subDays } from "date-fns";
import type { TransactionWithRelations } from "@/src/domain/transactions/transactions.types";

const parseTransactionDate = (dateValue: string | Date): Date => {
  if (dateValue instanceof Date) {
    return dateValue;
  }

  const normalized = dateValue.replace(" ", "T").split(".")[0];
  return new Date(normalized);
};

export function filterTransactionsLastNDays(
  transactions: TransactionWithRelations[],
  days: number,
  referenceDate: Date = new Date()
): TransactionWithRelations[] {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return [];
  }

  const endDate = endOfDay(referenceDate);
  const startDate = startOfDay(subDays(endDate, Math.max(days - 1, 0)));

  return transactions.filter((transaction) => {
    if (!transaction?.date) return false;
    const txDate = parseTransactionDate(transaction.date);
    return txDate >= startDate && txDate <= endDate;
  });
}

export {
  parseAmount as parseTransactionAmount,
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateNetAmount,
  groupExpensesByCategory,
  calculateSavingsRate,
  calculateExpenseRatio,
  calculateTransactionSummary,
} from '@/lib/services/transaction-calculations';

