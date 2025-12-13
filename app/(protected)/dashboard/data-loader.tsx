import { calculateFinancialHealth } from "@/src/application/shared/financial-health";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { makeUserSubscriptionsService } from "@/src/application/user-subscriptions/user-subscriptions.factory";
import { startOfMonth } from "date-fns/startOfMonth";
import { endOfMonth } from "date-fns/endOfMonth";
import { subMonths } from "date-fns/subMonths";
import { logger } from "@/src/infrastructure/utils/logger";
import { cacheLife, cacheTag } from 'next/cache';
import { cookies } from 'next/headers';
// Application Services
import { makeTransactionsService } from "@/src/application/transactions/transactions.factory";
import { makeBudgetsService } from "@/src/application/budgets/budgets.factory";
import { makeGoalsService } from "@/src/application/goals/goals.factory";
// CRITICAL: Use static import to ensure React cache() works correctly
import { getAccountsForDashboard } from "@/src/application/accounts/get-dashboard-accounts";
import { makeDebtsService } from "@/src/application/debts/debts.factory";
import { makeProfileService } from "@/src/application/profile/profile.factory";
import { makeOnboardingService } from "@/src/application/onboarding/onboarding.factory";
import { getPlannedPaymentsForDashboard } from "@/src/application/planned-payments/get-dashboard-planned-payments";
import { OnboardingStatusExtended, ExpectedIncomeRange } from "@/src/domain/onboarding/onboarding.types";
import { TransactionWithRelations, UpcomingTransaction } from "@/src/domain/transactions/transactions.types";
import { BudgetWithRelations } from "@/src/domain/budgets/budgets.types";
import { GoalWithCalculations } from "@/src/domain/goals/goals.types";
import { AccountWithBalance } from "@/src/domain/accounts/accounts.types";
import { DebtWithCalculations } from "@/src/domain/debts/debts.types";
import { BasePlannedPayment } from "@/src/domain/planned-payments/planned-payments.types";
import { UserServiceSubscription } from "@/src/domain/subscriptions/subscriptions.types";
import { FinancialHealthData } from "@/src/application/shared/financial-health";

// CRITICAL DATA - needed for first render
interface CriticalDashboardData {
  selectedMonthTransactions: TransactionWithRelations[];
  savings: number;
  budgets: BudgetWithRelations[];
  upcomingTransactions: UpcomingTransaction[];
  financialHealth: FinancialHealthData;
  goals: GoalWithCalculations[];
  totalBalance: number;
  accounts: AccountWithBalance[];
  plannedPayments: BasePlannedPayment[]; // Planned payments for the selected month
  onboardingStatus: OnboardingStatusExtended | null;
  expectedIncomeRange: string | null; // Expected income range for display
}

// Chart transaction format (aggregated monthly data)
interface ChartTransactionData {
  month: string;
  income: number;
  expenses: number;
}

// SECONDARY DATA - can load after first render (via Suspense)
interface SecondaryDashboardData {
  lastMonthTransactions: TransactionWithRelations[];
  chartTransactions: ChartTransactionData[];
  lastMonthTotalBalance: number;
  liabilities: AccountWithBalance[];
  debts: DebtWithCalculations[];
  recurringPayments: TransactionWithRelations[];
  subscriptions: UserServiceSubscription[];
}

// Full dashboard data (for backward compatibility)
interface DashboardData extends CriticalDashboardData, SecondaryDashboardData {}

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
  // CRITICAL: Removed accountsService - now using cached getAccountsForDashboard
  const debtsService = makeDebtsService();
  const profileService = makeProfileService();
  const onboardingService = makeOnboardingService();
  
  // Import createServerClient for AccountOwner queries
  const { createServerClient } = await import('@/src/infrastructure/database/supabase-server');

  // Helper function to get accounts with tokens
  // CRITICAL OPTIMIZATION: Use cached function to ensure only 1 AccountsService call per request
  async function getAccountsWithTokens(accessToken?: string, refreshToken?: string) {
    // Use cached function for request-level deduplication
    // This ensures AccountsService is called only once per dashboard load
    // Using static import ensures React cache() works correctly
    // CRITICAL: Pass tokens to ensure proper authentication
    logger.debug("[Dashboard] Fetching accounts via cached getAccountsForDashboard...");
    const accounts = await getAccountsForDashboard(true, accessToken, refreshToken);
    
    logger.debug("[Dashboard] AccountsService returned accounts:", {
      count: accounts.length,
      accounts: accounts.map((acc: AccountWithBalance) => ({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        balance: acc.balance,
        userId: acc.userId,
      })),
    });
    
    // Still need to fetch AccountOwner relationships and owner names
    const supabase = await createServerClient(accessToken, refreshToken);
    
    const accountIds = accounts.map((acc: { id: string }) => acc.id);
    if (accountIds.length === 0) {
      logger.warn("[Dashboard] No accounts found - returning empty array");
      return [];
    }

    // Fetch AccountOwner relationships and collect all owner IDs
    const { data: accountOwners } = await supabase
      .from("account_owners")
      .select("account_id, owner_id")
      .in("account_id", accountIds);

    // Collect all owner IDs from both AccountOwner and accounts
    const allOwnerIds = new Set<string>();
    accounts.forEach((acc: AccountWithBalance) => {
      if (acc.userId) {
        allOwnerIds.add(acc.userId);
      }
    });
    accountOwners?.forEach((ao) => {
      allOwnerIds.add(ao.owner_id);
    });

    // Fetch owner names in parallel (only if we have owner IDs)
    const ownersResult = allOwnerIds.size > 0
      ? await supabase
          .from("users")
          .select("id, name")
          .in("id", Array.from(allOwnerIds))
      : { data: null, error: null };

    const owners = ownersResult.data || [];

    const accountOwnersMap = new Map<string, string[]>();
    (accountOwners || []).forEach((ao) => {
      if (!accountOwnersMap.has(ao.account_id)) {
        accountOwnersMap.set(ao.account_id, []);
      }
      accountOwnersMap.get(ao.account_id)!.push(ao.owner_id);
    });

    const ownerNameMap = new Map<string, string>();
    owners.forEach((owner) => {
      if (owner.id && owner.name) {
        const firstName = owner.name.split(' ')[0];
        ownerNameMap.set(owner.id, firstName);
      }
    });

    // Combine accounts with owner info (balances already calculated by getAccounts)
    return accounts.map((account: AccountWithBalance) => {
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
    accounts: AccountWithBalance[],
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
        ? accounts.reduce((sum: number, acc: AccountWithBalance) => sum + (acc.balance || 0), 0)
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

  // CRITICAL OPTIMIZATION: Only fetch essential data for initial render
  // This allows the page to render quickly while secondary data loads in background
  const [
    selectedMonthTransactionsResult,
    accounts,
    budgets,
    upcomingTransactions,
  ] = await Promise.all([
    transactionsService.getTransactions({ startDate: selectedMonth, endDate: selectedMonthEnd }, accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching selected month transactions:", error);
      return { transactions: [], total: 0 };
    }),
    getAccountsWithTokens(accessToken, refreshToken).catch((error) => {
      logger.error("[Dashboard] Error fetching accounts:", error);
      return [];
    }),
    budgetsService.getBudgets(selectedMonth, accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching budgets:", error);
      return [];
    }),
    transactionsService.getUpcomingTransactions(50, accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching upcoming transactions:", error);
      return [];
    }),
  ]);

  // Calculate essential data immediately
  const selectedMonthTransactions = Array.isArray(selectedMonthTransactionsResult) 
    ? selectedMonthTransactionsResult 
    : (selectedMonthTransactionsResult?.transactions || []);
  
  const totalBalance = accounts.reduce(
    (sum: number, acc: AccountWithBalance) => {
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

  const savings = accounts
    .filter((acc: AccountWithBalance) => acc.type === 'savings')
    .reduce((sum: number, acc: AccountWithBalance) => sum + (acc.balance || 0), 0);

  // CRITICAL OPTIMIZATION: Extract planned payments from upcomingTransactions
  // getUpcomingTransactions already calls PlannedPaymentsService for next 15 days
  // We extract from upcomingTransactions to avoid duplicate PlannedPaymentsService call
  // Only fetch separately if selected month extends beyond 15 days AND we need that data
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfUpcoming = new Date(today);
  endOfUpcoming.setDate(endOfUpcoming.getDate() + 15);
  
  // Extract planned payments from upcomingTransactions (already fetched by getUpcomingTransactions)
  const plannedPaymentsFromUpcoming = upcomingTransactions
    .filter((ut: UpcomingTransaction) => {
      // Filter to only planned payments (not recurring transactions)
      // Planned payments from getUpcomingTransactions have specific structure
      const utDate = ut.date instanceof Date ? ut.date : new Date(ut.date);
      return utDate >= selectedMonth && utDate <= selectedMonthEnd && ut.originalDate;
    })
    .map((ut: UpcomingTransaction) => ({
      id: ut.id,
      date: ut.date,
      type: ut.type,
      amount: ut.amount,
      description: ut.description,
      accountId: ut.account?.id,
      account: ut.account,
      category: ut.category,
      subcategory: ut.subcategory,
      source: 'manual' as const,
      status: 'scheduled' as const,
    }));
  
  // Only fetch additional planned payments if selected month extends beyond 15 days
  // AND the selected month end is actually in the future (not just historical data)
  // OPTIMIZED: Use cached function to prevent duplicate queries
  let additionalPlannedPayments: BasePlannedPayment[] = [];
  if (selectedMonthEnd > endOfUpcoming && selectedMonthEnd > today) {
      try {
      // Only fetch for dates beyond the 15-day window to avoid overlap
      // Use cached function to prevent duplicate queries across components
      const result = await getPlannedPaymentsForDashboard({
        startDate: endOfUpcoming,
          endDate: selectedMonthEnd,
          type: "expense",
          status: "scheduled",
      }, accessToken, refreshToken).catch((error) => {
        logger.error("Error fetching additional planned payments:", error);
        return { plannedPayments: [], total: 0 };
      });
      additionalPlannedPayments = result?.plannedPayments || [];
    } catch (error) {
      logger.error("Error processing additional planned payments:", error);
    }
  }
  
  // Combine planned payments from upcomingTransactions with additional ones
  const allPlannedPayments = [...plannedPaymentsFromUpcoming, ...additionalPlannedPayments];

  // OPTIMIZED: Fetch expected income range in parallel with other operations
  // Calculate projected income immediately after to use in financial health
  let expectedIncomeRange: ExpectedIncomeRange = null;
  let projectedIncome: number | undefined;
  
  // Use existing onboardingService instead of creating new one
  const expectedIncomeResult = userId ? await onboardingService.getExpectedIncome(userId, accessToken, refreshToken).catch((error) => {
    logger.warn("Error getting expected income range:", error);
    return null;
  }) : null;
  
  expectedIncomeRange = expectedIncomeResult;
  if (expectedIncomeRange && userId) {
    try {
      // Use existing onboardingService instead of creating new one
      projectedIncome = onboardingService.getMonthlyIncomeFromRange(expectedIncomeRange);
    } catch (error) {
      logger.warn("Error calculating projected income:", error);
    }
  }

  // CRITICAL OPTIMIZATION: Only fetch essential data for first render
  // Goals, Financial Health, and Onboarding Status can all run in parallel
  // CRITICAL: Ensure accounts is always passed and non-empty to avoid duplicate calls
  if (!accounts || accounts.length === 0) {
    logger.warn("[Dashboard] No accounts loaded - this will cause duplicate getAccounts() calls");
  }
  
  // OPTIMIZED: Run goals, financial health, and onboarding status in parallel
  // All three operations are independent and can execute concurrently
  const [goals, financialHealth, onboardingStatus] = await Promise.all([
    // CRITICAL: Always pass accounts if available (even if empty array)
    // GoalsService will only fetch if accounts is undefined/null AND goals need accounts
    goalsService.getGoals(accessToken, refreshToken, accounts || undefined).catch((error) => {
      logger.error("Error fetching goals:", error);
      return [];
    }),
    // CRITICAL: Always pass accounts if available (even if empty array)
    // calculateFinancialHealth will only fetch if accounts is undefined/null
    calculateFinancialHealth(selectedMonth, userId, accessToken, refreshToken, accounts || undefined, projectedIncome).catch((error) => {
      logger.error("Error calculating financial health:", error);
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
    // OPTIMIZED: Check onboarding status in parallel with other operations
    checkOnboardingStatusWithTokens(accounts, accessToken, refreshToken).catch((error) => {
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
    }),
  ]);

  // CRITICAL: Don't load secondary data here - it will be loaded separately via Suspense
  // Secondary data is now handled by loadSecondaryDashboardData() function
  // Onboarding status is now calculated in parallel above
  
  logger.debug("[Dashboard] Balance calculation:", {
    accountCount: accounts.length,
    totalBalance,
    accountBalances: accounts.map((acc: AccountWithBalance) => ({
      id: acc.id,
      name: acc.name,
      type: acc.type,
      balance: acc.balance,
      calculatedBalance: acc.balance ?? 0,
    })),
  });

  // Calculate last month's total balance more efficiently
  // Use centralized service for consistent calculation
  const { calculateLastMonthBalanceFromCurrent } = await import('@/lib/services/balance-calculator');
  const lastMonthTotalBalance = calculateLastMonthBalanceFromCurrent(
    totalBalance,
    selectedMonthTransactions
  );

  // Remove duplicates based on id (already combined above)
  // Note: allPlannedPayments contains both BasePlannedPayment and partial objects from upcomingTransactions
  const uniquePlannedPayments = Array.from(
    new Map(allPlannedPayments.map((pp) => [pp.id, pp])).values()
  ) as BasePlannedPayment[];

  // Return only CRITICAL data for first render
  // Secondary data will be loaded separately via Suspense
  const criticalData: CriticalDashboardData = {
    selectedMonthTransactions,
    savings,
    budgets,
    upcomingTransactions,
    financialHealth,
    goals,
    totalBalance,
    accounts,
    plannedPayments: uniquePlannedPayments,
    onboardingStatus,
    expectedIncomeRange,
  };

  // For backward compatibility, we'll still return the full structure
  // but secondary data will be loaded asynchronously
  // This will be handled by a separate function for Suspense
  return {
    ...criticalData,
    // Secondary data - will be loaded separately
    lastMonthTransactions: [],
    chartTransactions: [],
    lastMonthTotalBalance: 0,
    liabilities: [],
    debts: [],
    recurringPayments: [],
    subscriptions: [],
  };
}

/**
 * Load secondary dashboard data (non-critical, can stream)
 * This function is called separately via Suspense to avoid blocking first render
 */
export async function loadSecondaryDashboardData(
  selectedMonthDate: Date,
  startDate: Date,
  endDate: Date,
  userId: string | null,
  accessToken?: string,
  refreshToken?: string
): Promise<SecondaryDashboardData> {
  const transactionsService = makeTransactionsService();
  const debtsService = makeDebtsService();
  const { makeUserSubscriptionsService } = await import("@/src/application/user-subscriptions/user-subscriptions.factory");
  
  // Calculate date ranges
  const startMonth = startOfMonth(selectedMonthDate);
  const lastMonth = subMonths(startMonth, 1);
  const lastMonthEnd = endOfMonth(lastMonth);
  const sixMonthsAgo = subMonths(endDate, 5);
  const chartStart = startOfMonth(sixMonthsAgo);
  const chartEnd = endDate;

  // Helper to get debts
  async function getDebtsWithTokens(accessToken?: string, refreshToken?: string) {
    try {
      return await debtsService.getDebts(accessToken, refreshToken);
    } catch (error) {
      logger.error("Error fetching debts:", error);
      return [];
    }
  }

  // Load all secondary data in parallel
  const [
    lastMonthTransactionsResult,
    chartTransactionsResult,
    liabilities,
    debts,
    recurringPaymentsResult,
    subscriptions,
  ] = await Promise.all([
    transactionsService.getTransactions({ startDate: lastMonth, endDate: lastMonthEnd }, accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching last month transactions:", error);
      return { transactions: [], total: 0 };
    }),
    // OPTIMIZED: Use aggregated monthly data instead of loading all transactions
    // This is much faster for chart rendering (6 months of data)
    transactionsService.getMonthlyAggregates(chartStart, chartEnd, accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching chart aggregates:", error);
      return [];
    }),
    // Plaid integration removed - liabilities no longer available
    Promise.resolve([]),
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
        return subs;
      } catch (error) {
        logger.error("[Dashboard] Error fetching user service subscriptions:", error);
        return [];
      }
    })(),
  ]);

  // Extract transactions arrays
  const lastMonthTransactions = Array.isArray(lastMonthTransactionsResult)
    ? lastMonthTransactionsResult
    : (lastMonthTransactionsResult?.transactions || []);
  
  // Chart transactions are now aggregated monthly data (not full transactions)
  // Format: [{ month: "2025-01", income: 1000, expenses: 500 }, ...]
  const chartTransactions = Array.isArray(chartTransactionsResult)
    ? chartTransactionsResult
    : [];
  
  const recurringPayments = Array.isArray(recurringPaymentsResult)
    ? recurringPaymentsResult
    : (recurringPaymentsResult?.transactions || []);

  // Calculate last month total balance
  const { calculateLastMonthBalanceFromCurrent } = await import('@/lib/services/balance-calculator');
  // We need accounts for this calculation - but we can get it from the critical data
  // For now, we'll calculate it here with a minimal accounts fetch if needed
  // TODO: Pass accounts from critical data to avoid duplicate fetch
  const lastMonthTotalBalance = calculateLastMonthBalanceFromCurrent(
    0, // Will be calculated from transactions
    lastMonthTransactions
  );

  return {
    lastMonthTransactions,
    chartTransactions,
    lastMonthTotalBalance,
    liabilities,
    debts,
    recurringPayments,
    subscriptions,
  };
}

// Load dashboard data with caching
// Cache is invalidated when transactions, budgets, goals, or accounts change
export async function loadDashboardData(
  selectedMonthDate: Date,
  startDate: Date,
  endDate: Date
): Promise<DashboardData> {
  'use cache: private'
  
  // Get userId and session tokens
  const userId = await getCurrentUserId();
  
  // Create cache key based on date range
  const dateRangeKey = `${startDate.toISOString()}-${endDate.toISOString()}`;
  cacheTag(`dashboard-${userId}`)
  cacheTag(`dashboard-${userId}-${dateRangeKey}`)
  cacheLife('financial')
  
  // Can access cookies() directly with 'use cache: private'
  const cookieStore = await cookies();
  
  // Get session tokens - optimize by doing this in parallel with other operations
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
  } catch (error: unknown) {
    logger.warn('[Dashboard] Could not get session tokens:', error instanceof Error ? error.message : String(error));
    // Continue without tokens - functions will try to get them themselves
  }
  
  try {
    return await loadDashboardDataInternal(selectedMonthDate, startDate, endDate, userId, accessToken, refreshToken);
  } catch (error) {
    logger.error('[Dashboard] Error loading data:', error);
    throw error;
  }
}

