/**
 * Dashboard Service
 * Provides dashboard-related business logic and widget data
 */

import { SubscriptionsRepository } from "@/src/infrastructure/database/repositories/subscriptions.repository";
import { DashboardRepository } from "@/src/infrastructure/database/repositories/dashboard.repository";
import { getCachedSubscriptionData } from "@/src/application/subscriptions/get-dashboard-subscription";
import { logger } from "@/src/infrastructure/utils/logger";
import { UpdateCheckResult } from "@/src/domain/dashboard/dashboard.types";
import type {
  DashboardWidgetsData,
  SpareScoreWidgetData,
  NetWorthWidgetData,
  CashFlowWidgetData,
  BudgetPerformanceWidgetData,
  TopSpendingCategoriesWidgetData,
  UpcomingPaymentsWidgetData,
  GoalsProgressWidgetData,
  FinancialAlertsWidgetData,
  DebtOverviewWidgetData,
  InvestmentPortfolioWidgetData,
  TotalBudgetsWidgetData,
  SpendingWidgetData,
  RecentTransactionsWidgetData,
  RecurringWidgetData,
  InvestmentHoldingsWidgetData,
  SubscriptionsWidgetData,
} from "@/src/domain/dashboard/types";
import { calculateFinancialHealth } from "@/src/application/shared/financial-health";
import { makeTransactionsService } from "@/src/application/transactions/transactions.factory";
import { makeBudgetsService } from "@/src/application/budgets/budgets.factory";
import { makeGoalsService } from "@/src/application/goals/goals.factory";
import { makeDebtsService } from "@/src/application/debts/debts.factory";
import { makePlannedPaymentsService } from "@/src/application/planned-payments/planned-payments.factory";
import { ReportsCoreService } from "@/src/application/reports/reports-core.service";
import { makePortfolioService } from "@/src/application/portfolio/portfolio.factory";
import { makeUserSubscriptionsService } from "@/src/application/user-subscriptions/user-subscriptions.factory";
import { getAccountsForDashboard } from "@/src/application/accounts/get-dashboard-accounts";
import { startOfMonth, endOfMonth, subMonths, format, differenceInDays, addDays, eachDayOfInterval, isSameDay, getDate, isAfter, isBefore } from "date-fns";
import type { TransactionWithRelations } from "@/src/domain/transactions/transactions.types";
import type { AccountWithBalance } from "@/src/domain/accounts/accounts.types";
import type { BudgetWithRelations } from "@/src/domain/budgets/budgets.types";
import type { GoalWithCalculations } from "@/src/domain/goals/goals.types";
import type { DebtWithCalculations } from "@/src/domain/debts/debts.types";
import type { BaseFinancialEvent } from "@/src/domain/financial-events/financial-events.types";
import { getTransactionAmount } from "@/lib/utils/transaction-encryption";
import { getCategoryColor } from "@/lib/utils/category-colors";

export interface TransactionUsage {
  current: number;
  limit: number;
  percentage: number;
  warning: boolean;
  remaining: number;
  isUnlimited: boolean;
}

export class DashboardService {
  constructor(
    private subscriptionsRepository: SubscriptionsRepository = new SubscriptionsRepository(),
    private dashboardRepository: DashboardRepository = new DashboardRepository()
  ) {}

  /**
   * Get transaction usage for current month
   */
  async getTransactionUsage(userId: string, month?: Date): Promise<TransactionUsage> {
    try {
      const { limits } = await getCachedSubscriptionData(userId);
      const checkMonth = month || new Date();
      const monthDate = new Date(checkMonth.getFullYear(), checkMonth.getMonth(), 1);

      const current = await this.subscriptionsRepository.getUserMonthlyUsage(userId, monthDate);

      // Unlimited transactions
      if (limits.maxTransactions === -1) {
        return {
          current,
          limit: -1,
          percentage: 0,
          warning: false,
          remaining: -1,
          isUnlimited: true,
        };
      }

      const percentage = Math.round((current / limits.maxTransactions) * 100);
      const warning = percentage >= 80; // Warn when 80% or more
      const remaining = Math.max(0, limits.maxTransactions - current);

      return {
        current,
        limit: limits.maxTransactions,
        percentage,
        warning,
        remaining,
        isUnlimited: false,
      };
    } catch (error) {
      logger.error("[DashboardService] Error getting transaction usage:", error);
      throw error;
    }
  }

  /**
   * Check for dashboard updates since lastCheck timestamp
   * 
   * SIMPLIFIED: Uses simple timestamp-based checking instead of complex hash/RPC
   * Queries transactions table (most frequently updated) to detect changes
   */
  async checkUpdates(userId: string, lastCheck?: string): Promise<UpdateCheckResult> {
    const startTime = Date.now();
    
    try {
      // Simple query: get MAX(updated_at) from transactions table
      // This is sufficient for detecting changes in dashboard data
      const maxUpdate = await this.dashboardRepository.getMaxUpdatedAt();
      const timestamp = maxUpdate ? new Date(maxUpdate).toISOString() : null;

      // Check if there are updates since lastCheck
      let hasUpdates = false;
      if (lastCheck) {
        const lastCheckTime = new Date(lastCheck).getTime();
        hasUpdates = maxUpdate ? maxUpdate > lastCheckTime : true;
      } else {
        // If no lastCheck provided, assume there are updates (first check)
        hasUpdates = true;
      }

      const executionTime = Date.now() - startTime;

      return {
        hasUpdates,
        // Keep currentHash for frontend compatibility (use timestamp as hash)
        currentHash: timestamp || new Date().toISOString(),
        timestamp,
        source: "database",
        executionTime,
      };
    } catch (error) {
      logger.error("[DashboardService] Error checking updates:", error);
      throw error;
    }
  }

  /**
   * Get all dashboard widgets data
   * OPTIMIZED: Pre-fetch shared data (accounts) to avoid duplicate calls
   */
  async getDashboardWidgets(
    userId: string,
    selectedDate?: Date,
    accessToken?: string,
    refreshToken?: string
  ): Promise<DashboardWidgetsData> {
    const date = selectedDate || new Date();
    const selectedMonth = startOfMonth(date);
    const selectedMonthEnd = endOfMonth(date);
    const previousMonth = subMonths(selectedMonth, 1);
    const previousMonthEnd = endOfMonth(previousMonth);

    // OPTIMIZATION: Pre-fetch accounts once to reuse across widgets
    // This prevents multiple calls to getAccountsForDashboard
    let accounts: AccountWithBalance[] | null = null;
    try {
      accounts = await getAccountsForDashboard(true, accessToken, refreshToken);
    } catch (error) {
      logger.warn("[DashboardService] Could not pre-fetch accounts, widgets will fetch individually:", error);
    }

    // Fetch all widget data in parallel for performance
    // OPTIMIZATION: Use better error handling to avoid silent failures
    const [
      spareScore,
      netWorth,
      cashFlow,
      budgetPerformance,
      topSpendingCategories,
      upcomingPayments,
      goalsProgress,
      financialAlerts,
      debtOverview,
      investmentPortfolio,
      // New Widgets
      totalBudgets,
      spending,
      recentTransactions,
      recurring,
      investmentHoldings,
      subscriptions,
    ] = await Promise.all([
      this.getSpareScoreWidget(userId, date, accessToken, refreshToken, accounts),
      this.getNetWorthWidget(userId, accessToken, refreshToken, accounts),
      this.getCashFlowWidget(userId, selectedMonth, selectedMonthEnd, previousMonth, previousMonthEnd, accessToken, refreshToken),
      this.getBudgetPerformanceWidget(userId, selectedMonth, accessToken, refreshToken),
      this.getTopSpendingCategoriesWidget(userId, selectedMonth, selectedMonthEnd, previousMonth, previousMonthEnd, accessToken, refreshToken),
      this.getUpcomingPaymentsWidget(userId, accessToken, refreshToken),
      this.getGoalsProgressWidget(userId, accessToken, refreshToken),
      this.getFinancialAlertsWidget(userId, date, accessToken, refreshToken, accounts),
      this.getDebtOverviewWidget(userId, accessToken, refreshToken),

      // Investment portfolio disabled for now
      Promise.resolve(null),
      // New Widgets
      this.getTotalBudgetsWidget(userId, selectedMonth, accessToken, refreshToken),
      this.getSpendingWidget(userId, selectedMonth, selectedMonthEnd, previousMonth, previousMonthEnd, accessToken, refreshToken),
      this.getRecentTransactionsWidget(userId, accessToken, refreshToken),
      this.getRecurringWidget(userId, accessToken, refreshToken),

      // Investment holdings disabled for now
      Promise.resolve(null),
      this.getSubscriptionsWidget(userId)
    ]);

    return {
      spareScore,
      netWorth,
      cashFlow,
      budgetPerformance,
      topSpendingCategories,
      upcomingPayments,
      goalsProgress,
      financialAlerts: financialAlerts || { alerts: [], hasAlerts: false, actions: [], insights: [] },
      debtOverview,
      investmentPortfolio,
      // New Widgets
      totalBudgets,
      spending,
      recentTransactions,
      recurring,
      investmentHoldings,
      subscriptions,
      accountStats: accounts ? {
        totalChecking: accounts.filter(a => a.type === 'checking').reduce((sum, a) => sum + (a.balance || 0), 0),
        totalSavings: accounts.filter(a => a.type === 'savings').reduce((sum, a) => sum + (a.balance || 0), 0),
      } : null
    };
  }

  /**
   * Widget 1: Get Spare Score Widget Data
   * OPTIMIZED: Accept accounts parameter to avoid duplicate fetch
   */
  async getSpareScoreWidget(
    userId: string,
    selectedDate?: Date,
    accessToken?: string,
    refreshToken?: string,
    accounts?: AccountWithBalance[] | null
  ): Promise<SpareScoreWidgetData | null> {
    try {
      // Reuse accounts if provided, otherwise fetch
      const accountsToUse = accounts || await getAccountsForDashboard(true, accessToken, refreshToken);
      const financialHealth = await calculateFinancialHealth(selectedDate, userId, accessToken, refreshToken, accountsToUse);

      // Calculate trend
      let trend: 'up' | 'down' | 'stable' = 'stable';
      let trendValue: number | undefined;
      if (financialHealth.lastMonthScore !== undefined) {
        const change = financialHealth.score - financialHealth.lastMonthScore;
        if (Math.abs(change) < 1) {
          trend = 'stable';
        } else if (change > 0) {
          trend = 'up';
          trendValue = change;
        } else {
          trend = 'down';
          trendValue = Math.abs(change);
        }
      }

      // Calculate top 3 drivers
      const topDrivers = this.calculateSpareScoreDrivers(financialHealth);

      // Build actions
      const actions = [
        {
          label: "View Full Report",
          href: "/reports?tab=financial-health",
          variant: 'primary' as const,
        },
      ];

      // Build insights
      const insights = financialHealth.alerts.map(alert => ({
        type: alert.severity as 'info' | 'warning' | 'error',
        message: alert.description,
        actionHref: alert.action ? undefined : undefined,
        actionLabel: alert.action,
      }));

      return {
        score: financialHealth.score,
        classification: financialHealth.classification,
        trend,
        trendValue,
        lastMonthScore: financialHealth.lastMonthScore,
        topDrivers,
        message: financialHealth.message,
        isProjected: financialHealth.isProjected,
        details: {
          score: financialHealth.score,
          classification: financialHealth.classification,
          monthlyIncome: financialHealth.monthlyIncome,
          monthlyExpenses: financialHealth.monthlyExpenses,
          netAmount: financialHealth.netAmount,
          savingsRate: financialHealth.savingsRate,
          message: financialHealth.message,
          spendingDiscipline: financialHealth.spendingDiscipline,
          debtExposure: financialHealth.debtExposure,
          emergencyFundMonths: financialHealth.emergencyFundMonths,
          alerts: financialHealth.alerts,
          suggestions: financialHealth.suggestions,
        },
        actions,
        insights,
      };
    } catch (error) {
      logger.error("[DashboardService] Error getting Spare Score widget:", error);
      return null;
    }
  }

  /**
   * Calculate top 3 drivers for Spare Score
   */
  private calculateSpareScoreDrivers(financialHealth: any): Array<{
    label: string;
    change: number;
    changeType: 'increase' | 'decrease';
    impact: 'high' | 'medium' | 'low';
    actionHref: string;
  }> {
    const drivers = [];

    // Driver 1: Spending discipline
    if (financialHealth.spendingDiscipline) {
      const disciplineMap: Record<string, number> = {
        'Excellent': 0,
        'Good': 10,
        'Fair': 20,
        'Poor': 30,
        'Critical': 40,
        'Unknown': 0,
      };
      const currentLevel = disciplineMap[financialHealth.spendingDiscipline] || 0;
      if (currentLevel > 0) {
        drivers.push({
          label: `Spending discipline: ${financialHealth.spendingDiscipline}`,
          change: currentLevel,
          changeType: 'increase' as const,
          impact: currentLevel > 20 ? 'high' as const : 'medium' as const,
          actionHref: '/budgets',
        });
      }
    }

    // Driver 2: Savings rate
    if (financialHealth.savingsRate < 0) {
      drivers.push({
        label: "Negative savings rate",
        change: Math.abs(financialHealth.savingsRate),
        changeType: 'increase' as const,
        impact: 'high' as const,
        actionHref: '/transactions?type=expense',
      });
    } else if (financialHealth.savingsRate < 10) {
      drivers.push({
        label: `Low savings rate: ${financialHealth.savingsRate.toFixed(1)}%`,
        change: 10 - financialHealth.savingsRate,
        changeType: 'increase' as const,
        impact: 'high' as const,
        actionHref: '/goals',
      });
    }

    // Driver 3: Debt exposure
    if (financialHealth.debtExposure === 'High') {
      drivers.push({
        label: "High debt exposure",
        change: 40,
        changeType: 'increase' as const,
        impact: 'high' as const,
        actionHref: '/debts',
      });
    } else if (financialHealth.debtExposure === 'Moderate') {
      drivers.push({
        label: "Moderate debt exposure",
        change: 20,
        changeType: 'increase' as const,
        impact: 'medium' as const,
        actionHref: '/debts',
      });
    }

    // Driver 4: Emergency fund
    if (financialHealth.emergencyFundMonths < 6) {
      drivers.push({
        label: `Emergency fund: ${financialHealth.emergencyFundMonths.toFixed(1)} months`,
        change: 6 - financialHealth.emergencyFundMonths,
        changeType: 'increase' as const,
        impact: financialHealth.emergencyFundMonths < 3 ? 'high' as const : 'medium' as const,
        actionHref: '/goals?filter=emergency-fund',
      });
    }

    // Return top 3 drivers
    return drivers
      .sort((a, b) => {
        const impactOrder = { high: 3, medium: 2, low: 1 };
        return impactOrder[b.impact] - impactOrder[a.impact];
      })
      .slice(0, 3);
  }

  /**
   * Widget 2: Get Net Worth Widget Data
   */
  async getNetWorthWidget(
    userId: string,
    accessToken?: string,
    refreshToken?: string,
    accounts?: AccountWithBalance[] | null
  ): Promise<NetWorthWidgetData | null> {
    try {
      // Reuse accounts if provided, otherwise fetch
      const accountsToUse = accounts || await getAccountsForDashboard(true, accessToken, refreshToken);
      const debtsService = makeDebtsService();
      const debts = await debtsService.getDebts(accessToken, refreshToken);
      const unpaidDebts = debts.filter(d => !d.isPaidOff);

      // Get portfolio summary if available
      let portfolioSummary = null;
      try {
        // const portfolioService = makePortfolioService();
        // portfolioSummary = await portfolioService.getPortfolioSummaryInternal(accessToken, refreshToken).catch(() => null);
      } catch (error) {
        // Portfolio not available, continue without it
      }

      const reportsService = new ReportsCoreService();
      const netWorthData = await reportsService.getNetWorth(
        userId,
        accountsToUse,
        unpaidDebts,
        portfolioSummary,
        accessToken,
        refreshToken
      );

      if (!netWorthData) {
        return null;
      }

      // Calculate drivers
      const drivers = [];
      if (netWorthData.change.amount !== 0) {
        if (netWorthData.totalAssets > 0) {
          const assetChange = netWorthData.change.amount > 0 ? netWorthData.change.amount : 0;
          if (assetChange > 0) {
            drivers.push({
              type: 'assets' as const,
              label: 'Assets increased',
              change: assetChange,
              changePercentage: netWorthData.change.percent,
            });
          }
        }
        if (netWorthData.totalLiabilities > 0) {
          const liabilityChange = netWorthData.change.amount < 0 ? Math.abs(netWorthData.change.amount) : 0;
          if (liabilityChange > 0) {
            drivers.push({
              type: 'liabilities' as const,
              label: 'Liabilities decreased',
              change: -liabilityChange,
              changePercentage: -netWorthData.change.percent,
            });
          }
        }
      }

      // Build actions
      const actions: import("@/src/domain/dashboard/types").WidgetAction[] = [
        {
          label: "View Net Worth Report",
          href: "/reports?tab=net-worth",
          variant: 'primary',
        },
      ];

      if (netWorthData.change.amount < 0) {
        actions.push({
          label: "Review Expenses",
          href: "/transactions",
          variant: 'secondary' as const,
        });
      } else if (netWorthData.change.amount > 0) {
        actions.push({
          label: "Set Savings Goal",
          href: "/goals/new",
          variant: 'secondary' as const,
        });
      }

      // Build insights
      const insights = [];
      if (netWorthData.netWorth < 0) {
        insights.push({
          type: 'warning' as const,
          message: "Your net worth is negative. Focus on reducing debt and increasing savings.",
          actionHref: "/debts",
          actionLabel: "View Debts",
        });
      } else if (netWorthData.change.amount > 0) {
        insights.push({
          type: 'success' as const,
          message: `Your net worth increased by ${Math.abs(netWorthData.change.percent).toFixed(1)}%`,
        });
      }

      return {
        totalAssets: netWorthData.totalAssets,
        totalLiabilities: netWorthData.totalLiabilities,
        netWorth: netWorthData.netWorth,
        change: netWorthData.change.amount,
        changePercentage: netWorthData.change.percent,
        drivers,
        historical: netWorthData.historical.map(h => ({
          date: h.date,
          netWorth: h.netWorth,
        })),
        actions,
        insights,
      };
    } catch (error) {
      logger.error("[DashboardService] Error getting Net Worth widget:", error);
      return null;
    }
  }

  /**
   * Widget 3: Get Cash Flow Widget Data
   */
  async getCashFlowWidget(
    userId: string,
    startDate: Date,
    endDate: Date,
    previousStartDate: Date,
    previousEndDate: Date,
    accessToken?: string,
    refreshToken?: string
  ): Promise<CashFlowWidgetData | null> {
    try {
      const transactionsService = makeTransactionsService();

      // Get current period transactions
      const currentResult = await transactionsService.getTransactions(
        { startDate, endDate },
        accessToken,
        refreshToken
      );
      const currentTransactions = Array.isArray(currentResult) ? currentResult : (currentResult?.transactions || []);

      // Get previous period transactions
      const previousResult = await transactionsService.getTransactions(
        { startDate: previousStartDate, endDate: previousEndDate },
        accessToken,
        refreshToken
      );
      const previousTransactions = Array.isArray(previousResult) ? previousResult : (previousResult?.transactions || []);

      // Calculate current period
      const income = currentTransactions
        .filter(t => t.type === 'income' && !t.transferFromId && !t.transferToId)
        .reduce((sum, t) => sum + Math.abs(getTransactionAmount(t.amount) || 0), 0);

      const expenses = currentTransactions
        .filter(t => t.type === 'expense' && !t.transferFromId && !t.transferToId)
        .reduce((sum, t) => sum + Math.abs(getTransactionAmount(t.amount) || 0), 0);

      const net = income - expenses;
      const spendingRatio = income > 0 ? (expenses / income) * 100 : 0;

      // Calculate previous period for comparison
      const previousIncome = previousTransactions
        .filter(t => t.type === 'income' && !t.transferFromId && !t.transferToId)
        .reduce((sum, t) => sum + Math.abs(getTransactionAmount(t.amount) || 0), 0);

      const previousExpenses = previousTransactions
        .filter(t => t.type === 'expense' && !t.transferFromId && !t.transferToId)
        .reduce((sum, t) => sum + Math.abs(getTransactionAmount(t.amount) || 0), 0);

      const previousNet = previousIncome - previousExpenses;

      // Calculate changes
      const incomeChange = previousIncome > 0 ? ((income - previousIncome) / previousIncome) * 100 : 0;
      const expensesChange = previousExpenses > 0 ? ((expenses - previousExpenses) / previousExpenses) * 100 : 0;
      const netChange = previousNet !== 0 ? ((net - previousNet) / Math.abs(previousNet)) * 100 : 0;

      // Build actions
      const actions: import("@/src/domain/dashboard/types").WidgetAction[] = [];
      if (net < 0) {
        actions.push({
          label: "Review Expenses",
          href: "/transactions?type=expense",
          variant: 'primary',
        });
      } else {
        actions.push({
          label: "Allocate to Goals",
          href: "/goals",
          variant: 'primary' as const,
        });
      }

      if (spendingRatio > 90) {
        actions.push({
          label: "Adjust Budget",
          href: "/budgets",
          variant: 'secondary' as const,
        });
      }

      // Build insights
      const insights = [];
      if (net < 0) {
        insights.push({
          type: 'error' as const,
          message: `You're spending $${Math.abs(net).toFixed(2)} more than you earn this period.`,
          actionHref: "/transactions?type=expense",
          actionLabel: "Review Expenses",
        });
      } else if (spendingRatio > 80) {
        insights.push({
          type: 'warning' as const,
          message: `You're spending ${spendingRatio.toFixed(1)}% of your income. Consider reducing expenses.`,
        });
      } else if (net > 0) {
        insights.push({
          type: 'success' as const,
          message: `You have $${net.toFixed(2)} remaining after expenses.`,
        });
      }

      return {
        income,
        expenses,
        net,
        spendingRatio,
        comparison: {
          incomeChange,
          expensesChange,
          netChange,
          period: "vs last month",
        },
        actions,
        insights,
      };
    } catch (error) {
      logger.error("[DashboardService] Error getting Cash Flow widget:", error);
      return null;
    }
  }

  /**
   * Widget 4: Get Budget Performance Widget Data
   */
  async getBudgetPerformanceWidget(
    userId: string,
    period: Date,
    accessToken?: string,
    refreshToken?: string
  ): Promise<BudgetPerformanceWidgetData | null> {
    try {
      const budgetsService = makeBudgetsService();
      const budgets = await budgetsService.getBudgets(period, accessToken, refreshToken);

      if (budgets.length === 0) {
        return null;
      }

      // Calculate totals
      const totalBudgeted = budgets.reduce((sum, b) => sum + (b.amount || 0), 0);
      const totalActual = budgets.reduce((sum, b) => sum + (b.actualSpend || 0), 0);
      const totalDifference = totalActual - totalBudgeted;

      // Build categories
      const categories = budgets
        .filter(b => b.categoryId && b.category)
        .map(b => ({
          categoryId: b.categoryId!,
          categoryName: b.category!.name,
          budgeted: b.amount || 0,
          actual: b.actualSpend || 0,
          difference: (b.actualSpend || 0) - (b.amount || 0),
          percentage: b.amount > 0 ? ((b.actualSpend || 0) / b.amount) * 100 : 0,
          isOverspending: (b.actualSpend || 0) > (b.amount || 0),
        }))
        .sort((a, b) => {
          // Sort by overspending first, then by difference amount
          if (a.isOverspending && !b.isOverspending) return -1;
          if (!a.isOverspending && b.isOverspending) return 1;
          return Math.abs(b.difference) - Math.abs(a.difference);
        });

      // Build actions
      const actions = [
        {
          label: "View All Budgets",
          href: "/budgets",
          variant: 'primary' as const,
        },
      ];

      // Build insights
      const insights = [];
      const overspendingCategories = categories.filter(c => c.isOverspending);
      if (overspendingCategories.length > 0) {
        insights.push({
          type: 'warning' as const,
          message: `${overspendingCategories.length} categor${overspendingCategories.length === 1 ? 'y' : 'ies'} ${overspendingCategories.length === 1 ? 'is' : 'are'} over budget`,
          actionHref: "/budgets",
          actionLabel: "Review Budgets",
        });
      }

      return {
        categories,
        totalBudgeted,
        totalActual,
        totalDifference,
        period: format(period, "MMMM yyyy"),
        actions,
        insights,
      };
    } catch (error) {
      logger.error("[DashboardService] Error getting Budget Performance widget:", error);
      return null;
    }
  }

  /**
   * Widget 5: Get Top Spending Categories Widget Data
   */
  async getTopSpendingCategoriesWidget(
    userId: string,
    startDate: Date,
    endDate: Date,
    previousStartDate: Date,
    previousEndDate: Date,
    accessToken?: string,
    refreshToken?: string
  ): Promise<TopSpendingCategoriesWidgetData | null> {
    try {
      const transactionsService = makeTransactionsService();

      // Get current period transactions
      const currentResult = await transactionsService.getTransactions(
        { startDate, endDate },
        accessToken,
        refreshToken
      );
      const currentTransactions = Array.isArray(currentResult) ? currentResult : (currentResult?.transactions || []);

      // Get previous period transactions
      const previousResult = await transactionsService.getTransactions(
        { startDate: previousStartDate, endDate: previousEndDate },
        accessToken,
        refreshToken
      );
      const previousTransactions = Array.isArray(previousResult) ? previousResult : (previousResult?.transactions || []);

      // Group current period by category
      const currentCategoryMap = new Map<string, { amount: number; categoryId: string; categoryName: string }>();
      currentTransactions
        .filter(t => t.type === 'expense' && !t.transferFromId && !t.transferToId && t.categoryId)
        .forEach(t => {
          const categoryId = t.categoryId!;
          const categoryName = t.category?.name || 'Uncategorized';
          const amount = Math.abs(getTransactionAmount(t.amount) || 0);
          const existing = currentCategoryMap.get(categoryId) || { amount: 0, categoryId, categoryName };
          currentCategoryMap.set(categoryId, {
            ...existing,
            amount: existing.amount + amount,
          });
        });

      // Group previous period by category
      const previousCategoryMap = new Map<string, number>();
      previousTransactions
        .filter(t => t.type === 'expense' && !t.transferFromId && !t.transferToId && t.categoryId)
        .forEach(t => {
          const categoryId = t.categoryId!;
          const amount = Math.abs(getTransactionAmount(t.amount) || 0);
          previousCategoryMap.set(categoryId, (previousCategoryMap.get(categoryId) || 0) + amount);
        });

      // Calculate total spending
      const totalSpending = Array.from(currentCategoryMap.values()).reduce((sum, c) => sum + c.amount, 0);

      // Check which categories have budgets
      const budgetsService = makeBudgetsService();
      const budgets = await budgetsService.getBudgets(startDate, accessToken, refreshToken);
      const categoriesWithBudgets = new Set(budgets.filter(b => b.categoryId).map(b => b.categoryId!));

      // Build categories with deltas
      const categories = Array.from(currentCategoryMap.values())
        .map(c => {
          const previousAmount = previousCategoryMap.get(c.categoryId) || 0;
          const delta = c.amount - previousAmount;
          const deltaPercentage = previousAmount > 0 ? (delta / previousAmount) * 100 : 0;

          return {
            categoryId: c.categoryId,
            categoryName: c.categoryName,
            amount: c.amount,
            percentage: totalSpending > 0 ? (c.amount / totalSpending) * 100 : 0,
            delta,
            deltaPercentage,
            hasBudget: categoriesWithBudgets.has(c.categoryId),
          };
        })
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8); // Top 8 categories

      if (categories.length === 0) {
        return null;
      }

      // Build actions
      const actions = [
        {
          label: "View All Categories",
          href: "/transactions",
          variant: 'primary' as const,
        },
      ];

      // Build insights
      const insights = [];
      const increasedCategories = categories.filter(c => c.deltaPercentage > 20);
      if (increasedCategories.length > 0) {
        insights.push({
          type: 'info' as const,
          message: `${increasedCategories.length} categor${increasedCategories.length === 1 ? 'y' : 'ies'} increased significantly`,
        });
      }

      return {
        categories,
        totalSpending,
        period: format(startDate, "MMMM yyyy"),
        comparisonPeriod: format(previousStartDate, "MMMM yyyy"),
        actions,
        insights,
      };
    } catch (error) {
      logger.error("[DashboardService] Error getting Top Spending Categories widget:", error);
      return null;
    }
  }

  /**
   * Widget 6: Get Upcoming Payments Widget Data
   */
  async getUpcomingPaymentsWidget(
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<UpcomingPaymentsWidgetData | null> {
    try {
      const plannedPaymentsService = makePlannedPaymentsService();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const next30Days = addDays(today, 30);

      const result = await plannedPaymentsService.getPlannedPayments(
        {
          startDate: today,
          endDate: next30Days,
          status: 'scheduled',
        },
        accessToken,
        refreshToken,
        userId
      );

      const payments = result.plannedPayments;

      if (payments.length === 0) {
        return null;
      }

      // Get account balances to check for overdraft
      const accounts: import("@/src/domain/accounts/accounts.types").AccountWithBalance[] = await getAccountsForDashboard(true, accessToken, refreshToken);
      const accountBalances = new Map(accounts.map(a => [a.id, a.balance]));

      // Build upcoming payments
      const upcomingPayments = payments
        .filter(p => p.type === 'expense')
        .map(p => {
          const paymentDate = new Date(p.date);
          const daysUntil = differenceInDays(paymentDate, today);
          const accountBalance = (accountBalances.get(p.accountId) as number) || 0;
          const isOverBudget = accountBalance < p.amount;

          return {
            id: p.id,
            date: p.date instanceof Date ? p.date.toISOString() : p.date,
            amount: p.amount,
            description: p.description || 'Payment',
            category: p.category?.name,
            accountId: p.accountId,
            accountName: p.account?.name,
            isOverBudget,
            daysUntil,
          };
        })
        .sort((a, b) => a.daysUntil - b.daysUntil);

      // Calculate totals
      const totalDue = upcomingPayments.reduce((sum, p) => sum + p.amount, 0);
      const next7Days = addDays(today, 7);
      const totalDueNext7Days = upcomingPayments
        .filter(p => new Date(p.date) <= next7Days)
        .reduce((sum, p) => sum + p.amount, 0);

      // Build actions
      const actions: import("@/src/domain/dashboard/types").WidgetAction[] = [
        {
          label: "Add Payment",
          href: "/planned-payments/new",
          variant: 'primary',
        },
        {
          label: "View All Payments",
          href: "/planned-payments",
          variant: 'secondary',
        },
      ];

      // Build insights
      const insights = [];
      const overBudgetPayments = upcomingPayments.filter(p => p.isOverBudget);
      if (overBudgetPayments.length > 0) {
        insights.push({
          type: 'warning' as const,
          message: `${overBudgetPayments.length} payment${overBudgetPayments.length === 1 ? '' : 's'} may exceed available balance`,
          actionHref: "/budgets",
          actionLabel: "Review Budget",
        });
      }

      if (totalDueNext7Days > 0) {
        insights.push({
          type: 'info' as const,
          message: `$${totalDueNext7Days.toFixed(2)} due in the next 7 days`,
        });
      }

      return {
        payments: upcomingPayments,
        totalDue,
        totalDueNext7Days,
        period: "next 30 days",
        actions,
        insights,
      };
    } catch (error) {
      logger.error("[DashboardService] Error getting Upcoming Payments widget:", error);
      return null;
    }
  }

  /**
   * Widget 7: Get Goals Progress Widget Data
   */
  async getGoalsProgressWidget(
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<GoalsProgressWidgetData | null> {
    try {
      const goalsService = makeGoalsService();
      const goals = await goalsService.getGoals(accessToken, refreshToken);

      // Filter active, non-paused goals
      const activeGoals = goals.filter(g => !g.isPaused && !g.isCompleted);

      // if (activeGoals.length === 0) {
      //   return null;
      // }
      // Always return structure so widget can show empty state

      // Build goal progress
      const goalsProgress = activeGoals.map(goal => {
        const progressPercentage = goal.targetAmount > 0
          ? (goal.currentBalance / goal.targetAmount) * 100
          : 0;

        // Calculate months remaining and monthly contribution needed
        let monthsRemaining: number | null = null;
        let monthlyContributionNeeded = 0;

        if (goal.targetMonths && goal.targetMonths > 0) {
          monthsRemaining = goal.targetMonths;
          const remainingAmount = goal.targetAmount - goal.currentBalance;
          monthlyContributionNeeded = remainingAmount > 0 && monthsRemaining > 0
            ? remainingAmount / monthsRemaining
            : 0;
        } else if (goal.monthlyContribution && goal.monthlyContribution > 0) {
          const remainingAmount = goal.targetAmount - goal.currentBalance;
          monthsRemaining = remainingAmount > 0 && goal.monthlyContribution > 0
            ? Math.ceil(remainingAmount / goal.monthlyContribution)
            : null;
          monthlyContributionNeeded = goal.monthlyContribution;
        }

        // Check if behind schedule (if target months is set)
        let isBehindSchedule = false;
        if (goal.targetMonths && goal.targetMonths > 0 && monthsRemaining !== null) {
          const expectedProgress = (goal.targetMonths - monthsRemaining) / goal.targetMonths;
          const actualProgress = progressPercentage / 100;
          isBehindSchedule = actualProgress < expectedProgress - 0.1; // 10% tolerance
        }

        return {
          id: goal.id,
          name: goal.name,
          currentBalance: goal.currentBalance,
          targetAmount: goal.targetAmount,
          progressPercentage: Math.min(100, Math.max(0, progressPercentage)),
          monthsRemaining,
          monthlyContributionNeeded,
          isBehindSchedule,
        };
      });

      // Build actions
      const actions = [
        {
          label: "View All Goals",
          href: "/goals",
          variant: 'primary' as const,
        },
        {
          label: "Create Goal",
          href: "/goals/new",
          variant: 'secondary' as const,
        },
      ];

      // Build insights
      const insights = [];
      const behindScheduleGoals = goalsProgress.filter(g => g.isBehindSchedule);
      if (behindScheduleGoals.length > 0) {
        insights.push({
          type: 'warning' as const,
          message: `${behindScheduleGoals.length} goal${behindScheduleGoals.length === 1 ? '' : 's'} ${behindScheduleGoals.length === 1 ? 'is' : 'are'} behind schedule`,
          actionHref: "/goals",
          actionLabel: "View Goals",
        });
      }

      return {
        goals: goalsProgress,
        totalGoals: goals.length,
        activeGoals: activeGoals.length,
        actions,
        insights,
      };
    } catch (error) {
      logger.error("[DashboardService] Error getting Goals Progress widget:", error);
      return null;
    }
  }

  /**
   * Widget 8: Get Financial Alerts Widget Data
   */
  async getFinancialAlertsWidget(
    userId: string,
    selectedDate?: Date,
    accessToken?: string,
    refreshToken?: string,
    accounts?: AccountWithBalance[] | null
  ): Promise<FinancialAlertsWidgetData> {
    const alerts: Array<{
      id: string;
      type: 'emergency-fund' | 'overdraft-risk' | 'upcoming-shortfall' | 'budget-exceeded' | 'debt-high' | 'other';
      severity: 'critical' | 'warning' | 'info';
      title: string;
      description: string;
      actionHref: string;
      actionLabel: string;
      dismissible: boolean;
    }> = [];

    try {
      // Reuse accounts if provided, otherwise fetch
      const accountsToUse = accounts || await getAccountsForDashboard(true, accessToken, refreshToken);
      const financialHealth = await calculateFinancialHealth(selectedDate, userId, accessToken, refreshToken, accountsToUse);

      // Alert 1: Emergency fund
      if (financialHealth.emergencyFundMonths < 6) {
        alerts.push({
          id: 'emergency-fund-low',
          type: 'emergency-fund',
          severity: financialHealth.emergencyFundMonths < 3 ? 'critical' : 'warning',
          title: 'Emergency Fund Low',
          description: `You have ${financialHealth.emergencyFundMonths.toFixed(1)} months of expenses covered. Recommended: 6 months.`,
          actionHref: '/goals/new?type=emergency-fund',
          actionLabel: 'Set Up Emergency Fund',
          dismissible: true,
        });
      }

      // Alert 2: Overdraft risk
      const lowBalanceAccounts = accountsToUse.filter((a: AccountWithBalance) => {
        const balance = a.balance || 0;
        return balance < 100 && (a.type === 'checking' || a.type === 'savings');
      });

      if (lowBalanceAccounts.length > 0) {
        alerts.push({
          id: 'overdraft-risk',
          type: 'overdraft-risk',
          severity: 'warning',
          title: 'Low Account Balance',
          description: `${lowBalanceAccounts.length} account${lowBalanceAccounts.length === 1 ? '' : 's'} ${lowBalanceAccounts.length === 1 ? 'has' : 'have'} a low balance`,
          actionHref: '/accounts',
          actionLabel: 'View Accounts',
          dismissible: true,
        });
      }

      // Alert 3: Negative cash flow
      if (financialHealth.netAmount < 0) {
        alerts.push({
          id: 'negative-cash-flow',
          type: 'upcoming-shortfall',
          severity: 'critical',
          title: 'Negative Cash Flow',
          description: `You're spending $${Math.abs(financialHealth.netAmount).toFixed(2)} more than you earn monthly.`,
          actionHref: '/budgets',
          actionLabel: 'Review Budget',
          dismissible: true,
        });
      }

      // Alert 4: High debt exposure
      if (financialHealth.debtExposure === 'High') {
        alerts.push({
          id: 'debt-high',
          type: 'debt-high',
          severity: 'warning',
          title: 'High Debt Exposure',
          description: 'Your debt-to-income ratio is high. Consider a debt payoff strategy.',
          actionHref: '/debts',
          actionLabel: 'View Debts',
          dismissible: true,
        });
      }

      // Sort by severity (critical first)
      const severityOrder = { critical: 3, warning: 2, info: 1 };
      alerts.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);

      return {
        alerts,
        hasAlerts: alerts.length > 0,
        actions: [],
        insights: [],
      };
    } catch (error) {
      logger.error("[DashboardService] Error getting Financial Alerts widget:", error);
      return {
        alerts: [],
        hasAlerts: false,
        actions: [],
        insights: [],
      };
    }
  }

  /**
   * Widget 9: Get Debt Overview Widget Data
   */
  async getDebtOverviewWidget(
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<DebtOverviewWidgetData | null> {
    try {
      const debtsService = makeDebtsService();
      const debts = await debtsService.getDebts(accessToken, refreshToken);

      // Filter unpaid debts
      const unpaidDebts = debts.filter(d => !d.isPaidOff);

      if (unpaidDebts.length === 0) {
        return null;
      }

      // Calculate totals
      const totalDebt = unpaidDebts.reduce((sum, d) => sum + (d.currentBalance || 0), 0);
      const monthlyPayments = unpaidDebts.reduce((sum, d) => sum + (d.monthlyPayment || 0), 0);

      // Calculate payoff timeline (simplified: assume current payment rate)
      let payoffTimeline = 0;
      if (monthlyPayments > 0) {
        // Rough estimate: total debt / monthly payments
        payoffTimeline = Math.ceil(totalDebt / monthlyPayments);
      }

      // Find next milestone (debt with lowest balance or shortest time)
      let nextMilestone = null;
      if (unpaidDebts.length > 0) {
        // Sort by balance (lowest first) or by remaining months
        const sortedDebts = [...unpaidDebts].sort((a, b) => {
          const aBalance = a.currentBalance || 0;
          const bBalance = b.currentBalance || 0;
          return aBalance - bBalance;
        });

        const closestDebt = sortedDebts[0];
        if (closestDebt) {
          const monthsUntilPayoff = closestDebt.monthlyPayment > 0
            ? Math.ceil((closestDebt.currentBalance || 0) / closestDebt.monthlyPayment)
            : null;

          if (monthsUntilPayoff !== null && monthsUntilPayoff > 0) {
            nextMilestone = {
              debtId: closestDebt.id,
              debtName: closestDebt.name,
              monthsUntilMilestone: monthsUntilPayoff,
              milestoneDescription: `Pay off ${closestDebt.name}`,
            };
          }
        }
      }

      // Build actions
      const actions: import("@/src/domain/dashboard/types").WidgetAction[] = [
        {
          label: "View Debt Details",
          href: "/debts",
          variant: 'primary',
        },
      ];

      if (nextMilestone) {
        actions.push({
          label: "Make Extra Payment",
          href: `/debts/${nextMilestone.debtId}?action=pay`,
          variant: 'secondary' as const,
        });
        actions.push({
          label: "Optimize Payoff Strategy",
          href: "/debts?tab=strategies",
          variant: 'link' as const,
        });
      }

      // Build insights
      const insights = [];
      if (payoffTimeline > 60) {
        insights.push({
          type: 'warning' as const,
          message: `At current payment rate, it will take ${payoffTimeline} months to pay off all debts`,
          actionHref: "/debts?tab=strategies",
          actionLabel: "Optimize Strategy",
        });
      }

      return {
        totalDebt,
        monthlyPayments,
        payoffTimeline,
        nextMilestone,
        totalDebts: unpaidDebts.length,
        actions,
        insights,
      };
    } catch (error) {
      logger.error("[DashboardService] Error getting Debt Overview widget:", error);
      return null;
    }
  }

  /**
   * Widget 10: Get Investment Portfolio Widget Data
   */
  async getInvestmentPortfolioWidget(
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<InvestmentPortfolioWidgetData | null> {
    try {
      // Check if user has access to investments
      const { guardFeatureAccessReadOnly } = await import("@/src/application/shared/feature-guard");
      const featureGuard = await guardFeatureAccessReadOnly(userId, "hasInvestments");
      if (!featureGuard.allowed) {
        return null;
      }

      const portfolioService = makePortfolioService();
      const summary = await portfolioService.getPortfolioSummaryInternal(accessToken, refreshToken).catch(() => null);

      if (!summary) {
        return null;
      }

      // Get holdings for allocation
      const holdings = await portfolioService.getPortfolioHoldings(accessToken, refreshToken).catch(() => []);

      // Calculate allocation by asset class (simplified)
      const allocationMap = new Map<string, number>();
      holdings.forEach((h: any) => {
        const assetClass = h.assetType || h.security?.class || 'Other';
        const value = h.marketValue || 0;
        allocationMap.set(assetClass, (allocationMap.get(assetClass) || 0) + value);
      });

      const totalValue = summary.totalValue || 0;
      const allocation = Array.from(allocationMap.entries()).map(([assetClass, value]) => ({
        assetClass,
        value,
        percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
      }));

      // Calculate performance (simplified - would need historical data for accurate YTD/1Y)
      const performanceYTD = summary.totalReturnPercent || 0;
      const performance1Y = summary.totalReturnPercent || 0; // Would need 1Y calculation

      // Build actions
      const actions: import("@/src/domain/dashboard/types").WidgetAction[] = [
        {
          label: "View Portfolio",
          href: "/investments",
          variant: 'primary',
        },
      ];

      // Check if allocation is off target (simplified check)
      const isOffTarget = allocation.some(a => {
        // Simple check: if any single asset class is > 80% or < 5%
        return a.percentage > 80 || (a.percentage < 5 && a.percentage > 0);
      });

      if (isOffTarget) {
        actions.push({
          label: "Rebalance Portfolio",
          href: "/investments?action=rebalance",
          variant: 'secondary' as const,
        });
      }

      actions.push({
        label: "Add Investment",
        href: "/investments/new",
        variant: 'link' as const,
      });

      // Build insights
      const insights = [];
      if (performanceYTD < 0) {
        insights.push({
          type: 'warning' as const,
          message: `Portfolio is down ${Math.abs(performanceYTD).toFixed(1)}% YTD`,
        });
      } else if (performanceYTD > 0) {
        insights.push({
          type: 'success' as const,
          message: `Portfolio is up ${performanceYTD.toFixed(1)}% YTD`,
        });
      }

      return {
        totalValue,
        allocation,
        performanceYTD,
        performance1Y,
        isOffTarget,
        actions,
        insights,
      };
    } catch (error) {
      logger.error("[DashboardService] Error getting Investment Portfolio widget:", error);
      return null;
    }
  }

  /**
   * Widget (New): Total Budgets
   */
  async getTotalBudgetsWidget(
    userId: string,
    period: Date,
    accessToken?: string,
    refreshToken?: string
  ): Promise<TotalBudgetsWidgetData | null> {
    try {
      const budgetsService = makeBudgetsService();
      const budgets = await budgetsService.getBudgets(period, accessToken, refreshToken);

      const totalBudgeted = budgets.reduce((sum, b) => sum + (b.amount || 0), 0);
      
      const categories = budgets
        .filter(b => b.categoryId && b.category)
        .map(b => {
          const spent = b.actualSpend || 0;
          const budget = b.amount || 0;
          return {
            id: b.id,
            name: b.category!.name,
            spent,
            budget,
            percentage: budget > 0 ? (spent / budget) * 100 : 0,
            color: getCategoryColor(b.category!.name),
            allocationPercentage: totalBudgeted > 0 ? (budget / totalBudgeted) * 100 : 0,
          };
        })
        .sort((a, b) => b.budget - a.budget) // Sort by allocation size
        .slice(0, 4); // Limit to top 4 for the widget

        return {
          totalAmount: totalBudgeted,
          period: "Expenses",
          categories,
          actions: [],
          insights: []
        };
    } catch (error) {
      logger.error("[DashboardService] Error getting Total Budgets widget:", error);
      return null;
    }
  }

  /**
   * Widget (New): Spending This Month (vs Last Month)
   */
  async getSpendingWidget(
    userId: string,
    startDate: Date, // Start of this month
    endDate: Date, // End of this month (or today)
    previousStartDate: Date, // Start of last month
    previousEndDate: Date, // End of last month
    accessToken?: string,
    refreshToken?: string
  ): Promise<SpendingWidgetData | null> {
    try {
      const transactionsService = makeTransactionsService();

      // Get current period transactions
      // Note: We need daily granularity.
      const currentResult = await transactionsService.getTransactions(
        { startDate, endDate },
        accessToken,
        refreshToken
      );
      const currentTransactions = Array.isArray(currentResult) ? currentResult : (currentResult?.transactions || []);

      // Get previous period transactions
      const previousResult = await transactionsService.getTransactions(
        { startDate: previousStartDate, endDate: previousEndDate },
        accessToken,
        refreshToken
      );
      const previousTransactions = Array.isArray(previousResult) ? previousResult : (previousResult?.transactions || []);

      // Helper to aggregate by day
      const aggregateByDay = (transactions: TransactionWithRelations[], start: Date, end: Date) => {
        const dailyMap = new Map<number, number>();
        
        transactions
          .filter(t => t.type === 'expense' && !t.transferFromId && !t.transferToId) // Expenses only
          .forEach(t => {
            const day = getDate(new Date(t.date));
            const amount = Math.abs(getTransactionAmount(t.amount) || 0);
            dailyMap.set(day, (dailyMap.get(day) || 0) + amount);
          });

        // Create cumulative series
        const daysInMonth = differenceInDays(end, start) + 1;
        const data = [];
        let cumulative = 0;
        
        // We only want to plot up to today if it's the current month to avoid flat line in future
        const isCurrentMonth = isSameDay(start, startOfMonth(new Date()));
        const todayDay = getDate(new Date());

        for (let i = 1; i <= 31; i++) {
          // If current month and day is in future, stop (optional, but looks better)
          if (isCurrentMonth && i > todayDay) break;
          // If past end of month (e.g. Feb 30), break
          // A safer way is checking if date exists in interval, but simplified: 
          // Check if date i exists in this month
           const checkDate = new Date(start.getFullYear(), start.getMonth(), i);
           if (checkDate.getMonth() !== start.getMonth()) break;

           const dailyAmount = dailyMap.get(i) || 0;
           cumulative += dailyAmount;
           
           data.push({
             date: format(checkDate, 'd MMM'),
             amount: dailyAmount,
             cumulative
           });
        }
        return data;
      };

      const currentSeriesData = aggregateByDay(currentTransactions, startDate, endDate);
      const previousSeriesData = aggregateByDay(previousTransactions, previousStartDate, previousEndDate);
      
      // Calculate categories breakdown for current month
      const categoryMap = new Map<string, { id: string; name: string; value: number }>();
      currentTransactions
        .filter(t => t.type === 'expense' && !t.transferFromId && !t.transferToId)
        .forEach(t => {
          const categoryId = t.categoryId || 'uncategorized';
          const categoryName = t.category?.name || 'Uncategorized';
          const amount = Math.abs(getTransactionAmount(t.amount) || 0);
          
          const existing = categoryMap.get(categoryId) || { id: categoryId, name: categoryName, value: 0 };
          categoryMap.set(categoryId, { ...existing, value: existing.value + amount });
        });

      const categoriesList = Array.from(categoryMap.values())
        .sort((a, b) => b.value - a.value)
        .map(c => ({
          ...c,
          color: getCategoryColor(c.name)
        }));
      
      const currentTotal = currentSeriesData.length > 0 ? currentSeriesData[currentSeriesData.length - 1].cumulative : 0;

        return {
        currentTotal,
        comparisonPeriod: "This month vs. last month",
        series: [
          {
            label: "This month",
            data: currentSeriesData,
            color: "#f97316", // Orange
          },
          {
            label: "Last month",
            data: previousSeriesData,
            color: "#9ca3af", // Gray
          }
        ],
        categories: categoriesList,
        actions: [],
        insights: []
      };

    } catch (error) {
       logger.error("[DashboardService] Error getting Spending widget:", error);
       return null;
    }
  }

  /**
   * Widget (New): Recent Transactions
   */
  async getRecentTransactionsWidget(
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<RecentTransactionsWidgetData | null> {
    try {
      const transactionsService = makeTransactionsService();
      // Get recent 5 transactions
      const result = await transactionsService.getTransactions(
        { limit: 5 }, 
        accessToken, 
        refreshToken
      );
      const transactions = Array.isArray(result) ? result : (result?.transactions || []);
      
      const items = transactions.map(t => ({
        id: t.id,
        name: t.name || t.description || 'Unknown',
        amount: Math.abs(getTransactionAmount(t.amount) || 0),
        date: format(new Date(t.date), 'dd MMM'),
        category: t.category?.name || 'Uncategorized',
        type: t.type as 'income' | 'expense' | 'transfer',
        categoryColor: getCategoryColor(t.category?.name),
        // Simplistic icon logic or none
      }));

      return {
        transactions: items,
        actions: [
          {
            label: "See all",
            href: "/transactions",
            variant: "link"
          }
        ],
        insights: []
      };
    } catch(error) {
      logger.error("[DashboardService] Error getting Recent Transactions widget:", error);
      return null;
    }
  }

  /**
   * Widget (New): Recurring Payments
   */
  async getRecurringWidget(
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<RecurringWidgetData | null> {
    try {
      // Use upcoming payments logic or subscriptions logic
      // Ideally we should use Subscriptions/Planned Payments
      // Let's use Upcoming Payments for now as a proxy, but filter for recurring-like things? 
      // Or if available, SubscriptionsService. 
      // Looking at imports, we have planned-payments service
      const plannedPaymentsService = makePlannedPaymentsService();
      // getPlannedPayments(filters, accessToken, refreshToken, userId)
      const { plannedPayments } = await plannedPaymentsService.getPlannedPayments(
        {}, 
        accessToken, 
        refreshToken, 
        userId
      );
      
      // Filter next few
      // Sort by next date
      const items = plannedPayments
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 5)
        .map((p) => ({
          id: p.id,
          name: p.description || 'Payment',
          amount: p.amount || 0,
          frequency: p.source === 'recurring' || p.source === 'subscription' ? 'Recurring' : 'One-time',
          nextDate: format(new Date(p.date), 'dd MMM'),
        }));
        
       return {
         items,
         actions: [
           {
             label: "See all",
             href: "/planned-payment",
             variant: "link"
           }
         ],
         insights: []
       };

    } catch (error) {
       logger.error("[DashboardService] Error getting Recurring widget:", error);
       return null;
    }
  }

  /**
   * Widget (New): Investment Holdings
   */
  async getInvestmentHoldingsWidget(
    userId: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<InvestmentHoldingsWidgetData | null> {
    try {
       const portfolioService = makePortfolioService();
       const holdings = await portfolioService.getPortfolioHoldings(accessToken, refreshToken);
       
       // Map to widget format
       // limit to top 5 by value?
       const items = holdings
         .sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0))
         .slice(0, 5)
         .map((h) => ({
           symbol: h.symbol,
           name: h.name,
           value: h.marketValue,
           change: h.unrealizedPnLPercent, 
           changeValue: h.unrealizedPnL
         }));

       return {
         holdings: items,
         actions: [
           {
             label: "See all",
             href: "/investments/portfolio",
             variant: "link"
           }
         ],
         insights: []
       };
    } catch (error) {
      logger.error("[DashboardService] Error getting Investment Holdings widget:", error);
      return null;
    }
  }

  /**
   * Widget (New): Subscriptions
   */
  async getSubscriptionsWidget(
    userId: string
  ): Promise<SubscriptionsWidgetData | null> {
    try {
       const userSubscriptionsService = makeUserSubscriptionsService();
       const subscriptions = await userSubscriptionsService.getUserSubscriptions(userId);

       if (subscriptions.length === 0) {
         return {
           items: [],
           totalMonthly: 0,
           actions: [
             {
               label: "See all",
               href: "/planning/subscriptions",
               variant: "link"
             }
           ],
           insights: []
         }; 
       }

       // Map to widget format
       const items = subscriptions
         .sort((a, b) => b.amount - a.amount)
         .slice(0, 5)
         .map((s) => {
            // Capitalize frequency or use as is if valid
            const frequency = s.billingFrequency.charAt(0).toUpperCase() + s.billingFrequency.slice(1);
            return {
              id: s.id,
              name: s.serviceName,
              amount: s.amount,
              frequency, 
              nextDate: format(new Date(s.firstBillingDate), 'dd MMM'), // Approximate
              logo: s.serviceLogo
            };
         });

       const totalMonthly = subscriptions.reduce((sum, s) => {
         // Simple monthly normalization
         let monthlyAmount = s.amount;
         if (s.billingFrequency === 'weekly') monthlyAmount *= 4;
         else if (s.billingFrequency === 'biweekly') monthlyAmount *= 2;
         else if (s.billingFrequency === 'semimonthly') monthlyAmount *= 2;
         else if (s.billingFrequency === 'daily') monthlyAmount *= 30;
         return sum + monthlyAmount;
       }, 0);

       return {
         items,
         totalMonthly,
         actions: [
           {
             label: "See all",
             href: "/planning/subscriptions",
             variant: "link"
           }
         ],
         insights: []
       };

    } catch (error) {
       logger.error("[DashboardService] Error getting Subscriptions widget:", error);
       return null;
    }
  }
}
