import { unstable_cache } from "next/cache";
import { getTransactions } from "@/lib/api/transactions";
import { getTotalInvestmentsValue } from "@/lib/api/simple-investments";
import { getBudgets } from "@/lib/api/budgets";
import { getUpcomingTransactions } from "@/lib/api/transactions";
import { calculateFinancialHealth } from "@/lib/api/financial-health";
import { getGoals } from "@/lib/api/goals";
import { getAccounts } from "@/lib/api/accounts";
import { checkOnboardingStatus, type OnboardingStatus } from "@/lib/api/onboarding";
import { getUserLiabilities } from "@/lib/api/plaid/liabilities";
import { getDebts } from "@/lib/api/debts";
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
  debts: any[];
  onboardingStatus: OnboardingStatus | null;
}

async function loadDashboardDataInternal(selectedMonthDate: Date, userId: string | null): Promise<DashboardData> {
  // Ensure we're working with the start of the month
  const selectedMonth = startOfMonth(selectedMonthDate);
  const selectedMonthEnd = endOfMonth(selectedMonth);
  const lastMonth = subMonths(selectedMonth, 1);
  const lastMonthEnd = endOfMonth(lastMonth);
  const sixMonthsAgo = subMonths(selectedMonth, 5);
  const chartStart = startOfMonth(sixMonthsAgo);
  const chartEnd = endOfMonth(selectedMonth);

  // Fetch all data in parallel
  const [
    selectedMonthTransactionsResult,
    lastMonthTransactionsResult,
    savings,
    budgets,
    upcomingTransactions,
    financialHealth,
    goals,
    chartTransactionsResult,
    accounts,
    liabilities,
    debts,
    onboardingStatus,
  ] = await Promise.all([
    getTransactions({
      startDate: selectedMonth,
      endDate: selectedMonthEnd,
    }).catch((error) => {
      console.error("Error fetching selected month transactions:", error);
      return { transactions: [], total: 0 };
    }),
    getTransactions({
      startDate: lastMonth,
      endDate: lastMonthEnd,
    }).catch((error) => {
      console.error("Error fetching last month transactions:", error);
      return { transactions: [], total: 0 };
    }),
    getTotalInvestmentsValue().catch((error) => {
      console.error("Error fetching total investments value:", error);
      return 0;
    }),
    getBudgets(selectedMonth).catch((error) => {
      console.error("Error fetching budgets:", error);
      return [];
    }),
    getUpcomingTransactions(5).catch((error) => {
      console.error("Error fetching upcoming transactions:", error);
      return [];
    }),
    calculateFinancialHealth(selectedMonth).catch((error) => {
      console.error("Error calculating financial health:", error);
      return null;
    }),
    getGoals().catch((error) => {
      console.error("Error fetching goals:", error);
      return [];
    }),
    getTransactions({
      startDate: chartStart,
      endDate: chartEnd,
    }).catch((error) => {
      console.error("Error fetching chart transactions:", error);
      return { transactions: [], total: 0 };
    }),
    getAccounts().catch((error) => {
      console.error("Error fetching accounts:", error);
      return [];
    }),
    userId ? getUserLiabilities(userId).catch((error) => {
      console.error("Error fetching liabilities:", error);
      return [];
    }) : Promise.resolve([]),
    getDebts().catch((error) => {
      console.error("Error fetching debts:", error);
      return [];
    }),
    checkOnboardingStatus().catch((error) => {
      console.error("Error checking onboarding status:", error);
      // Return default status on error so widget can still appear
      return {
        hasAccount: false,
        hasCompleteProfile: false,
        completedCount: 0,
        totalCount: 2,
      };
    }),
  ]);

  // Extract transactions arrays from the results
  const selectedMonthTransactions = Array.isArray(selectedMonthTransactionsResult) 
    ? selectedMonthTransactionsResult 
    : (selectedMonthTransactionsResult?.transactions || []);
  const lastMonthTransactions = Array.isArray(lastMonthTransactionsResult)
    ? lastMonthTransactionsResult
    : (lastMonthTransactionsResult?.transactions || []);
  const chartTransactions = Array.isArray(chartTransactionsResult)
    ? chartTransactionsResult
    : (chartTransactionsResult?.transactions || []);

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
  // Use consistent parsing to handle string/number amounts
  const currentMonthNetChange = currentMonthTransactions.reduce((sum: number, tx: any) => {
    const amount = tx.amount != null 
      ? (typeof tx.amount === 'string' ? parseFloat(tx.amount) : Number(tx.amount))
      : 0;
    
    if (isNaN(amount) || !isFinite(amount)) {
      return sum;
    }
    
    if (tx.type === "income") {
      return sum + amount;
    } else if (tx.type === "expense") {
      return sum - Math.abs(amount); // Ensure expenses are subtracted
    }
    return sum;
  }, 0);

  // Last month's balance = current balance - current month net change
  const lastMonthTotalBalance = totalBalance - currentMonthNetChange;

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
    debts,
    onboardingStatus,
  };
}

// Load dashboard data with optional caching
// Cache is invalidated when transactions, budgets, goals, or accounts change
export async function loadDashboardData(selectedMonthDate: Date): Promise<DashboardData> {
  // Get userId BEFORE caching (cookies can't be accessed inside unstable_cache)
  const userId = await getCurrentUserId();
  
  // Temporarily disable cache to debug the issue
  // TODO: Re-enable cache once we confirm data is loading correctly
  try {
    const data = await loadDashboardDataInternal(selectedMonthDate, userId);
    
    return data;
  } catch (error) {
    logger.error('[Dashboard] Error loading data:', error);
    throw error;
  }
  
  // Future implementation with cache:
  // const monthKey = `${selectedMonthDate.getFullYear()}-${selectedMonthDate.getMonth()}`;
  // return unstable_cache(
  //   async () => loadDashboardDataInternal(selectedMonthDate, userId),
  //   [`dashboard-${userId || 'anonymous'}-${monthKey}`],
  //   {
  //     tags: ['dashboard', 'transactions', 'budgets', 'goals', 'accounts'],
  //     revalidate: 5, // Short revalidation time (5 seconds) to ensure fresh data while maintaining performance
  //   }
  // )();
}

