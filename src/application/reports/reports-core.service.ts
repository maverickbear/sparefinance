/**
 * Reports Core Service
 * Business logic for essential financial reports (Core tier)
 * 
 * SIMPLIFIED: This service handles only the 3-4 essential reports:
 * - Net Worth
 * - Cash Flow
 * - Spending by Category
 * - Budget Performance
 * 
 * Advanced reports (Trends, Portfolio, Insights) are in reports-advanced.service.ts
 */

import { makeTransactionsService } from "../transactions/transactions.factory";
import { makeBudgetsService } from "../budgets/budgets.factory";
// CRITICAL: Use static import to ensure React cache() works correctly
import { getAccountsForDashboard } from "../accounts/get-dashboard-accounts";
import { startOfMonth, endOfMonth, subMonths, eachMonthOfInterval, format } from "date-fns";
import { logger } from "@/src/infrastructure/utils/logger";
import type {
  ReportPeriod,
  NetWorthData,
  NetWorthHistoricalPoint,
  CashFlowData,
  CashFlowMonthlyData,
} from "@/src/domain/reports/reports.types";
import type { Transaction, TransactionWithRelations } from "@/src/domain/transactions/transactions.types";
import type { Account } from "@/src/domain/accounts/accounts.types";
import type { DebtWithCalculations } from "@/src/domain/debts/debts.types";
import type { PortfolioSummary } from "@/src/domain/portfolio/portfolio.types";

// Helper function to get date range
function getDateRangeForPeriod(period: ReportPeriod, now: Date): { startDate: Date; endDate: Date } {
  switch (period) {
    case "current-month":
      return {
        startDate: startOfMonth(now),
        endDate: endOfMonth(now),
      };
    case "last-3-months":
      return {
        startDate: startOfMonth(subMonths(now, 2)),
        endDate: endOfMonth(now),
      };
    case "last-6-months":
      return {
        startDate: startOfMonth(subMonths(now, 5)),
        endDate: endOfMonth(now),
      };
    case "last-12-months":
      return {
        startDate: startOfMonth(subMonths(now, 11)),
        endDate: endOfMonth(now),
      };
    case "year-to-date":
      return {
        startDate: new Date(now.getFullYear(), 0, 1),
        endDate: endOfMonth(now),
      };
    default:
      return {
        startDate: startOfMonth(now),
        endDate: endOfMonth(now),
      };
  }
}

/**
 * Calculate Net Worth (Core Report)
 * Simple calculation: Assets - Liabilities
 */
async function calculateNetWorth(
  userId: string,
  accounts: Account[],
  debts: DebtWithCalculations[],
  portfolioSummary: PortfolioSummary | null,
  accessToken?: string,
  refreshToken?: string
): Promise<NetWorthData | null> {
  try {
    // Calculate total assets
    let totalAssets = 0;

    // Add account balances (checking, savings, cash)
    const cashAccounts = accounts.filter(
      (acc) => acc.type === "checking" || acc.type === "savings" || acc.type === "cash"
    );
    totalAssets += cashAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

    // Add investment accounts
    const investmentAccounts = accounts.filter((acc) => acc.type === "investment");
    totalAssets += investmentAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

    // Add portfolio value if available
    if (portfolioSummary) {
      totalAssets += portfolioSummary.totalValue;
    }

    // Calculate total liabilities
    let totalLiabilities = 0;

    // Add debts from Debt table (only unpaid)
    const unpaidDebts = debts.filter((debt) => !debt.isPaidOff);
    totalLiabilities += unpaidDebts.reduce((sum, debt) => {
      const balance = debt.currentBalance ?? 0;
      return sum + Math.abs(Number(balance) || 0);
    }, 0);

    // Calculate net worth
    const netWorth = totalAssets - totalLiabilities;

    // Calculate historical net worth (last 6 months)
    const historical: NetWorthHistoricalPoint[] = [];
    const months = eachMonthOfInterval({
      start: startOfMonth(subMonths(new Date(), 5)),
      end: startOfMonth(new Date()),
    });

    // For now, we'll use current values for historical (can be enhanced later with actual historical data)
    months.forEach((month) => {
      historical.push({
        date: format(month, "yyyy-MM-dd"),
        assets: totalAssets,
        liabilities: totalLiabilities,
        netWorth: netWorth,
      });
    });

    // Calculate change (compare with previous month)
    const previousMonth = historical.length > 1 ? historical[historical.length - 2] : null;
    const change = previousMonth
      ? {
          amount: netWorth - previousMonth.netWorth,
          percent: previousMonth.netWorth !== 0 ? ((netWorth - previousMonth.netWorth) / Math.abs(previousMonth.netWorth)) * 100 : 0,
          period: "vs last month",
        }
      : {
          amount: 0,
          percent: 0,
          period: "N/A",
        };

    return {
      totalAssets,
      totalLiabilities,
      netWorth,
      historical,
      change,
    };
  } catch (error) {
    logger.error("Error calculating net worth:", error);
    return null;
  }
}

/**
 * Calculate Cash Flow (Core Report)
 * Income vs Expenses by month
 */
function calculateCashFlow(
  transactions: (Transaction | TransactionWithRelations)[],
  dateRange: { startDate: Date; endDate: Date }
): CashFlowData {
  const months = eachMonthOfInterval({
    start: startOfMonth(dateRange.startDate),
    end: endOfMonth(dateRange.endDate),
  });

  const monthly: CashFlowMonthlyData[] = months.map((month) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const monthTransactions = transactions.filter((tx) => {
      const txDate = new Date(tx.date);
      return txDate >= monthStart && txDate <= monthEnd;
    });

    const income = monthTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const expenses = monthTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    return {
      month: format(month, "MMM yyyy"),
      income,
      expenses,
      net: income - expenses,
    };
  });

  const totalIncome = monthly.reduce((sum, m) => sum + m.income, 0);
  const totalExpenses = monthly.reduce((sum, m) => sum + m.expenses, 0);

  return {
    income: totalIncome,
    expenses: totalExpenses,
    net: totalIncome - totalExpenses,
    monthly,
  };
}

/**
 * Calculate Spending by Category (Core Report)
 * Top categories by spending amount
 */
function calculateSpendingByCategory(
  transactions: (Transaction | TransactionWithRelations)[],
  dateRange: { startDate: Date; endDate: Date }
): Array<{ category: string; amount: number; count: number; percentage: number }> {
  const filteredTransactions = transactions.filter((tx) => {
    const txDate = new Date(tx.date);
    return txDate >= dateRange.startDate && txDate <= dateRange.endDate && tx.type === "expense";
  });

  // Group by category
  const categoryMap = new Map<string, { amount: number; count: number }>();
  
  filteredTransactions.forEach((tx) => {
    const categoryName = (tx as TransactionWithRelations).category?.name || "Uncategorized";
    const amount = Number(tx.amount) || 0;
    
    const existing = categoryMap.get(categoryName) || { amount: 0, count: 0 };
    categoryMap.set(categoryName, {
      amount: existing.amount + amount,
      count: existing.count + 1,
    });
  });

  // Calculate total for percentage
  const total = Array.from(categoryMap.values()).reduce((sum, cat) => sum + cat.amount, 0);

  // Convert to array and sort by amount
  const result = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      count: data.count,
      percentage: total > 0 ? (data.amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10); // Top 10 categories

  return result;
}

/**
 * Calculate Budget Performance (Core Report)
 * Status of budgets vs actual spending
 */
async function calculateBudgetPerformance(
  userId: string,
  period: ReportPeriod
): Promise<Array<{ budgetName: string; planned: number; actual: number; difference: number; percentage: number }>> {
  try {
    const budgetsService = makeBudgetsService();
    const now = new Date();
    const budgets = await budgetsService.getBudgets(now);

    const transactionsService = makeTransactionsService();
    const dateRange = getDateRangeForPeriod(period, new Date());
    const result = await transactionsService.getTransactions(
      { startDate: dateRange.startDate, endDate: dateRange.endDate }
    );
    const transactions = Array.isArray(result) ? result : (result.transactions || []) as TransactionWithRelations[];

    // Calculate actual spending per budget
    const budgetPerformance = budgets.map((budget) => {
      const budgetTransactions = transactions.filter((tx) => {
        if (budget.categoryId && tx.categoryId === budget.categoryId) {
          return tx.type === "expense";
        }
        return false;
      });

      const actual = budgetTransactions.reduce((sum, tx) => sum + Math.abs(Number(tx.amount) || 0), 0);
      const planned = budget.amount || 0;
      const difference = actual - planned;
      const percentage = planned > 0 ? (actual / planned) * 100 : 0;

      return {
        budgetName: budget.displayName || budget.category?.name || "Unknown",
        planned,
        actual,
        difference,
        percentage,
      };
    });

    return budgetPerformance.sort((a, b) => b.actual - a.actual);
  } catch (error) {
    logger.error("Error calculating budget performance:", error);
    return [];
  }
}

export class ReportsCoreService {
  /**
   * Get Net Worth Report
   */
  async getNetWorth(
    userId: string,
    accounts: Account[],
    debts: DebtWithCalculations[],
    portfolioSummary: PortfolioSummary | null,
    accessToken?: string,
    refreshToken?: string
  ): Promise<NetWorthData | null> {
    return calculateNetWorth(userId, accounts, debts, portfolioSummary, accessToken, refreshToken);
  }

  /**
   * Get Cash Flow Report
   */
  async getCashFlow(
    userId: string,
    period: ReportPeriod
  ): Promise<CashFlowData> {
    const transactionsService = makeTransactionsService();
    const dateRange = getDateRangeForPeriod(period, new Date());
    const result = await transactionsService.getTransactions(
      { startDate: dateRange.startDate, endDate: dateRange.endDate }
    );
    const transactions = Array.isArray(result) ? result : (result.transactions || []);
    return calculateCashFlow(transactions as TransactionWithRelations[], dateRange);
  }

  /**
   * Get Spending by Category Report
   */
  async getSpendingByCategory(
    userId: string,
    period: ReportPeriod
  ): Promise<Array<{ category: string; amount: number; count: number; percentage: number }>> {
    const transactionsService = makeTransactionsService();
    const dateRange = getDateRangeForPeriod(period, new Date());
    const result = await transactionsService.getTransactions(
      { startDate: dateRange.startDate, endDate: dateRange.endDate }
    );
    const transactions = Array.isArray(result) ? result : (result.transactions || []);
    return calculateSpendingByCategory(transactions as TransactionWithRelations[], dateRange);
  }

  /**
   * Get Budget Performance Report
   */
  async getBudgetPerformance(
    userId: string,
    period: ReportPeriod
  ): Promise<Array<{ budgetName: string; planned: number; actual: number; difference: number; percentage: number }>> {
    return calculateBudgetPerformance(userId, period);
  }
}
