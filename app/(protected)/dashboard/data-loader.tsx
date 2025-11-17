import { unstable_cache } from "next/cache";
import { getTransactions } from "@/lib/api/transactions";
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
  // OPTIMIZED: Uses getAccounts() which already has optimized balance calculation
  // and proper RLS filtering by userId
  async function getAccountsWithTokens(accessToken?: string, refreshToken?: string) {
    // Use the existing optimized getAccounts function which:
    // 1. Properly filters by userId via RLS
    // 2. Has optimized balance calculation
    // 3. Handles investment accounts correctly
    // Pass tokens to ensure proper authentication
    const accounts = await getAccounts(accessToken, refreshToken);
    
    // Still need to fetch AccountOwner relationships and owner names
    const supabase = await createServerClient(accessToken, refreshToken);
    
    const accountIds = accounts.map(acc => acc.id);
    if (accountIds.length === 0) {
      return [];
    }

    // Fetch AccountOwner relationships and collect all owner IDs
    const { data: accountOwners } = await supabase
      .from("AccountOwner")
      .select("accountId, ownerId")
      .in("accountId", accountIds);

    // Collect all owner IDs from both AccountOwner and accounts
    const allOwnerIds = new Set<string>();
    accounts.forEach((acc: any) => {
      if (acc.userId) {
        allOwnerIds.add(acc.userId);
      }
    });
    accountOwners?.forEach((ao) => {
      allOwnerIds.add(ao.ownerId);
    });

    // Fetch owner names in parallel (only if we have owner IDs)
    const ownersResult = allOwnerIds.size > 0
      ? await supabase
          .from("User")
          .select("id, name")
          .in("id", Array.from(allOwnerIds))
      : { data: null, error: null };

    const owners = ownersResult.data || [];

    const accountOwnersMap = new Map<string, string[]>();
    (accountOwners || []).forEach((ao) => {
      if (!accountOwnersMap.has(ao.accountId)) {
        accountOwnersMap.set(ao.accountId, []);
      }
      accountOwnersMap.get(ao.accountId)!.push(ao.ownerId);
    });

    const ownerNameMap = new Map<string, string>();
    owners.forEach((owner) => {
      if (owner.id && owner.name) {
        const firstName = owner.name.split(' ')[0];
        ownerNameMap.set(owner.id, firstName);
      }
    });

    // Combine accounts with owner info (balances already calculated by getAccounts)
    return accounts.map((account: any) => {
      const ownerIds = accountOwnersMap.get(account.id) || (account.userId ? [account.userId] : []);
      const ownerNames = ownerIds.map(id => ownerNameMap.get(id) || 'Unknown').filter(Boolean);
      
      return {
        ...account,
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
          additionalContributions: debt.additionalContributions ?? false,
          additionalContributionAmount: debt.additionalContributionAmount,
          priority: debt.priority ?? "Medium",
          isPaused: debt.isPaused ?? false,
          isPaidOff: debt.isPaidOff ?? false,
          description: debt.description,
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
  // OPTIMIZED: Reuses accounts from Promise.all to avoid duplicate query
  async function checkOnboardingStatusWithTokens(
    accounts: any[],
    accessToken?: string, 
    refreshToken?: string
  ) {
    try {
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
  // OPTIMIZED: Get accounts first, then use it for onboarding status to avoid duplicate query
  const [
    selectedMonthTransactionsResult,
    lastMonthTransactionsResult,
    budgets,
    upcomingTransactions,
    financialHealth,
    goals,
    chartTransactionsResult,
    accounts,
    liabilities,
    debts,
  ] = await Promise.all([
    getTransactionsInternal({ startDate: selectedMonth, endDate: selectedMonthEnd }, accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching selected month transactions:", error);
      return { transactions: [], total: 0 };
    }),
    getTransactionsInternal({ startDate: lastMonth, endDate: lastMonthEnd }, accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching last month transactions:", error);
      return { transactions: [], total: 0 };
    }),
    getBudgetsInternal(selectedMonth, accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching budgets:", error);
      return [];
    }),
    getUpcomingTransactions(5).catch((error) => {
      logger.error("Error fetching upcoming transactions:", error);
      return [];
    }),
    calculateFinancialHealth(selectedMonth, userId, accessToken, refreshToken).catch((error) => {
      logger.error("Error calculating financial health:", error);
      // Return a valid FinancialHealthData object instead of null
      // This ensures the widget can still render with an error message
      return {
        score: 0,
        classification: "Critical" as const,
        monthlyIncome: 0,
        monthlyExpenses: 0,
        netAmount: 0,
        savingsRate: 0,
        message: "Unable to calculate Spare Score at this time. Please try refreshing the page.",
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
  ]);

  // Calculate onboarding status using already-fetched accounts (avoid duplicate query)
  const onboardingStatus = await checkOnboardingStatusWithTokens(accounts, accessToken, refreshToken).catch((error) => {
    logger.error("Error checking onboarding status:", error);
    return {
      hasAccount: false,
      hasCompleteProfile: false,
      completedCount: 0,
      totalCount: 2,
    };
  });

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

  // Calculate savings as the sum of balances from savings accounts
  const savings = accounts
    .filter((acc: any) => acc.type === 'savings')
    .reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0);

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
    // SECURITY: Use getUser() first to verify authentication, then getSession() for tokens
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Only get session tokens if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        accessToken = session.access_token;
        refreshToken = session.refresh_token;
      }
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

