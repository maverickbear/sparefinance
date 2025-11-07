import { getTransactions } from "@/lib/api/transactions";
import { getTotalInvestmentsValue } from "@/lib/api/simple-investments";
import { getBudgets } from "@/lib/api/budgets";
import { getUpcomingTransactions } from "@/lib/api/transactions";
import { calculateFinancialHealth } from "@/lib/api/financial-health";
import { getGoals } from "@/lib/api/goals";
import { getAccounts } from "@/lib/api/accounts";
import { checkOnboardingStatus } from "@/lib/api/onboarding";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

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
  onboardingStatus: any;
}

export async function loadDashboardData(selectedMonthDate: Date): Promise<DashboardData> {
  const selectedMonth = startOfMonth(selectedMonthDate);
  const lastMonth = subMonths(selectedMonth, 1);
  const sixMonthsAgo = subMonths(selectedMonthDate, 5);
  const chartStart = startOfMonth(sixMonthsAgo);
  const chartEnd = endOfMonth(selectedMonthDate);

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
    onboardingStatus,
  ] = await Promise.all([
    getTransactions({
      startDate: selectedMonth,
      endDate: endOfMonth(selectedMonthDate),
    }).catch((error) => {
      console.error("Error fetching selected month transactions:", error);
      return [];
    }),
    getTransactions({
      startDate: lastMonth,
      endDate: endOfMonth(lastMonth),
    }).catch((error) => {
      console.error("Error fetching last month transactions:", error);
      return [];
    }),
    getTotalInvestmentsValue().catch((error) => {
      console.error("Error fetching total investments value:", error);
      return 0;
    }),
    getBudgets(selectedMonthDate).catch((error) => {
      console.error("Error fetching budgets:", error);
      return [];
    }),
    getUpcomingTransactions(5).catch((error) => {
      console.error("Error fetching upcoming transactions:", error);
      return [];
    }),
    calculateFinancialHealth(selectedMonthDate).catch((error) => {
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
      return [];
    }),
    getAccounts().catch((error) => {
      console.error("Error fetching accounts:", error);
      return [];
    }),
    checkOnboardingStatus().catch((error) => {
      console.error("Error checking onboarding status:", error);
      return null;
    }),
  ]);

  // Calculate total balance for ALL accounts (all households)
  const totalBalance = accounts.reduce(
    (sum: number, acc: any) => sum + (acc.balance || 0),
    0
  );

  // Calculate last month's total balance
  // We need to calculate what the balance was at the end of last month
  // This is: initialBalance + all transactions up to end of last month
  const lastMonthEndDate = endOfMonth(lastMonth);
  const allTransactionsUpToLastMonth = await getTransactions({
    startDate: new Date(0), // Start from beginning
    endDate: lastMonthEndDate,
  }).catch(() => []);

  // Get accounts with their initial balances
  const lastMonthAccounts = accounts.map((acc: any) => {
    const initialBalance = (acc as any).initialBalance ?? 0;
    const accountTransactions = allTransactionsUpToLastMonth.filter(
      (tx: any) => tx.accountId === acc.id
    );

    let balance = initialBalance;
    for (const tx of accountTransactions) {
      if (tx.type === "income") {
        balance += tx.amount;
      } else if (tx.type === "expense") {
        balance -= tx.amount;
      } else if (tx.type === "transfer") {
        if (tx.transferToId) {
          balance -= tx.amount; // Outgoing
        } else {
          balance += tx.amount; // Incoming
        }
      }
    }

    return { ...acc, balance };
  });

  // Calculate last month's total balance for ALL accounts
  const lastMonthTotalBalance = lastMonthAccounts.reduce(
    (sum: number, acc: any) => sum + (acc.balance || 0),
    0
  );

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
    onboardingStatus,
  };
}

