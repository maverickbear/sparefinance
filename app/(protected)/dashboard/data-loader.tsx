import { unstable_cache } from "next/cache";
import { getTransactions } from "@/lib/api/transactions";
import { getBudgets } from "@/lib/api/budgets";
import { getUpcomingTransactions } from "@/lib/api/transactions";
import { calculateFinancialHealth } from "@/src/application/shared/financial-health";
import { getGoals } from "@/lib/api/goals";
import { getAccounts } from "@/lib/api/accounts";
import { checkOnboardingStatus, type OnboardingStatus } from "@/lib/api/onboarding";
import { OnboardingStatusExtended } from "@/src/domain/onboarding/onboarding.types";
import { getUserLiabilities } from "@/lib/api/plaid/liabilities";
import { getDebts } from "@/lib/api/debts";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { getUserSubscriptions } from "@/lib/api/user-subscriptions";
import { startOfMonth } from "date-fns/startOfMonth";
import { endOfMonth } from "date-fns/endOfMonth";
import { subMonths } from "date-fns/subMonths";
import { logger } from "@/src/infrastructure/utils/logger";

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
  recurringPayments: any[];
  subscriptions: any[];
  onboardingStatus: OnboardingStatusExtended | null;
  expectedIncomeRange: string | null; // Expected income range for display
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
  // OPTIMIZATION: Include holdings for dashboard to show accurate investment balances
  async function getAccountsWithTokens(accessToken?: string, refreshToken?: string) {
    // Use the existing optimized getAccounts function which:
    // 1. Properly filters by userId via RLS
    // 2. Has optimized balance calculation
    // 3. Handles investment accounts correctly
    // Pass tokens to ensure proper authentication
    // Include holdings for dashboard to show accurate investment account balances
    const accounts = await getAccounts(accessToken, refreshToken, { includeHoldings: true });
    
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
  // PERFORMANCE: Use optimized getDebts function instead of direct query
  // This ensures consistent field selection and calculation logic
  async function getDebtsWithTokens(accessToken?: string, refreshToken?: string) {
    // Use the optimized getDebts function which:
    // 1. Selects only necessary fields (not *)
    // 2. Includes proper calculations
    // 3. Has consistent error handling
    const { getDebts } = await import('@/lib/api/debts');
    return await getDebts(accessToken, refreshToken);
  }

  // Helper function to check onboarding status with tokens
  // OPTIMIZED: Reuses accounts from Promise.all to avoid duplicate query
  // PERFORMANCE: Accepts optional user parameter to avoid duplicate getUser() call
  async function checkOnboardingStatusWithTokens(
    accounts: any[],
    accessToken?: string, 
    refreshToken?: string,
    user?: { id: string } | null
  ) {
    try {
      const hasAccount = accounts.length > 0;
      const totalBalance = accounts.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0);

      // Get profile with tokens
      const supabase = await createServerClient(accessToken, refreshToken);
      
      // PERFORMANCE: Use provided user or fetch if not provided
      let authUser = user;
      if (!authUser) {
        const { data: { user: fetchedUser }, error: userError } = await supabase.auth.getUser();
        if (userError || !fetchedUser) {
          logger.warn("Could not get user for onboarding status check:", userError?.message);
          return {
            hasAccount: false,
            hasCompleteProfile: false,
            hasExpectedIncome: false,
            completedCount: 0,
            totalCount: 3,
          };
        }
        authUser = fetchedUser;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("User")
        .select("name")
        .eq("id", authUser.id)
        .single();

      if (profileError) {
        logger.warn("Could not get profile for onboarding status check:", profileError.message);
        return {
          hasAccount,
          hasCompleteProfile: false,
          hasExpectedIncome: false,
          completedCount: hasAccount ? 1 : 0,
          totalCount: 3,
          totalBalance: hasAccount ? totalBalance : undefined,
        };
      }

      const hasCompleteProfile = profileData?.name !== null && profileData?.name !== undefined && profileData.name.trim() !== "";
      
      // Check expected income status
      let hasExpectedIncome = false;
      try {
        const { makeOnboardingService } = await import("@/src/application/onboarding/onboarding.factory");
        const onboardingService = makeOnboardingService();
        hasExpectedIncome = await onboardingService.checkIncomeOnboardingStatus(authUser.id, accessToken, refreshToken);
      } catch (error) {
        logger.warn("Could not check income onboarding status:", error);
      }

      const completedCount = [hasAccount, hasCompleteProfile, hasExpectedIncome].filter(Boolean).length;

      logger.debug("Onboarding status check:", {
        hasAccount,
        hasCompleteProfile,
        hasExpectedIncome,
        completedCount,
        totalCount: 3,
        userName: profileData?.name,
      });

      return {
        hasAccount,
        hasCompleteProfile,
        hasExpectedIncome,
        completedCount,
        totalCount: 3,
        totalBalance: hasAccount ? totalBalance : undefined,
      };
    } catch (error) {
      logger.error("Error checking onboarding status:", error);
      return {
        hasAccount: false,
        hasCompleteProfile: false,
        hasExpectedIncome: false,
        completedCount: 0,
        totalCount: 3,
      };
    }
  }

  // OPTIMIZED: Fetch accounts first, then use it for goals and financial-health to avoid duplicate calls
  // This reduces from 3 getAccounts() calls to 1
  const [
    selectedMonthTransactionsResult,
    lastMonthTransactionsResult,
    budgets,
    upcomingTransactions,
    chartTransactionsResult,
    accounts,
    liabilities,
    debts,
    recurringPaymentsResult,
    subscriptions,
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
    getUpcomingTransactions(50, accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching upcoming transactions:", error);
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
    userId ? getUserLiabilities(userId, accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching liabilities:", error);
      return [];
    }) : Promise.resolve([]),
    getDebtsWithTokens(accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching debts:", error);
      return [];
    }),
    getTransactionsInternal({ recurring: true }, accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching recurring payments:", error);
      return { transactions: [], total: 0 };
    }),
    (async () => {
      try {
        const { getUserSubscriptionsInternal } = await import('@/lib/api/user-subscriptions');
        const subs = await getUserSubscriptionsInternal(accessToken, refreshToken);
        logger.info(`[Dashboard] Loaded ${subs.length} subscription(s) for dashboard`);
        if (subs.length > 0) {
          logger.info(`[Dashboard] Subscription details:`, subs.map(s => ({ id: s.id, name: s.serviceName, active: s.isActive })));
        }
        return subs;
      } catch (error) {
        logger.error("[Dashboard] Error fetching subscriptions:", error);
        return [];
      }
    })(),
  ]);

  // Get expected income for projected score calculation
  let projectedIncome: number | undefined;
  let expectedIncomeRange: string | null = null;
  try {
    if (userId) {
      const { makeOnboardingService } = await import("@/src/application/onboarding/onboarding.factory");
      const onboardingService = makeOnboardingService();
      const incomeRange = await onboardingService.getExpectedIncome(userId, accessToken, refreshToken);
      expectedIncomeRange = incomeRange;
      if (incomeRange) {
        projectedIncome = onboardingService.getMonthlyIncomeFromRange(incomeRange);
      }
    }
  } catch (error) {
    logger.warn("Error getting expected income for projected score:", error);
    // Continue without projected income
  }

  // OPTIMIZED: Now fetch goals and financial-health using already-loaded accounts
  // This eliminates duplicate getAccounts() calls
  const [goals, financialHealth] = await Promise.all([
    getGoalsInternal(accessToken, refreshToken, accounts).catch((error) => {
      logger.error("Error fetching goals:", error);
      return [];
    }),
    calculateFinancialHealth(selectedMonth, userId, accessToken, refreshToken, accounts, projectedIncome).catch((error) => {
      logger.error("Error calculating financial health:", error);
      // Return a valid FinancialHealthData object instead of null
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
  ]);

  // Calculate onboarding status using already-fetched accounts (avoid duplicate query)
  const onboardingStatus = await checkOnboardingStatusWithTokens(accounts, accessToken, refreshToken).catch((error) => {
    logger.error("Error checking onboarding status:", error);
    return {
      hasAccount: false,
      hasCompleteProfile: false,
      hasExpectedIncome: false,
      completedCount: 0,
      totalCount: 3,
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
  const recurringPayments = Array.isArray(recurringPaymentsResult)
    ? recurringPaymentsResult
    : (recurringPaymentsResult?.transactions || []);

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
    recurringPayments,
    subscriptions,
    onboardingStatus,
    expectedIncomeRange,
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
          CACHE_TAGS.SUBSCRIPTIONS,
        ],
        revalidate: 300, // 300 seconds (5 minutes) - increased since manual refresh is available
      }
    );
  } catch (error) {
    logger.error('[Dashboard] Error loading data:', error);
    throw error;
  }
}

