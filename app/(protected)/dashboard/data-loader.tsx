import { calculateFinancialHealth } from "@/src/application/shared/financial-health";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { makeUserSubscriptionsService } from "@/src/application/user-subscriptions/user-subscriptions.factory";
import { startOfMonth } from "date-fns/startOfMonth";
import { endOfMonth } from "date-fns/endOfMonth";
import { subMonths } from "date-fns/subMonths";
import { logger } from "@/src/infrastructure/utils/logger";
// Application Services
import { makeTransactionsService } from "@/src/application/transactions/transactions.factory";
import { makeBudgetsService } from "@/src/application/budgets/budgets.factory";
import { makeGoalsService } from "@/src/application/goals/goals.factory";
import { makeAccountsService } from "@/src/application/accounts/accounts.factory";
import { makeDebtsService } from "@/src/application/debts/debts.factory";
import { makeProfileService } from "@/src/application/profile/profile.factory";
import { makeOnboardingService } from "@/src/application/onboarding/onboarding.factory";
import { makePlaidService } from "@/src/application/plaid/plaid.factory";
import { OnboardingStatusExtended, ExpectedIncomeRange } from "@/src/domain/onboarding/onboarding.types";

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
  startDate: Date,
  endDate: Date,
  userId: string | null,
  accessToken?: string,
  refreshToken?: string
): Promise<DashboardData> {
  // Use provided date range for selected period
  const selectedMonth = startDate;
  const selectedMonthEnd = endDate;
  
  // Calculate last month for comparison
  // For month-based ranges, use the previous month
  // For day-based ranges (60/90 days), use the month before the start date
  const startMonth = startOfMonth(selectedMonthDate);
  const lastMonth = subMonths(startMonth, 1);
  const lastMonthEnd = endOfMonth(lastMonth);
  
  // For chart, use 6 months back from the end date
  const sixMonthsAgo = subMonths(endDate, 5);
  const chartStart = startOfMonth(sixMonthsAgo);
  const chartEnd = endDate;

  // Initialize Application Services
  const transactionsService = makeTransactionsService();
  const budgetsService = makeBudgetsService();
  const goalsService = makeGoalsService();
  const accountsService = makeAccountsService();
  const debtsService = makeDebtsService();
  const profileService = makeProfileService();
  const onboardingService = makeOnboardingService();
  
  // Import createServerClient for AccountOwner queries
  const { createServerClient } = await import('@/src/infrastructure/database/supabase-server');

  // Helper function to get accounts with tokens
  // OPTIMIZED: Uses AccountsService which already has optimized balance calculation
  // and proper RLS filtering by userId
  // OPTIMIZATION: Include holdings for dashboard to show accurate investment balances
  async function getAccountsWithTokens(accessToken?: string, refreshToken?: string) {
    // Use Application Service which:
    // 1. Properly filters by userId via RLS
    // 2. Has optimized balance calculation
    // 3. Handles investment accounts correctly
    // Pass tokens to ensure proper authentication
    // Include holdings for dashboard to show accurate investment account balances
    logger.debug("[Dashboard] Fetching accounts via AccountsService...");
    const accounts = await accountsService.getAccounts(accessToken, refreshToken, { includeHoldings: true });
    
    logger.debug("[Dashboard] AccountsService returned accounts:", {
      count: accounts.length,
      accounts: accounts.map((acc: any) => ({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        balance: acc.balance,
        userId: acc.userId,
      })),
    });
    
    // Still need to fetch AccountOwner relationships and owner names
    const supabase = await createServerClient(accessToken, refreshToken);
    
    const accountIds = accounts.map(acc => acc.id);
    if (accountIds.length === 0) {
      logger.warn("[Dashboard] No accounts found - returning empty array");
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
      
      // Ensure balance is always a number (should be set by AccountsService, but validate)
      const balance = account.balance !== undefined && account.balance !== null && !isNaN(account.balance)
        ? Number(account.balance)
        : 0;
      
      // Log warning if account doesn't have balance (shouldn't happen)
      if (account.balance === undefined || account.balance === null) {
        logger.warn(`[Dashboard] Account ${account.id} (${account.name}) missing balance property`);
      }
      
      const accountWithBalance = {
        ...account,
        balance,
        ownerIds,
        ownerNames,
      };
      
      logger.debug(`[Dashboard] Account ${account.id} (${account.name}) final data:`, {
        id: accountWithBalance.id,
        name: accountWithBalance.name,
        type: accountWithBalance.type,
        balance: accountWithBalance.balance,
        originalBalance: account.balance,
        calculatedBalance: balance,
      });
      
      return accountWithBalance;
    });
  }

  // Helper function to get debts with tokens
  // PERFORMANCE: Use DebtsService instead of direct query
  // This ensures consistent field selection and calculation logic
  async function getDebtsWithTokens(accessToken?: string, refreshToken?: string) {
    // Use Application Service which:
    // 1. Selects only necessary fields (not *)
    // 2. Includes proper calculations
    // 3. Has consistent error handling
    return await debtsService.getDebts(accessToken, refreshToken);
  }

  // Helper function to check onboarding status with tokens
  // FIXED: Now uses onboardingService.getOnboardingStatus() which properly checks hasPlan
  // This ensures the status includes all 3 steps: personal data, income, and plan
  async function checkOnboardingStatusWithTokens(
    accounts: any[],
    accessToken?: string, 
    refreshToken?: string,
    user?: { id: string } | null
  ) {
    try {
      // Get user ID
      const supabase = await createServerClient(accessToken, refreshToken);
      let authUser = user;
      if (!authUser) {
        const { data: { user: fetchedUser }, error: userError } = await supabase.auth.getUser();
        if (userError || !fetchedUser) {
          logger.warn("Could not get user for onboarding status check:", userError?.message);
          return {
            hasAccount: false,
            hasCompleteProfile: false,
            hasPersonalData: false,
            hasExpectedIncome: false,
            hasPlan: false,
            completedCount: 0,
            totalCount: 3,
          };
        }
        authUser = fetchedUser;
      }

      // Use the onboarding service which properly checks all steps including hasPlan
      const status = await onboardingService.getOnboardingStatus(authUser.id, accessToken, refreshToken);
      
      // Calculate total balance from accounts
      const totalBalance = accounts.length > 0
        ? accounts.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0)
        : undefined;

      logger.debug("Onboarding status check:", {
        hasAccount: status.hasAccount,
        hasCompleteProfile: status.hasCompleteProfile,
        hasPersonalData: status.hasPersonalData,
        hasExpectedIncome: status.hasExpectedIncome,
        hasPlan: status.hasPlan,
        expectedIncome: status.expectedIncome,
        completedCount: status.completedCount,
        totalCount: status.totalCount,
      });

      return {
        ...status,
        totalBalance: totalBalance ?? status.totalBalance,
      };
    } catch (error) {
      logger.error("Error checking onboarding status:", error);
      return {
        hasAccount: false,
        hasCompleteProfile: false,
        hasPersonalData: false,
        hasExpectedIncome: false,
        hasPlan: false,
        completedCount: 0,
        totalCount: 3,
        expectedIncome: null,
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
    transactionsService.getTransactions({ startDate: selectedMonth, endDate: selectedMonthEnd }, accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching selected month transactions:", error);
      return { transactions: [], total: 0 };
    }),
    transactionsService.getTransactions({ startDate: lastMonth, endDate: lastMonthEnd }, accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching last month transactions:", error);
      return { transactions: [], total: 0 };
    }),
    budgetsService.getBudgets(selectedMonth, accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching budgets:", error);
      return [];
    }),
    transactionsService.getUpcomingTransactions(50, accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching upcoming transactions:", error);
      return [];
    }),
    transactionsService.getTransactions({ startDate: chartStart, endDate: chartEnd }, accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching chart transactions:", error);
      return { transactions: [], total: 0 };
    }),
    getAccountsWithTokens(accessToken, refreshToken).catch((error) => {
      logger.error("[Dashboard] Error fetching accounts:", error);
      return [];
    }),
    userId ? (async () => {
      try {
        const plaidService = makePlaidService();
        return await plaidService.getUserLiabilities(userId, accessToken, refreshToken);
      } catch (error) {
        logger.error("Error fetching liabilities:", error);
        return [];
      }
    })() : Promise.resolve([]),
    getDebtsWithTokens(accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching debts:", error);
      return [];
    }),
    transactionsService.getTransactions({ isRecurring: true }, accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching recurring payments:", error);
      return { transactions: [], total: 0 };
    }),
    (async () => {
      try {
        if (!userId) return [];
        const userSubscriptionsService = makeUserSubscriptionsService();
        const subs = await userSubscriptionsService.getUserSubscriptions(userId);
        logger.debug(
          `[Dashboard] Loaded ${subs.length} user service subscription(s) (Netflix, Spotify, etc.) ` +
          `for dashboard. Note: This is separate from Stripe subscription plans.`
        );
        if (subs.length > 0) {
          logger.debug(
            `[Dashboard] User service subscription details:`,
            subs.map(s => ({ id: s.id, name: s.serviceName, active: s.isActive }))
          );
        }
        return subs;
      } catch (error) {
        logger.error("[Dashboard] Error fetching user service subscriptions:", error);
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
    goalsService.getGoals(accessToken, refreshToken).catch((error) => {
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
      hasPersonalData: false,
      hasExpectedIncome: false,
      hasPlan: false,
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
  // Ensure balance is always a valid number
  const totalBalance = accounts.reduce(
    (sum: number, acc: any) => {
      // Get balance, defaulting to 0 if undefined/null/NaN
      let balance = acc.balance;
      if (balance === undefined || balance === null || isNaN(balance)) {
        balance = 0;
      }
      balance = Number(balance);
      if (!isFinite(balance)) {
        balance = 0;
      }
      return sum + balance;
    },
    0
  );
  
  logger.debug("[Dashboard] Balance calculation:", {
    accountCount: accounts.length,
    totalBalance,
    accountBalances: accounts.map((acc: any) => ({
      id: acc.id,
      name: acc.name,
      type: acc.type,
      balance: acc.balance,
      calculatedBalance: acc.balance ?? 0,
    })),
  });

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
export async function loadDashboardData(
  selectedMonthDate: Date,
  startDate: Date,
  endDate: Date
): Promise<DashboardData> {
  // Get userId and session tokens
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
  
  try {
    return await loadDashboardDataInternal(selectedMonthDate, startDate, endDate, userId, accessToken, refreshToken);
  } catch (error) {
    logger.error('[Dashboard] Error loading data:', error);
    throw error;
  }
}

