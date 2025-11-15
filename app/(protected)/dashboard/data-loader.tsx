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

async function loadDashboardDataInternal(
  selectedMonthDate: Date, 
  userId: string | null,
  accessToken?: string,
  refreshToken?: string
): Promise<DashboardData> {
  // Ensure we're working with the start of the month
  const selectedMonth = startOfMonth(selectedMonthDate);
  const selectedMonthEnd = endOfMonth(selectedMonth);
  const lastMonth = subMonths(selectedMonth, 1);
  const lastMonthEnd = endOfMonth(lastMonth);
  const sixMonthsAgo = subMonths(selectedMonth, 5);
  const chartStart = startOfMonth(sixMonthsAgo);
  const chartEnd = endOfMonth(selectedMonth);

  // Import internal functions that accept tokens
  const { getTransactionsInternal } = await import('@/lib/api/transactions');
  const { getBudgetsInternal } = await import('@/lib/api/budgets');
  const { getGoalsInternal } = await import('@/lib/api/goals');
  const { createServerClient } = await import('@/lib/supabase-server');
  const { getProfile } = await import('@/lib/api/profile');

  // Helper function to get accounts with tokens
  async function getAccountsWithTokens(accessToken?: string, refreshToken?: string) {
    const supabase = await createServerClient(accessToken, refreshToken);
    const { data: accounts, error } = await supabase
      .from("Account")
      .select("*")
      .order("name", { ascending: true });

    if (error || !accounts) {
      return [];
    }

    // Fetch all transactions up to today
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDay = now.getDate();
    const todayEnd = new Date(todayYear, todayMonth, todayDay, 23, 59, 59, 999);
    
    const { data: transactions } = await supabase
      .from("Transaction")
      .select("accountId, type, amount, date")
      .lte("date", todayEnd.toISOString());

    // Calculate balances
    const { decryptTransactionsBatch } = await import("@/lib/utils/transaction-encryption");
    const { calculateAccountBalances } = await import("@/lib/services/balance-calculator");
    
    const decryptedTransactions = decryptTransactionsBatch(transactions || []);
    const accountsWithInitialBalance = accounts.map(account => ({
      ...account,
      initialBalance: (account as any).initialBalance ?? 0,
      balance: 0,
    }));
    
    const balances = calculateAccountBalances(
      accountsWithInitialBalance,
      decryptedTransactions as any,
      todayEnd
    );

    // Fetch AccountOwner relationships
    const { data: accountOwners } = await supabase
      .from("AccountOwner")
      .select("accountId, ownerId");

    const accountOwnersMap = new Map<string, string[]>();
    accountOwners?.forEach((ao) => {
      if (!accountOwnersMap.has(ao.accountId)) {
        accountOwnersMap.set(ao.accountId, []);
      }
      accountOwnersMap.get(ao.accountId)!.push(ao.ownerId);
    });

    const allOwnerIds = new Set<string>();
    accountOwners?.forEach((ao) => {
      allOwnerIds.add(ao.ownerId);
    });
    accounts.forEach((acc) => {
      if (acc.userId) {
        allOwnerIds.add(acc.userId);
      }
    });

    const { data: owners } = await supabase
      .from("User")
      .select("id, name")
      .in("id", Array.from(allOwnerIds));

    const ownerNameMap = new Map<string, string>();
    owners?.forEach((owner) => {
      if (owner.id && owner.name) {
        const firstName = owner.name.split(' ')[0];
        ownerNameMap.set(owner.id, firstName);
      }
    });

    // Combine accounts with balances and owner info
    return accounts.map((account: any) => {
      const balance = balances.get(account.id) || 0;
      const ownerIds = accountOwnersMap.get(account.id) || (account.userId ? [account.userId] : []);
      const ownerNames = ownerIds.map(id => ownerNameMap.get(id) || 'Unknown').filter(Boolean);
      
      return {
        ...account,
        balance,
        ownerIds,
        ownerNames,
      };
    });
  }

  // Helper function to get debts with tokens
  async function getDebtsWithTokens(accessToken?: string, refreshToken?: string) {
    const supabase = await createServerClient(accessToken, refreshToken);
    const { data: debts, error } = await supabase
      .from("Debt")
      .select("*")
      .order("priority", { ascending: false })
      .order("createdAt", { ascending: false });

    if (error || !debts || debts.length === 0) {
      return [];
    }

    // Import debt calculation utilities
    const { calculateDebtMetrics } = await import('@/lib/utils/debts');
    type DebtForCalculation = import('@/lib/utils/debts').DebtForCalculation;
    
    const debtsWithCalculations = await Promise.all(
      debts.map(async (debt: any) => {
        const debtForCalculation: DebtForCalculation = {
          id: debt.id,
          name: debt.name,
          initialAmount: debt.initialAmount,
          downPayment: debt.downPayment,
          currentBalance: debt.currentBalance,
          interestRate: debt.interestRate,
          totalMonths: debt.totalMonths,
          firstPaymentDate: debt.firstPaymentDate,
          monthlyPayment: debt.monthlyPayment,
          paymentFrequency: debt.paymentFrequency,
          paymentAmount: debt.paymentAmount,
          principalPaid: debt.principalPaid,
          interestPaid: debt.interestPaid,
        };

        const metrics = calculateDebtMetrics(debtForCalculation);
        return {
          ...debt,
          ...metrics,
        };
      })
    );

    return debtsWithCalculations;
  }

  // Helper function to check onboarding status with tokens
  async function checkOnboardingStatusWithTokens(accessToken?: string, refreshToken?: string) {
    try {
      const accounts = await getAccountsWithTokens(accessToken, refreshToken);
      const hasAccount = accounts.length > 0;
      const totalBalance = accounts.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0);

      // Get profile with tokens
      const supabase = await createServerClient(accessToken, refreshToken);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        logger.warn("Could not get user for onboarding status check:", userError?.message);
        return {
          hasAccount: false,
          hasCompleteProfile: false,
          completedCount: 0,
          totalCount: 2,
        };
      }

      const { data: profileData, error: profileError } = await supabase
        .from("User")
        .select("name")
        .eq("id", user.id)
        .single();

      if (profileError) {
        logger.warn("Could not get profile for onboarding status check:", profileError.message);
        return {
          hasAccount,
          hasCompleteProfile: false,
          completedCount: hasAccount ? 1 : 0,
          totalCount: 2,
          totalBalance: hasAccount ? totalBalance : undefined,
        };
      }

      const hasCompleteProfile = profileData?.name !== null && profileData?.name !== undefined && profileData.name.trim() !== "";
      const completedCount = [hasAccount, hasCompleteProfile].filter(Boolean).length;

      logger.debug("Onboarding status check:", {
        hasAccount,
        hasCompleteProfile,
        completedCount,
        totalCount: 2,
        userName: profileData?.name,
      });

      return {
        hasAccount,
        hasCompleteProfile,
        completedCount,
        totalCount: 2,
        totalBalance: hasAccount ? totalBalance : undefined,
      };
    } catch (error) {
      logger.error("Error checking onboarding status:", error);
      return {
        hasAccount: false,
        hasCompleteProfile: false,
        completedCount: 0,
        totalCount: 2,
      };
    }
  }

  // Fetch all data in parallel, using tokens when available
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
    getTransactionsInternal({ startDate: selectedMonth, endDate: selectedMonthEnd }, accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching selected month transactions:", error);
      return { transactions: [], total: 0 };
    }),
    getTransactionsInternal({ startDate: lastMonth, endDate: lastMonthEnd }, accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching last month transactions:", error);
      return { transactions: [], total: 0 };
    }),
    getTotalInvestmentsValue().catch((error) => {
      logger.error("Error fetching total investments value:", error);
      return 0;
    }),
    getBudgetsInternal(selectedMonth, accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching budgets:", error);
      return [];
    }),
    getUpcomingTransactions(5).catch((error) => {
      logger.error("Error fetching upcoming transactions:", error);
      return [];
    }),
    calculateFinancialHealth(selectedMonth).catch((error) => {
      logger.error("Error calculating financial health:", error);
      // Return a valid FinancialHealthData object instead of null
      // This ensures the widget can still render with an error message
      return {
        score: 0,
        classification: "Unknown" as const,
        monthlyIncome: 0,
        monthlyExpenses: 0,
        netAmount: 0,
        savingsRate: 0,
        message: "Unable to calculate financial health at this time. Please try refreshing the page.",
        spendingDiscipline: "Unknown" as const,
        debtExposure: "Low" as const,
        emergencyFundMonths: 0,
        alerts: [],
        suggestions: [],
      };
    }),
    getGoalsInternal(accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching goals:", error);
      return [];
    }),
    getTransactionsInternal({ startDate: chartStart, endDate: chartEnd }, accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching chart transactions:", error);
      return { transactions: [], total: 0 };
    }),
    getAccountsWithTokens(accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching accounts:", error);
      return [];
    }),
    userId ? getUserLiabilities(userId).catch((error) => {
      logger.error("Error fetching liabilities:", error);
      return [];
    }) : Promise.resolve([]),
    getDebtsWithTokens(accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching debts:", error);
      return [];
    }),
    checkOnboardingStatusWithTokens(accessToken, refreshToken).catch((error) => {
      logger.error("Error checking onboarding status:", error);
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
  // Use centralized service for consistent calculation
  const { calculateLastMonthBalanceFromCurrent } = await import('@/lib/services/balance-calculator');
  const lastMonthTotalBalance = calculateLastMonthBalanceFromCurrent(
    totalBalance,
    selectedMonthTransactions
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
    liabilities,
    debts,
    onboardingStatus,
  };
}

// Load dashboard data with caching
// Cache is invalidated when transactions, budgets, goals, or accounts change
export async function loadDashboardData(selectedMonthDate: Date): Promise<DashboardData> {
  // Get userId and session tokens BEFORE caching (cookies can't be accessed inside unstable_cache)
  const userId = await getCurrentUserId();
  
  // Get session tokens before entering cache
  let accessToken: string | undefined;
  let refreshToken: string | undefined;
  try {
    const { createServerClient } = await import('@/lib/supabase-server');
    const supabase = await createServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      accessToken = session.access_token;
      refreshToken = session.refresh_token;
    }
  } catch (error: any) {
    logger.warn('[Dashboard] Could not get session tokens:', error?.message);
    // Continue without tokens - functions will try to get them themselves
  }
  
  // Import cache utilities
  const { withCache, generateCacheKey, CACHE_TAGS, CACHE_DURATIONS } = await import('@/lib/services/cache-manager');
  
  try {
    // Use centralized cache manager with proper tags
    const cacheKey = generateCacheKey.dashboard({
      userId: userId || undefined,
      month: selectedMonthDate,
    });
    
    return await withCache(
      async () => loadDashboardDataInternal(selectedMonthDate, userId, accessToken, refreshToken),
      {
        key: cacheKey,
        tags: [
          CACHE_TAGS.DASHBOARD,
          CACHE_TAGS.TRANSACTIONS,
          CACHE_TAGS.ACCOUNTS,
          CACHE_TAGS.BUDGETS,
          CACHE_TAGS.GOALS,
        ],
        revalidate: CACHE_DURATIONS.SHORT, // 10 seconds for fresh data
      }
    );
  } catch (error) {
    logger.error('[Dashboard] Error loading data:', error);
    throw error;
  }
}

