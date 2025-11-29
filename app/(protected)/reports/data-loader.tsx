import { getTransactionsInternal } from "@/lib/api/transactions";
import { getBudgetsInternal } from "@/lib/api/budgets";
import { getDebts } from "@/lib/api/debts";
import { getGoalsInternal } from "@/lib/api/goals";
import { getAccounts } from "@/lib/api/accounts";
import { calculateFinancialHealth } from "@/src/application/shared/financial-health";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { guardFeatureAccessReadOnly } from "@/src/application/shared/feature-guard";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import { logger } from "@/src/infrastructure/utils/logger";
import type { Budget } from "@/lib/api/budgets";
import type { DebtWithCalculations } from "@/lib/api/debts";
import type { GoalWithCalculations } from "@/lib/api/goals";
import type { FinancialHealthData } from "@/src/application/shared/financial-health";
import type { PortfolioSummary, HistoricalDataPoint, Holding } from "@/lib/api/portfolio";
import type { ReportPeriod } from "@/components/reports/report-filters";

export interface ReportsData {
  budgets: Budget[];
  currentMonthTransactions: any[];
  historicalTransactions: any[];
  debts: DebtWithCalculations[];
  goals: GoalWithCalculations[];
  financialHealth: FinancialHealthData | null;
  accounts: any[]; // Account type from accounts-client (compatible with server-side getAccounts return)
  portfolioSummary: PortfolioSummary | null;
  portfolioHoldings: Holding[];
  portfolioHistorical: HistoricalDataPoint[];
}

function getDateRange(period: ReportPeriod, now: Date): { startDate: Date; endDate: Date } {
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

async function loadReportsDataInternal(
  period: ReportPeriod,
  userId: string | null,
  accessToken?: string,
  refreshToken?: string
): Promise<ReportsData> {
  const now = new Date();
  const currentMonth = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const dateRange = getDateRange(period, now);
  const historicalStartDate = dateRange.startDate;

  // PERFORMANCE: Fetch accounts first, then use it for goals to avoid duplicate getAccounts() call
  const [
    currentMonthTransactionsResult,
    historicalTransactionsResult,
    budgets,
    debts,
    accounts,
  ] = await Promise.all([
    getTransactionsInternal(
      { startDate: currentMonth, endDate: currentMonthEnd },
      accessToken,
      refreshToken
    ).catch((error) => {
      logger.error("Error fetching current month transactions:", error);
      return { transactions: [], total: 0 };
    }),
    getTransactionsInternal(
      { startDate: historicalStartDate, endDate: dateRange.endDate },
      accessToken,
      refreshToken
    ).catch((error) => {
      logger.error("Error fetching historical transactions:", error);
      return { transactions: [], total: 0 };
    }),
    getBudgetsInternal(now, accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching budgets:", error);
      return [];
    }),
    getDebts(accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching debts:", error);
      return [];
    }),
    getAccounts(accessToken, refreshToken).catch((error) => {
      logger.error("Error fetching accounts:", error);
      return [];
    }),
  ]);

  // Fetch goals using already-loaded accounts (avoids duplicate getAccounts() call)
  const goals = await getGoalsInternal(accessToken, refreshToken, accounts).catch((error) => {
    logger.error("Error fetching goals:", error);
    return [];
  });

  // Extract transactions arrays from results
  const currentMonthTransactions = Array.isArray(currentMonthTransactionsResult)
    ? currentMonthTransactionsResult
    : (currentMonthTransactionsResult?.transactions || []);
  const historicalTransactions = Array.isArray(historicalTransactionsResult)
    ? historicalTransactionsResult
    : (historicalTransactionsResult?.transactions || []);

  // Calculate financial health (always use current month)
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

  // Load portfolio data only if user has access to investments
  let portfolioSummary: PortfolioSummary | null = null;
  let portfolioHoldings: Holding[] = [];
  let portfolioHistorical: HistoricalDataPoint[] = [];

  if (userId) {
    try {
      const featureGuard = await guardFeatureAccessReadOnly(userId, "hasInvestments");
      if (featureGuard.allowed) {
        // Use the consolidated portfolio endpoint
        const { createServerClient } = await import("@/lib/supabase-server");
        const supabase = await createServerClient(accessToken, refreshToken);
        
        // Get session tokens if not provided
        let tokens = { accessToken, refreshToken };
        if (!accessToken || !refreshToken) {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: { session } } = await supabase.auth.getSession();
              if (session) {
                tokens = {
                  accessToken: session.access_token,
                  refreshToken: session.refresh_token,
                };
              }
            }
          } catch (error: any) {
            logger.warn("[Reports] Could not get session tokens:", error?.message);
          }
        }

        // Fetch portfolio data using internal functions for better performance
        const { 
          getPortfolioSummaryInternal,
          getPortfolioHoldings,
          getPortfolioHistoricalDataInternal,
          getPortfolioInternalData
        } = await import("@/lib/api/portfolio");

        // Get shared portfolio data once
        const sharedData = await getPortfolioInternalData(
          tokens.accessToken,
          tokens.refreshToken
        );

        // PERFORMANCE: Use holdings from sharedData instead of calling getPortfolioHoldings again
        // This avoids duplicate getHoldings() call
        const { convertSupabaseHoldingToHolding } = await import("@/lib/api/portfolio");
        
        // Calculate all portfolio data using shared data
        const [summary, historical] = await Promise.all([
          getPortfolioSummaryInternal(
            tokens.accessToken,
            tokens.refreshToken,
            sharedData
          ).catch(() => null),
          getPortfolioHistoricalDataInternal(
            365,
            tokens.accessToken,
            tokens.refreshToken,
            sharedData
          ).catch(() => []),
        ]);

        // Convert holdings from sharedData (already fetched, no need to call getHoldings again)
        const holdings = await Promise.all(
          sharedData.holdings.map(convertSupabaseHoldingToHolding)
        );

        portfolioSummary = summary;
        portfolioHoldings = holdings;
        portfolioHistorical = historical;
      }
    } catch (error) {
      logger.error("Error loading portfolio data:", error);
    }
  }

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
  };
}

// Load reports data with caching
export async function loadReportsData(period: ReportPeriod): Promise<ReportsData> {
  // Get userId and session tokens BEFORE caching (cookies can't be accessed inside unstable_cache)
  const userId = await getCurrentUserId();
  
  // Get session tokens before entering cache
  let accessToken: string | undefined;
  let refreshToken: string | undefined;
  try {
    const { createServerClient } = await import("@/lib/supabase-server");
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
    logger.warn("[Reports] Could not get session tokens:", error?.message);
    // Continue without tokens - functions will try to get them themselves
  }
  
  // Import cache utilities
  const { withCache, generateCacheKey, CACHE_TAGS } = await import("@/lib/services/cache-manager");
  
  try {
    // Use centralized cache manager with proper tags
    const cacheKey = generateCacheKey.reports({
      userId: userId || undefined,
      period,
    });
    
    return await withCache(
      async () => loadReportsDataInternal(period, userId, accessToken, refreshToken),
      {
        key: cacheKey,
        tags: [
          CACHE_TAGS.REPORTS,
          CACHE_TAGS.TRANSACTIONS,
          CACHE_TAGS.ACCOUNTS,
          CACHE_TAGS.BUDGETS,
          CACHE_TAGS.GOALS,
        ],
        revalidate: 300, // 300 seconds (5 minutes) - same as dashboard
      }
    );
  } catch (error) {
    logger.error("[Reports] Error loading data:", error);
    throw error;
  }
}

