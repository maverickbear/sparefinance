/**
 * Reports Advanced Service
 * Business logic for advanced financial reports (Advanced tier)
 * 
 * SIMPLIFIED: This service handles advanced/complex reports that require
 * feature flags or are computationally expensive:
 * - Trends Analysis
 * - Portfolio Reports
 * - Insights (ML/AI)
 * 
 * Core reports (Net Worth, Cash Flow, Spending by Category, Budget Performance)
 * are in reports-core.service.ts
 */

import { makeTransactionsService } from "../transactions/transactions.factory";
import { guardFeatureAccessReadOnly } from "../shared/feature-guard";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import type {
  ReportPeriod,
  TrendData,
} from "@/src/domain/reports/reports.types";
import type { Transaction, TransactionWithRelations } from "@/src/domain/transactions/transactions.types";

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
 * Calculate Trends (Advanced Report)
 * Month-over-month comparison and trend analysis
 */
function calculateTrends(
  currentMonthTransactions: (Transaction | TransactionWithRelations)[],
  historicalTransactions: (Transaction | TransactionWithRelations)[],
  currentMonth: Date
): TrendData[] {
  const lastMonth = subMonths(currentMonth, 1);
  const lastMonthStart = startOfMonth(lastMonth);
  const lastMonthEnd = endOfMonth(lastMonth);

  const lastMonthTransactions = historicalTransactions.filter((tx) => {
    const txDate = new Date(tx.date);
    return txDate >= lastMonthStart && txDate <= lastMonthEnd;
  });

  const currentIncome = currentMonthTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const lastMonthIncome = lastMonthTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const currentExpenses = currentMonthTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const lastMonthExpenses = lastMonthTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const trends: TrendData[] = [];

  // Income trend
  const incomeChange = currentIncome - lastMonthIncome;
  const incomeChangePercent = lastMonthIncome > 0 ? (incomeChange / lastMonthIncome) * 100 : 0;
  trends.push({
    metric: "Income",
    current: currentIncome,
    previous: lastMonthIncome,
    change: incomeChange,
    changePercent: incomeChangePercent,
    direction: incomeChange > 0 ? "up" : incomeChange < 0 ? "down" : "stable",
  });

  // Expenses trend
  const expensesChange = currentExpenses - lastMonthExpenses;
  const expensesChangePercent = lastMonthExpenses > 0 ? (expensesChange / lastMonthExpenses) * 100 : 0;
  trends.push({
    metric: "Expenses",
    current: currentExpenses,
    previous: lastMonthExpenses,
    change: expensesChange,
    changePercent: expensesChangePercent,
    direction: expensesChange < 0 ? "up" : expensesChange > 0 ? "down" : "stable", // Inverted: less expenses is good
  });

  // Net trend
  const currentNet = currentIncome - currentExpenses;
  const lastMonthNet = lastMonthIncome - lastMonthExpenses;
  const netChange = currentNet - lastMonthNet;
  const netChangePercent = lastMonthNet !== 0 ? (netChange / Math.abs(lastMonthNet)) * 100 : 0;
  trends.push({
    metric: "Net",
    current: currentNet,
    previous: lastMonthNet,
    change: netChange,
    changePercent: netChangePercent,
    direction: netChange > 0 ? "up" : netChange < 0 ? "down" : "stable",
  });

  return trends;
}

export class ReportsAdvancedService {
  /**
   * Get Trends Report (Advanced)
   * Month-over-month comparison and trend analysis
   */
  async getTrends(
    userId: string,
    period: ReportPeriod
  ): Promise<TrendData[]> {
    // Check feature access
    const featureGuard = await guardFeatureAccessReadOnly(userId, "hasAdvancedReports");
    if (!featureGuard.allowed) {
      throw new Error("Advanced reports feature not available");
    }

    const transactionsService = makeTransactionsService();
    const now = new Date();
    const currentMonth = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const dateRange = getDateRangeForPeriod(period, now);

    // Fetch current month and historical transactions
    const [currentMonthResult, historicalResult] = await Promise.all([
      transactionsService.getTransactions(
        { startDate: currentMonth, endDate: currentMonthEnd }
      ),
      transactionsService.getTransactions(
        { startDate: dateRange.startDate, endDate: dateRange.endDate }
      ),
    ]);

    const currentMonthTransactions = Array.isArray(currentMonthResult)
      ? currentMonthResult
      : (currentMonthResult.transactions || []);
    const historicalTransactions = Array.isArray(historicalResult)
      ? historicalResult
      : (historicalResult.transactions || []);

    return calculateTrends(
      currentMonthTransactions as TransactionWithRelations[],
      historicalTransactions as TransactionWithRelations[],
      currentMonth
    );
  }

  /**
   * Get Insights Report (Advanced/Experimental)
   * ML/AI-powered insights and recommendations
   * 
   * NOTE: This is a placeholder for future ML insights.
   * Currently returns empty array, but structure is ready for implementation.
   */
  async getInsights(
    userId: string
  ): Promise<Array<{
    type: string;
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
    actionUrl?: string;
  }>> {
    // Check feature access
    const featureGuard = await guardFeatureAccessReadOnly(userId, "hasAdvancedReports");
    if (!featureGuard.allowed) {
      throw new Error("Advanced reports feature not available");
    }

    // TODO: Implement ML/AI insights
    // For now, return empty array
    return [];
  }
}
