"use server";

import { getHoldings, getInvestmentAccounts, getInvestmentTransactions } from "@/lib/api/investments";
import { Holding as SupabaseHolding } from "@/lib/api/investments";
import { formatDateStart, formatDateEnd } from "@/src/infrastructure/utils/timestamp";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { unstable_cache } from "next/cache";
import { getCurrentUserId } from "@/src/application/shared/feature-guard";
import { cache } from "@/src/infrastructure/external/redis";
import { logger } from "@/src/infrastructure/utils/logger";

// Portfolio types - exported for use across the application
export interface Holding {
  id: string;
  symbol: string;
  name: string;
  assetType: "Stock" | "ETF" | "Crypto" | "Fund";
  sector: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  bookValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  accountId: string;
  accountName: string;
}

export interface PortfolioSummary {
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  totalReturn: number;
  totalReturnPercent: number;
  totalCost: number;
  holdingsCount: number;
}

export interface Account {
  id: string;
  name: string;
  type: string;
  value: number;
  allocationPercent: number;
}

export interface HistoricalDataPoint {
  date: string;
  value: number;
}

export interface Transaction {
  id: string;
  date: string;
  type: "buy" | "sell" | "dividend" | "interest";
  symbol: string;
  name: string;
  quantity?: number;
  price?: number;
  amount: number;
  accountName: string;
}

// Helper function to convert Supabase Holding to portfolio Holding format
export async function convertSupabaseHoldingToHolding(supabaseHolding: SupabaseHolding): Promise<Holding> {
  return {
    id: supabaseHolding.securityId,
    symbol: supabaseHolding.symbol,
    name: supabaseHolding.name,
    assetType: supabaseHolding.assetType as "Stock" | "ETF" | "Crypto" | "Fund",
    sector: supabaseHolding.sector,
    quantity: supabaseHolding.quantity,
    avgPrice: supabaseHolding.avgPrice,
    currentPrice: supabaseHolding.lastPrice,
    marketValue: supabaseHolding.marketValue,
    bookValue: supabaseHolding.bookValue,
    unrealizedPnL: supabaseHolding.unrealizedPnL,
    unrealizedPnLPercent: supabaseHolding.unrealizedPnLPercent,
    accountId: supabaseHolding.accountId,
    accountName: supabaseHolding.accountName,
  };
}

// Internal data structure to share between portfolio functions
interface PortfolioInternalData {
  holdings: import("@/lib/api/investments").Holding[]; // Use the Holding type from investments
  accounts: any[];
  investmentAccounts: any[];
}

// Internal function to get shared portfolio data (holdings, accounts, etc.)
// This avoids duplicate calls to getHoldings() and getInvestmentAccounts()
// EXPORTED: Can be used by API routes to share data between endpoints
export async function getPortfolioInternalData(
  accessToken?: string, 
  refreshToken?: string
): Promise<PortfolioInternalData> {
  const { createServerClient } = await import("@/lib/supabase-server");
  const supabase = await createServerClient(accessToken, refreshToken);

  // Fetch all data in parallel to avoid sequential calls
  const [holdings, accounts, investmentAccountsResult] = await Promise.all([
    getHoldings(undefined, accessToken, refreshToken),
    getInvestmentAccounts(accessToken, refreshToken),
    supabase
      .from("InvestmentAccount")
      .select("totalEquity, marketValue, cash, id")
  ]);

  return {
    holdings,
    accounts,
    investmentAccounts: investmentAccountsResult.data || [],
  };
}

// Internal function to calculate portfolio summary (without cache)
// OPTIMIZED: Now accepts shared data to avoid duplicate calls
export async function getPortfolioSummaryInternal(
  accessToken?: string, 
  refreshToken?: string,
  sharedData?: PortfolioInternalData
): Promise<PortfolioSummary> {
  const { createServerClient } = await import("@/lib/supabase-server");
  const supabase = await createServerClient(accessToken, refreshToken);

  // Use shared data if provided, otherwise fetch it
  const data = sharedData || await getPortfolioInternalData(accessToken, refreshToken);
  const { holdings, accounts: allAccounts, investmentAccounts } = data;
  
  // Only log warnings/errors, not every calculation
  if (holdings.length > 0) {
    // Check for holdings with zero marketValue (potential data issue)
    const zeroValueHoldings = holdings.filter(h => !h.marketValue || h.marketValue === 0);
    if (zeroValueHoldings.length > 0) {
      logger.warn("[Portfolio Summary] WARNING: Found", zeroValueHoldings.length, "holdings with zero marketValue:", 
        zeroValueHoldings.map(h => ({ symbol: h.symbol, quantity: h.quantity, lastPrice: h.lastPrice, avgPrice: h.avgPrice }))
      );
    }
  }
  
  let totalValue: number;
  if (investmentAccounts && investmentAccounts.length > 0) {
    // Sum totalEquity from all investment accounts
    const investmentValue = investmentAccounts.reduce((sum, account) => {
      const accountValue = account.totalEquity ?? 
        ((account.marketValue || 0) + (account.cash || 0));
      return sum + accountValue;
    }, 0);
    
    // Also calculate value from holdings for accounts without investment account data
    const investmentAccountIds = new Set(investmentAccounts.map(ia => ia.id));
    const holdingsValue = holdings
      .filter(h => !investmentAccountIds.has(h.accountId))
      .reduce((sum, h) => sum + h.marketValue, 0);
    
    totalValue = investmentValue + holdingsValue;
    
    // Removed verbose development logging
  } else {
    // Fallback to calculating from holdings for all accounts
    totalValue = holdings.reduce((sum, h) => sum + (h.marketValue || 0), 0);
  }

  const totalCost = holdings.reduce((sum, h) => sum + h.bookValue, 0);
  const totalReturn = totalValue - totalCost;
  const totalReturnPercent = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;

  // Calculate day change from historical data
  // Note: We calculate this directly to avoid recursion with getPortfolioHistoricalData
  let dayChange = 0;
  let dayChangePercent = 0;
  
  try {
    const yesterday = subDays(new Date(), 1);
    const yesterdayDateStr = formatDateStart(yesterday);
    
    // Get security IDs from holdings (Holding.securityId is the securityId)
    const securityIds = Array.from(new Set(holdings.map(h => h.securityId)));
    
    if (securityIds.length > 0) {
      // Get yesterday's prices directly from SecurityPrice table
      // Try exact date match first, then try to get the most recent price before yesterday
      let { data: yesterdayPrices } = await supabase
        .from("SecurityPrice")
        .select("securityId, price, date")
        .in("securityId", securityIds)
        .eq("date", yesterdayDateStr);
      
      // If no prices found for yesterday, try to get the most recent prices before yesterday
      if (!yesterdayPrices || yesterdayPrices.length === 0) {
        // Get the most recent price for each security before or on yesterday
        const { data: recentPrices } = await supabase
          .from("SecurityPrice")
          .select("securityId, price, date")
          .in("securityId", securityIds)
          .lte("date", yesterdayDateStr)
          .order("date", { ascending: false });
        
        if (recentPrices && recentPrices.length > 0) {
          // Group by securityId and take the most recent price for each
          const priceMap = new Map<string, number>();
          for (const price of recentPrices) {
            if (!priceMap.has(price.securityId)) {
              priceMap.set(price.securityId, price.price);
            }
          }
          yesterdayPrices = Array.from(priceMap.entries()).map(([securityId, price]) => ({
            securityId,
            price,
            date: yesterdayDateStr,
          }));
        }
      }
      
      if (yesterdayPrices && yesterdayPrices.length > 0) {
        // Calculate yesterday's portfolio value
        const priceMap = new Map(yesterdayPrices.map(p => [p.securityId, p.price]));
        let yesterdayValue = 0;
        
        for (const holding of holdings) {
          const price = priceMap.get(holding.securityId);
          if (price !== undefined && price > 0) {
            yesterdayValue += holding.quantity * price;
          } else {
            // Use current price if no historical price available (fallback)
            yesterdayValue += holding.quantity * holding.lastPrice;
          }
        }
        
        if (yesterdayValue > 0) {
          dayChange = totalValue - yesterdayValue;
          dayChangePercent = (dayChange / yesterdayValue) * 100;
        }
      } else {
        // If no historical prices found, try to estimate from current prices
        // This is a fallback - dayChange will be 0 but at least we won't error
        logger.warn("No historical prices found for day change calculation");
      }
    }
  } catch (error) {
    logger.error("Error calculating day change:", error);
    dayChange = 0;
    dayChangePercent = 0;
  }

  return {
    totalValue,
    dayChange,
    dayChangePercent,
    totalReturn,
    totalReturnPercent,
    totalCost,
    holdingsCount: holdings.length,
  };
}

// Get portfolio summary with caching
export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  // Get session tokens before checking cache (needed for cache validation check)
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
    logger.warn("[Portfolio Summary] Could not get session tokens for cache check:", error?.message);
    // Continue without tokens - functions will try to get them themselves
  }

  // OPTIMIZED: Try Redis cache first (5 minutes TTL for portfolio data)
  const cacheKey = `portfolio:summary:${userId}`;
  const cached = await cache.get<PortfolioSummary>(cacheKey);
  if (cached) {
    // OPTIMIZED: Removed unnecessary validation that called getHoldings() even when cache is valid
    // The cache is trusted - if it shows zero, it's likely correct (user has no holdings)
    // Cache invalidation happens when transactions are created/updated via invalidatePortfolioCache()
    logger.log("[Portfolio Summary] Using cached data:", cached);
    return cached;
  }

  // Use tokens already retrieved above (or get them if not retrieved yet)
  if (!accessToken || !refreshToken) {
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
      logger.warn("[Portfolio Summary] Could not get session tokens:", error?.message);
      // Continue without tokens - functions will try to get them themselves
    }
  }

  // Fallback to Next.js cache if Redis not available
  const result = await unstable_cache(
    async () => getPortfolioSummaryInternal(accessToken, refreshToken),
    [`portfolio-summary-${userId}`],
    {
      tags: ['investments', 'portfolio'],
      revalidate: 30, // 30 seconds
    }
  )();

  // Only log errors or warnings, not every successful calculation
  if (result.totalValue === 0 && result.holdingsCount > 0) {
    logger.error("[Portfolio Summary] ERROR: Total value is 0 but there are", result.holdingsCount, "holdings!");
    logger.error("[Portfolio Summary] This indicates holdings have zero marketValue. Check price data.");
  }

  // Store in Redis cache (5 minutes TTL)
  await cache.set(cacheKey, result, 300);

  return result;
}

// Invalidate portfolio cache (useful after transactions are created/updated)
export async function invalidatePortfolioCache(userId?: string): Promise<void> {
  const targetUserId = userId || await getCurrentUserId();
  if (!targetUserId) {
    return;
  }

  const cacheKey = `portfolio:summary:${targetUserId}`;
  await cache.delete(cacheKey);
  
  // Also invalidate Next.js cache
  const { revalidateTag } = await import("next/cache");
  revalidateTag('investments', 'layout');
  revalidateTag('portfolio', 'layout');
  
  // Clear in-memory holdings cache for this user
  const { clearHoldingsCache } = await import("@/lib/api/investments");
  clearHoldingsCache(targetUserId);
  
  if (process.env.NODE_ENV === "development") {
    logger.log("[Portfolio Cache] Invalidated cache for user:", targetUserId);
  }
}

// Get portfolio holdings (convert from Supabase format)
export async function getPortfolioHoldings(accessToken?: string, refreshToken?: string): Promise<Holding[]> {
  const supabaseHoldings = await getHoldings(undefined, accessToken, refreshToken);
  return Promise.all(supabaseHoldings.map(convertSupabaseHoldingToHolding));
}

// Internal function to calculate portfolio accounts (without fetching data)
// OPTIMIZED: Accepts shared data to avoid duplicate calls
export async function getPortfolioAccountsInternal(
  sharedData: PortfolioInternalData,
  supabase: any
): Promise<Account[]> {
  const { holdings, accounts, investmentAccounts } = sharedData;

  // Get full investment account details for display
  const { data: investmentAccountsFull } = await supabase
    .from("InvestmentAccount")
    .select("*");

  // Create a map of account values from investment account balances
  const investmentAccountValues = new Map<string, number>();
  if (investmentAccountsFull) {
    for (const account of investmentAccountsFull) {
      // Use totalEquity if available, otherwise use marketValue + cash
      const accountValue = account.totalEquity ?? 
        ((account.marketValue || 0) + (account.cash || 0));
      investmentAccountValues.set(account.id, accountValue);
    }
  }

  // Calculate total value from all accounts
  const accountValues = accounts.map((account) => {
    // Use investment account balance if available, otherwise calculate from holdings
    if (investmentAccountValues.has(account.id)) {
      return investmentAccountValues.get(account.id)!;
    } else {
      const accountHoldings = holdings.filter((h) => h.accountId === account.id);
      return accountHoldings.reduce((sum, h) => sum + h.marketValue, 0);
    }
  });

  const totalValue = accountValues.reduce((sum, value) => sum + value, 0);

  return accounts.map((account, index) => {
    const accountValue = accountValues[index];
    const allocationPercent = totalValue > 0 ? (accountValue / totalValue) * 100 : 0;

    return {
      id: account.id,
      name: account.name,
      type: account.type,
      value: accountValue,
      allocationPercent,
    };
  });
}

// Get portfolio accounts with calculated values
// OPTIMIZED: Now reuses shared data to avoid duplicate calls
export async function getPortfolioAccounts(sharedData?: PortfolioInternalData): Promise<Account[]> {
  const { createServerClient } = await import("@/lib/supabase-server");
  const supabase = await createServerClient();

  // Get session tokens for passing to functions
  let accessToken: string | undefined;
  let refreshToken: string | undefined;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        accessToken = session.access_token;
        refreshToken = session.refresh_token;
      }
    }
  } catch (error: any) {
    // Continue without tokens - functions will try to get them themselves
  }

  // OPTIMIZED: Use shared data if provided, otherwise fetch it
  const data = sharedData || await getPortfolioInternalData(accessToken, refreshToken);
  
  return getPortfolioAccountsInternal(data, supabase);
}

// Internal function to calculate portfolio historical data (without cache)
// OPTIMIZED: Now accepts shared data to avoid duplicate calls
export async function getPortfolioHistoricalDataInternal(
  days: number = 365, 
  accessToken?: string, 
  refreshToken?: string,
  sharedData?: PortfolioInternalData
): Promise<HistoricalDataPoint[]> {
  const { createServerClient } = await import("@/lib/supabase-server");
  const supabase = await createServerClient(accessToken, refreshToken);
  
  // Use shared data if provided, otherwise fetch it
  const sharedPortfolioData = sharedData || await getPortfolioInternalData(accessToken, refreshToken);
  const { holdings: supabaseHoldings, accounts: allAccounts, investmentAccounts } = sharedPortfolioData;
  
  // Get current portfolio value using the same logic as getPortfolioSummaryInternal
  // OPTIMIZED: Pass shared data to avoid recalculating
  const summary = await getPortfolioSummaryInternal(accessToken, refreshToken, sharedPortfolioData);
  const currentValue = summary.totalValue;
  
  // Convert holdings to portfolio format (reuse the same holdings)
  const portfolioHoldings = await Promise.all(
    supabaseHoldings.map(convertSupabaseHoldingToHolding)
  );
  
  // Try to get historical data from SecurityPrice table
  const endDate = new Date();
  const startDate = subDays(endDate, days);
  
  // Get all unique security IDs from current holdings
  // Note: portfolioHoldings is converted from SupabaseHolding, where id = securityId
  const securityIds = Array.from(new Set(portfolioHoldings.map(h => h.id)));
  
  // If we have investment accounts, we should use their values
  // For historical data, we'll calculate from holdings but ensure today's value is accurate
  const hasInvestmentAccounts = investmentAccounts && investmentAccounts.length > 0;
  
  if (securityIds.length === 0 && !hasInvestmentAccounts) {
    // No holdings and no investment accounts, return empty array
    return [];
  }
  
  // Get historical prices for all securities
  // Optimized: Only select needed fields and use efficient date range query
  const { data: historicalPrices } = await supabase
    .from("SecurityPrice")
    .select("securityId, price, date")
    .in("securityId", securityIds)
    .gte("date", formatDateStart(startDate))
    .lte("date", formatDateEnd(endDate))
    .order("date", { ascending: true });
  
  // Group prices by date
  const pricesByDate = new Map<string, Map<string, number>>();
  if (historicalPrices) {
    for (const price of historicalPrices) {
      const dateKey = price.date instanceof Date 
        ? price.date.toISOString().split("T")[0]
        : price.date.split("T")[0];
      
      if (!pricesByDate.has(dateKey)) {
        pricesByDate.set(dateKey, new Map());
      }
      pricesByDate.get(dateKey)!.set(price.securityId, price.price);
    }
  }
  
  // OPTIMIZED: Only fetch transactions if we have accounts and securities
  // Early return if no data to process
  const accountIds = allAccounts.map(a => a.id);
  
  if (accountIds.length === 0 || securityIds.length === 0) {
    // No accounts or securities, return minimal historical data with just today's value
    const todayKey = new Date().toISOString().split("T")[0];
    return [{
      date: todayKey,
      value: currentValue,
    }];
  }
  
  // OPTIMIZED: Only fetch transactions within the date range we need
  // For large date ranges, we can optimize by only fetching transactions that affect holdings
  let transactionsStartDate: Date;
  
  try {
    // Find first transaction to ensure we capture all holdings
    // OPTIMIZED: Only query if we have accounts
    const { data: firstTx } = await supabase
      .from("InvestmentTransaction")
      .select("date")
      .in("accountId", accountIds)
      .order("date", { ascending: true })
      .limit(1);
    
    if (firstTx && firstTx.length > 0 && firstTx[0].date) {
      // Use first transaction date, but don't go before startDate
      const firstTxDate = firstTx[0].date instanceof Date 
        ? firstTx[0].date 
        : new Date(firstTx[0].date);
      transactionsStartDate = firstTxDate < startDate ? firstTxDate : startDate;
    } else {
      // No transactions found, use startDate
      transactionsStartDate = startDate;
    }
  } catch (error) {
    // Fallback: use startDate if error finding first transaction
    logger.warn("Error finding first transaction, using startDate:", error);
    transactionsStartDate = startDate;
  }
  
  // OPTIMIZED: Fetch transactions in parallel with price data if possible
  const transactions = await getInvestmentTransactions({
    startDate: transactionsStartDate,
    endDate,
  });
  
  // Group transactions by date
  const transactionsByDate = new Map<string, any[]>();
  for (const tx of transactions) {
    const dateKey = tx.date instanceof Date 
      ? tx.date.toISOString().split("T")[0]
      : tx.date.split("T")[0];
    
    if (!transactionsByDate.has(dateKey)) {
      transactionsByDate.set(dateKey, []);
    }
    transactionsByDate.get(dateKey)!.push(tx);
  }
  
  // Calculate portfolio value for each day
  const data: HistoricalDataPoint[] = [];
  const today = new Date();
  
  // Build a map to track holdings quantity over time for each security
  // Key: securityId, Value: { quantity, avgPrice }
  const holdingsOverTime = new Map<string, { quantity: number; avgPrice: number }>();
  
  // Sort transactions by date (chronological order)
  const sortedTransactions = [...transactions].sort((a, b) => {
    const dateA = a.date instanceof Date ? a.date : new Date(a.date);
    const dateB = b.date instanceof Date ? b.date : new Date(b.date);
    return dateA.getTime() - dateB.getTime();
  });
  
  // Get initial holdings (before the start date) by processing transactions backwards
  // We need to know what holdings existed at the start of the period
  const initialHoldings = new Map<string, { quantity: number; totalCost: number }>();
  
  // Process transactions before startDate to get initial state
  const preStartTransactions = sortedTransactions.filter(tx => {
    const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
    return txDate < startDate;
  });
  
  for (const tx of preStartTransactions) {
    if (!tx.securityId || (tx.type !== "buy" && tx.type !== "sell")) continue;
    
    const securityId = tx.securityId;
    const quantity = tx.quantity || 0;
    const price = tx.price || 0;
    const fees = tx.fees || 0;
    
    if (!initialHoldings.has(securityId)) {
      initialHoldings.set(securityId, { quantity: 0, totalCost: 0 });
    }
    
    const holding = initialHoldings.get(securityId)!;
    
    if (tx.type === "buy") {
      const cost = quantity * price + fees;
      const newQuantity = holding.quantity + quantity;
      const newTotalCost = holding.totalCost + cost;
      holding.quantity = newQuantity;
      holding.totalCost = newTotalCost;
    } else if (tx.type === "sell") {
      // Calculate average price for sell
      const avgPrice = holding.quantity > 0 ? holding.totalCost / holding.quantity : price;
      const cost = quantity * avgPrice;
      holding.quantity = Math.max(0, holding.quantity - quantity);
      holding.totalCost = Math.max(0, holding.totalCost - cost);
    }
  }
  
  // Initialize holdingsOverTime with initial holdings
  for (const [securityId, holding] of initialHoldings) {
    if (holding.quantity > 0) {
      holdingsOverTime.set(securityId, {
        quantity: holding.quantity,
        avgPrice: holding.totalCost / holding.quantity,
      });
    }
  }
  
  // OPTIMIZED: Pre-group transactions by date to avoid filtering in the loop
  const transactionsByDateKey = new Map<string, any[]>();
  for (const tx of sortedTransactions) {
    if (!tx.securityId || (tx.type !== "buy" && tx.type !== "sell")) continue;
    
    const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
    const txDateKey = txDate.toISOString().split("T")[0];
    
    if (!transactionsByDateKey.has(txDateKey)) {
      transactionsByDateKey.set(txDateKey, []);
    }
    transactionsByDateKey.get(txDateKey)!.push(tx);
  }
  
  // Process each day chronologically
  // OPTIMIZED: Pre-calculate date keys to avoid repeated string operations
  const todayKey = today.toISOString().split("T")[0];
  
  for (let i = 0; i <= days; i++) {
    const date = subDays(today, days - i);
    const dateKey = date.toISOString().split("T")[0];
    
    // Process all transactions on this date (pre-grouped for O(1) lookup)
    const transactionsOnDate = transactionsByDateKey.get(dateKey) || [];
    
    // Update holdings based on transactions on this date
    for (const tx of transactionsOnDate) {
      const securityId = tx.securityId;
      const quantity = tx.quantity || 0;
      const price = tx.price || 0;
      const fees = tx.fees || 0;
      
      if (!holdingsOverTime.has(securityId)) {
        holdingsOverTime.set(securityId, { quantity: 0, avgPrice: 0 });
      }
      
      const holding = holdingsOverTime.get(securityId)!;
      
      if (tx.type === "buy") {
        const cost = quantity * price + fees;
        const newQuantity = holding.quantity + quantity;
        const newTotalCost = holding.quantity * holding.avgPrice + cost;
        holding.quantity = newQuantity;
        holding.avgPrice = newQuantity > 0 ? newTotalCost / newQuantity : 0;
      } else if (tx.type === "sell") {
        // Use average cost basis for sell
        const cost = quantity * holding.avgPrice;
        holding.quantity = Math.max(0, holding.quantity - quantity);
        // Keep avgPrice the same (FIFO/LIFO would be more complex)
      }
    }
    
    // Get prices for this date
    const pricesForDate = pricesByDate.get(dateKey);
    
    // Calculate portfolio value for this date using current holdings
    let portfolioValue = 0;
    
    if (dateKey === todayKey) {
      // Today - use current value from summary (includes investment accounts)
      portfolioValue = currentValue;
    } else if (pricesForDate && holdingsOverTime.size > 0) {
      // Use historical prices if available
      for (const [securityId, holding] of holdingsOverTime) {
        if (holding.quantity <= 0) continue;
        
        const price = pricesForDate.get(securityId);
        if (price !== undefined) {
          portfolioValue += holding.quantity * price;
        } else {
          // Use average price if no historical price available
          portfolioValue += holding.quantity * holding.avgPrice;
        }
      }
    } else if (holdingsOverTime.size > 0) {
      // No historical prices available - use book value (cost basis) as fallback
      for (const [securityId, holding] of holdingsOverTime) {
        if (holding.quantity > 0) {
          portfolioValue += holding.quantity * holding.avgPrice;
        }
      }
    }
    
    data.push({
      date: dateKey,
      value: Math.max(0, portfolioValue),
    });
  }
  
  // Always ensure today's value is included and accurate (from summary, includes all accounts)
  if (data.length > 0) {
    const todayKey = today.toISOString().split("T")[0];
    const todayIndex = data.findIndex(d => d.date === todayKey);
    if (todayIndex >= 0) {
      // Override with accurate current value from summary (includes investment accounts)
      data[todayIndex].value = currentValue;
    } else {
      // Add today's value if not already in the data
      data.push({
        date: todayKey,
        value: currentValue,
      });
    }
  } else {
    // If no historical data, at least show today's value from summary
    data.push({
      date: today.toISOString().split("T")[0],
      value: currentValue,
    });
  }
  
  // If we have investment accounts but no historical data, add a point for today
  // This ensures the chart shows at least the current value
  if (hasInvestmentAccounts && data.length === 1 && data[0].date === today.toISOString().split("T")[0]) {
    // We already have today's value, which is good
    if (process.env.NODE_ENV === "development") {
      logger.log("[Portfolio Historical] Using investment account values, current value:", currentValue);
    }
  }
  
  // Sort by date to ensure chronological order
  data.sort((a, b) => a.date.localeCompare(b.date));
  
  return data;
}

// Get portfolio historical data with caching
export async function getPortfolioHistoricalData(days: number = 365): Promise<HistoricalDataPoint[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  // OPTIMIZED: Try Redis cache first (5 minutes TTL for historical data)
  const cacheKey = `portfolio:historical:${userId}:${days}`;
  const cached = await cache.get<HistoricalDataPoint[]>(cacheKey);
  if (cached) {
    return cached;
  }

  // Get session tokens before entering cache (cookies can't be accessed inside unstable_cache)
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
    logger.warn("[Portfolio Historical] Could not get session tokens:", error?.message);
    // Continue without tokens - functions will try to get them themselves
  }

  // Fallback to Next.js cache if Redis not available
  const result = await unstable_cache(
    async () => getPortfolioHistoricalDataInternal(days, accessToken, refreshToken),
    [`portfolio-historical-${userId}-${days}`],
    {
      tags: ['investments', 'portfolio'],
      revalidate: 60, // 60 seconds
    }
  )();

  // Store in Redis cache (5 minutes TTL)
  await cache.set(cacheKey, result, 300);

  return result;
}

// Get recent portfolio transactions
export async function getPortfolioTransactions(limit: number = 10): Promise<Transaction[]> {
  const endDate = new Date();
  const startDate = subDays(endDate, 30); // Last 30 days
  
  const transactions = await getInvestmentTransactions({
    startDate,
    endDate,
  });

  // Convert to Transaction format
  return transactions.slice(0, limit).map((tx: any) => ({
    id: tx.id,
    date: tx.date instanceof Date ? tx.date.toISOString().split("T")[0] : tx.date.split("T")[0],
    type: tx.type as "buy" | "sell" | "dividend" | "interest",
    symbol: tx.security?.symbol || "",
    name: tx.security?.name || "",
    quantity: tx.quantity || undefined,
    price: tx.price || undefined,
    amount: tx.quantity && tx.price ? tx.quantity * tx.price : 0,
    accountName: tx.account?.name || "Unknown Account",
  }));
}

