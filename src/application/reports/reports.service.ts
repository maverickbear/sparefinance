/**
 * Reports Service
 * Business logic for financial reports
 */

import { makeTransactionsService } from "../transactions/transactions.factory";
import { makeBudgetsService } from "../budgets/budgets.factory";
import { makeDebtsService } from "../debts/debts.factory";
import { makeGoalsService } from "../goals/goals.factory";
import { makeAccountsService } from "../accounts/accounts.factory";
import { makePortfolioService } from "../portfolio/portfolio.factory";
import { calculateFinancialHealth } from "../shared/financial-health";
import { guardFeatureAccessReadOnly } from "../shared/feature-guard";
import { getUserLiabilities } from "@/lib/api/plaid/liabilities";
import { startOfMonth, endOfMonth, subMonths, eachMonthOfInterval, format } from "date-fns";
import { logger } from "@/src/infrastructure/utils/logger";
import type {
  ReportsData,
  ReportPeriod,
  NetWorthData,
  NetWorthHistoricalPoint,
  CashFlowData,
  CashFlowMonthlyData,
  TrendData,
} from "@/src/domain/reports/reports.types";
import type { Transaction, TransactionWithRelations } from "@/src/domain/transactions/transactions.types";
import type { Budget } from "@/src/domain/budgets/budgets.types";
import type { DebtWithCalculations } from "@/src/domain/debts/debts.types";
import type { GoalWithCalculations } from "@/src/domain/goals/goals.types";
import type { Account } from "@/src/domain/accounts/accounts.types";
import type { PortfolioSummary, HistoricalDataPoint, Holding } from "@/src/domain/portfolio/portfolio.types";
import type { FinancialHealthData } from "@/src/application/shared/financial-health";

export class ReportsService {
  /**
   * Get date range for a report period
   */
  private getDateRange(period: ReportPeriod, now: Date): { startDate: Date; endDate: Date } {
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
   * Get comprehensive reports data
   */
  async getReportsData(
    userId: string,
    period: ReportPeriod,
    accessToken?: string,
    refreshToken?: string
  ): Promise<ReportsData> {
    const now = new Date();
    const currentMonth = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const dateRange = this.getDateRange(period, now);

    // Initialize services
    const transactionsService = makeTransactionsService();
    const budgetsService = makeBudgetsService();
    const debtsService = makeDebtsService();
    const goalsService = makeGoalsService();
    const accountsService = makeAccountsService();
    const portfolioService = makePortfolioService();

    // Fetch all data in parallel for performance
    const [
      currentMonthTransactionsResult,
      historicalTransactionsResult,
      budgets,
      debts,
      accounts,
    ] = await Promise.all([
      transactionsService
        .getTransactions(
          { startDate: currentMonth, endDate: currentMonthEnd },
          accessToken,
          refreshToken
        )
        .catch((error) => {
          logger.error("Error fetching current month transactions:", error);
          return { transactions: [], total: 0 };
        }),
      transactionsService
        .getTransactions(
          { startDate: dateRange.startDate, endDate: dateRange.endDate },
          accessToken,
          refreshToken
        )
        .catch((error) => {
          logger.error("Error fetching historical transactions:", error);
          return { transactions: [], total: 0 };
        }),
      budgetsService.getBudgets(now, accessToken, refreshToken).catch((error) => {
        logger.error("Error fetching budgets:", error);
        return [];
      }),
      debtsService.getDebts(accessToken, refreshToken).catch((error) => {
        logger.error("Error fetching debts:", error);
        return [];
      }),
      accountsService.getAccounts(accessToken, refreshToken, { includeHoldings: false }).catch((error) => {
        logger.error("Error fetching accounts:", error);
        return [];
      }),
    ]);

    // Extract transactions arrays
    const currentMonthTransactionsRaw = Array.isArray(currentMonthTransactionsResult)
      ? currentMonthTransactionsResult
      : (currentMonthTransactionsResult?.transactions || []);
    const historicalTransactionsRaw = Array.isArray(historicalTransactionsResult)
      ? historicalTransactionsResult
      : (historicalTransactionsResult?.transactions || []);

    // Convert TransactionWithRelations to Transaction (normalize date to string)
    const convertToTransaction = (tx: TransactionWithRelations): Transaction => {
      const dateStr = typeof tx.date === 'string' ? tx.date : tx.date.toISOString().split('T')[0];
      return {
        id: tx.id,
        date: dateStr,
        type: tx.type as string,
        amount: tx.amount,
        accountId: tx.accountId,
        categoryId: tx.categoryId ?? undefined,
        subcategoryId: tx.subcategoryId ?? undefined,
        description: tx.description ?? undefined,
        recurring: tx.recurring ?? undefined,
        expenseType: tx.expenseType as "fixed" | "variable" | null | undefined,
        transferToId: tx.transferToId ?? undefined,
        transferFromId: tx.transferFromId ?? undefined,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
        suggestedCategoryId: tx.suggestedCategoryId ?? undefined,
        suggestedSubcategoryId: tx.suggestedSubcategoryId ?? undefined,
        plaidMetadata: tx.plaidMetadata ?? undefined,
        account: tx.account ? { id: tx.account.id, name: tx.account.name } : null,
        category: tx.category ? { id: tx.category.id, name: tx.category.name } : null,
        subcategory: tx.subcategory ? { id: tx.subcategory.id, name: tx.subcategory.name } : null,
        suggestedCategory: undefined,
        suggestedSubcategory: undefined,
      };
    };

    const currentMonthTransactions: Transaction[] = currentMonthTransactionsRaw.map(convertToTransaction);
    const historicalTransactions: Transaction[] = historicalTransactionsRaw.map(convertToTransaction);

    // Fetch goals
    const goals = await goalsService.getGoals(accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching goals:", error);
      return [];
    });

    // Calculate financial health
    let financialHealth: FinancialHealthData | null = null;
    try {
      financialHealth = await calculateFinancialHealth(
        now,
        userId,
        accessToken,
        refreshToken,
        accounts
      );
    } catch (error) {
      logger.error("Error calculating financial health:", error);
    }

    // Load portfolio data if user has access
    let portfolioSummary: PortfolioSummary | null = null;
    let portfolioHoldings: Holding[] = [];
    let portfolioHistorical: HistoricalDataPoint[] = [];

    try {
      const featureGuard = await guardFeatureAccessReadOnly(userId, "hasInvestments");
      if (featureGuard.allowed) {
        const summary = await portfolioService.getPortfolioSummary(userId).catch(() => null);
        const holdings = await portfolioService.getPortfolioHoldings(accessToken, refreshToken).catch(() => []);
        const historical = await portfolioService.getPortfolioHistoricalData(365, userId).catch(() => []);

        portfolioSummary = summary;
        portfolioHoldings = holdings;
        portfolioHistorical = historical;
      }
    } catch (error) {
      logger.error("Error loading portfolio data:", error);
    }

    // Calculate Net Worth
    const netWorth = await this.calculateNetWorth(userId, accounts, debts, portfolioSummary, accessToken, refreshToken);

    // Calculate Cash Flow
    const cashFlow = this.calculateCashFlow(historicalTransactions, dateRange);

    // Calculate Trends
    const trends = this.calculateTrends(currentMonthTransactions, historicalTransactions, currentMonth);

    return {
      budgets,
      currentMonthTransactions,
      historicalTransactions,
      debts,
      goals,
      financialHealth,
      accounts,
      portfolioSummary,
      portfolioHoldings,
      portfolioHistorical,
      netWorth,
      cashFlow,
      trends,
    };
  }

  /**
   * Calculate Net Worth (Assets - Liabilities)
   */
  private async calculateNetWorth(
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

      // Add Plaid liabilities
      try {
        const liabilities = await getUserLiabilities(userId, accessToken, refreshToken);
        totalLiabilities += liabilities.reduce((sum, liability) => {
          const balance = (liability as any).balance ?? (liability as any).currentBalance ?? null;
          if (balance == null) return sum;
          const numValue = typeof balance === "string" ? parseFloat(balance) : Number(balance);
          if (!isNaN(numValue) && isFinite(numValue)) {
            const debtAmount = numValue < 0 ? Math.abs(numValue) : numValue;
            return sum + debtAmount;
          }
          return sum;
        }, 0);
      } catch (error) {
        logger.warn("Error fetching liabilities for net worth:", error);
      }

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
   * Calculate cash flow data
   */
  private calculateCashFlow(
    transactions: Transaction[],
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
   * Calculate trends
   */
  private calculateTrends(
    currentMonthTransactions: Transaction[],
    historicalTransactions: Transaction[],
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
}

