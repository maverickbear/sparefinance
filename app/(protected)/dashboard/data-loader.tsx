import { getTransactions } from "@/lib/api/transactions";
import { getTotalInvestmentsValue } from "@/lib/api/simple-investments";
import { getBudgets } from "@/lib/api/budgets";
import { getUpcomingTransactions } from "@/lib/api/transactions";
import { calculateFinancialHealth } from "@/lib/api/financial-health";
import { getGoals } from "@/lib/api/goals";
import { getAccounts } from "@/lib/api/accounts";
import { checkOnboardingStatus } from "@/lib/api/onboarding";
import { getUserLiabilities } from "@/lib/api/plaid/liabilities";
import { getCurrentUserId } from "@/lib/api/feature-guard";
import { startOfMonth } from "date-fns/startOfMonth";
import { endOfMonth } from "date-fns/endOfMonth";
import { subMonths } from "date-fns/subMonths";
import { logger } from "@/lib/utils/logger";

interface DashboardData {
  selectedMonthTransactions: any[];
  lastMonthTransactions: any[];
  savings: number;
  budgets: any[];
  upcomingTransactions: any[];
  financialHealth: any;
  goals: any[];
  chartTransactions: any[];
  totalBalance: number;
  lastMonthTotalBalance: number;
  accounts: any[];
  liabilities: any[];
  onboardingStatus: any;
}

export async function loadDashboardData(selectedMonthDate: Date): Promise<DashboardData> {
  // Ensure we're working with the start of the month
  const selectedMonth = startOfMonth(selectedMonthDate);
  const selectedMonthEnd = endOfMonth(selectedMonth);
  const lastMonth = subMonths(selectedMonth, 1);
  const lastMonthEnd = endOfMonth(lastMonth);
  const sixMonthsAgo = subMonths(selectedMonth, 5);
  const chartStart = startOfMonth(sixMonthsAgo);
  const chartEnd = endOfMonth(selectedMonth);

  const log = logger.withPrefix("data-loader");
  
  log.log("Date calculations:", {
    selectedMonthDate: selectedMonthDate.toISOString(),
    selectedMonth: {
      start: selectedMonth.toISOString(),
      end: selectedMonthEnd.toISOString(),
    },
    lastMonth: {
      start: lastMonth.toISOString(),
      end: lastMonthEnd.toISOString(),
    },
    chartRange: {
      start: chartStart.toISOString(),
      end: chartEnd.toISOString(),
    },
  });

  // Get current user ID for liabilities
  const userId = await getCurrentUserId();

  // Fetch all data in parallel
  const [
    selectedMonthTransactions,
    lastMonthTransactions,
    savings,
    budgets,
    upcomingTransactions,
    financialHealth,
    goals,
    chartTransactions,
    accounts,
    liabilities,
    onboardingStatus,
  ] = await Promise.all([
    getTransactions({
      startDate: selectedMonth,
      endDate: selectedMonthEnd,
    }).then((transactions) => {
      // Debug: Log transactions to understand the issue
      log.log("Selected Month Transactions loaded:", {
          count: transactions.length,
          dateRange: {
            start: selectedMonth.toISOString(),
            end: selectedMonthEnd.toISOString(),
          },
        transactionTypes: [...new Set(transactions.map(t => t?.type).filter(Boolean))],
        incomeCount: transactions.filter(t => t?.type === "income").length,
        expenseCount: transactions.filter(t => t?.type === "expense").length,
        incomeTransactions: transactions.filter(t => t?.type === "income").map(t => ({
          id: t?.id,
          type: t?.type,
          amount: t?.amount,
          amountType: typeof t?.amount,
          parsedAmount: t?.amount != null ? (typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount)) : null,
          date: t?.date,
          description: t?.description,
        })),
        incomeTotal: transactions.filter(t => t?.type === "income").reduce((sum, t) => {
          const amount = t?.amount != null ? (typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount)) : 0;
          return sum + (isNaN(amount) ? 0 : amount);
        }, 0),
        expenseTotal: transactions.filter(t => t?.type === "expense").reduce((sum, t) => {
          const amount = t?.amount != null ? (typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount)) : 0;
          return sum + (isNaN(amount) ? 0 : amount);
        }, 0),
        sampleTransaction: transactions[0] ? {
          id: transactions[0].id,
          type: transactions[0].type,
          amount: transactions[0].amount,
          amountType: typeof transactions[0].amount,
          date: transactions[0].date,
        } : null,
      });
      return transactions;
    }).catch((error) => {
      log.error("Error fetching selected month transactions:", error);
      return [];
    }),
    getTransactions({
      startDate: lastMonth,
      endDate: lastMonthEnd,
    }).catch((error) => {
      log.error("Error fetching last month transactions:", error);
      return [];
    }),
    getTotalInvestmentsValue().catch((error) => {
      log.error("Error fetching total investments value:", error);
      return 0;
    }),
    getBudgets(selectedMonth).then((budgets) => {
      log.log("Budgets loaded:", {
        count: budgets?.length || 0,
        budgets: budgets?.map((b: any) => ({
          id: b.id,
          category: b.category?.name,
          amount: b.amount,
          period: b.period,
        })),
      });
      return budgets;
    }).catch((error) => {
      log.error("Error fetching budgets:", error);
      return [];
    }),
    getUpcomingTransactions(5).catch((error) => {
      log.error("Error fetching upcoming transactions:", error);
      return [];
    }),
    calculateFinancialHealth(selectedMonth).catch((error) => {
      log.error("Error calculating financial health:", {
        error: error?.message,
        stack: error?.stack,
        errorType: error?.constructor?.name,
      });
      return null;
    }),
    getGoals().then((goals) => {
      log.log("Goals loaded:", {
        count: goals?.length || 0,
        goals: goals?.map((g: any) => ({
          id: g.id,
          name: g.name,
          targetAmount: g.targetAmount,
          currentBalance: g.currentBalance,
          isCompleted: g.isCompleted,
        })),
      });
      return goals;
    }).catch((error) => {
      log.error("Error fetching goals:", error);
      return [];
    }),
    getTransactions({
      startDate: chartStart,
      endDate: chartEnd,
    }).catch((error) => {
      log.error("Error fetching chart transactions:", error);
      return [];
    }),
    getAccounts().catch((error) => {
      log.error("Error fetching accounts:", error);
      return [];
    }),
    userId ? getUserLiabilities(userId).catch((error) => {
      log.error("Error fetching liabilities:", error);
      return [];
    }) : Promise.resolve([]),
    checkOnboardingStatus().catch((error) => {
      log.error("Error checking onboarding status:", error);
      return null;
    }),
  ]);

  // Calculate total balance for ALL accounts (all households)
  const totalBalance = accounts.reduce(
    (sum: number, acc: any) => sum + (acc.balance || 0),
    0
  );

  // Calculate last month's total balance more efficiently
  // Instead of fetching ALL transactions from beginning of time, we can:
  // 1. Use the current account balance
  // 2. Subtract transactions from current month to get last month's balance
  // This is much more efficient than fetching all historical transactions
  // Get current month transactions (we already have selectedMonthTransactions)
  // Calculate the difference between current balance and current month transactions
  // to get last month's balance
  const currentMonthTransactions = selectedMonthTransactions;
  
  // Calculate last month's balance by subtracting current month transactions from current balance
  const currentMonthNetChange = currentMonthTransactions.reduce((sum: number, tx: any) => {
    if (tx.type === "income") {
      return sum + (Number(tx.amount) || 0);
    } else if (tx.type === "expense") {
      return sum - (Number(tx.amount) || 0);
    }
    return sum;
  }, 0);

  // Last month's balance = current balance - current month net change
  const lastMonthTotalBalance = totalBalance - currentMonthNetChange;

  // Debug: Log final data being returned
  log.log("Final dashboard data:", {
    budgetsCount: budgets?.length || 0,
    goalsCount: goals?.length || 0,
    budgets: budgets?.length > 0 ? budgets.slice(0, 3).map((b: any) => ({
      id: b.id,
      category: b.category?.name,
      amount: b.amount,
    })) : [],
    goals: goals?.length > 0 ? goals.slice(0, 3).map((g: any) => ({
      id: g.id,
      name: g.name,
      targetAmount: g.targetAmount,
    })) : [],
  });

  return {
    selectedMonthTransactions,
    lastMonthTransactions,
    savings,
    budgets,
    upcomingTransactions,
    financialHealth,
    goals,
    chartTransactions,
    totalBalance,
    lastMonthTotalBalance,
    accounts,
    liabilities,
    onboardingStatus,
  };
}

