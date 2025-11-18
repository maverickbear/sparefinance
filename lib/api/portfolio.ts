"use server";

import { getHoldings, getInvestmentAccounts, getInvestmentTransactions } from "@/lib/api/investments";
import { Holding as SupabaseHolding } from "@/lib/api/investments";
import { formatDateStart, formatDateEnd } from "@/lib/utils/timestamp";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { unstable_cache } from "next/cache";
import { getCurrentUserId } from "@/lib/api/feature-guard";
import { cache } from "@/lib/services/redis";

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

// Internal function to calculate portfolio summary (without cache)
async function getPortfolioSummaryInternal(): Promise<PortfolioSummary> {
  const { createServerClient } = await import("@/lib/supabase-server");
  const supabase = await createServerClient();

  console.log("[Portfolio Summary Internal] Starting calculation...");
  const holdings = await getHoldings();
  console.log("[Portfolio Summary Internal] getHoldings() returned", holdings.length, "holdings");
  
  // Debug: Log holdings count and values
  console.log("[Portfolio Summary] Holdings count:", holdings.length);
  if (holdings.length > 0) {
    const totalMarketValue = holdings.reduce((sum, h) => sum + (h.marketValue || 0), 0);
    const totalBookValue = holdings.reduce((sum, h) => sum + (h.bookValue || 0), 0);
    console.log("[Portfolio Summary] Total market value from holdings:", totalMarketValue);
    console.log("[Portfolio Summary] Total book value from holdings:", totalBookValue);
    console.log("[Portfolio Summary] Sample holdings (first 5):", holdings.slice(0, 5).map(h => ({
      symbol: h.symbol,
      quantity: h.quantity,
      marketValue: h.marketValue,
      bookValue: h.bookValue,
      lastPrice: h.lastPrice,
      avgPrice: h.avgPrice,
      accountId: h.accountId,
    })));
    
    // Check for holdings with zero marketValue
    const zeroValueHoldings = holdings.filter(h => !h.marketValue || h.marketValue === 0);
    if (zeroValueHoldings.length > 0) {
      console.warn("[Portfolio Summary] WARNING: Found", zeroValueHoldings.length, "holdings with zero marketValue:", 
        zeroValueHoldings.map(h => ({ symbol: h.symbol, quantity: h.quantity, lastPrice: h.lastPrice, avgPrice: h.avgPrice }))
      );
    }
  } else {
    console.warn("[Portfolio Summary] WARNING: No holdings found!");
  }
  
  // Try to get total value from Questrade accounts first (more accurate)
  // Optimized: Single query with only needed fields
  const { data: questradeAccounts } = await supabase
    .from("InvestmentAccount")
    .select("totalEquity, marketValue, cash, id")
    .eq("isQuestradeConnected", true);

  // Also get all investment accounts to calculate total value
  const allAccounts = await getInvestmentAccounts();
  
  // Debug: Log accounts
  if (process.env.NODE_ENV === "development") {
    console.log("[Portfolio Summary] Questrade accounts:", questradeAccounts?.length || 0);
    console.log("[Portfolio Summary] All investment accounts:", allAccounts.length);
  }
  
  let totalValue: number;
  if (questradeAccounts && questradeAccounts.length > 0) {
    // Sum totalEquity from all Questrade accounts
    const questradeValue = questradeAccounts.reduce((sum, account) => {
      const accountValue = account.totalEquity ?? 
        ((account.marketValue || 0) + (account.cash || 0));
      return sum + accountValue;
    }, 0);
    
    // Also calculate value from holdings for non-Questrade accounts
    const questradeAccountIds = new Set(questradeAccounts.map(qa => qa.id));
    const nonQuestradeHoldingsValue = holdings
      .filter(h => !questradeAccountIds.has(h.accountId))
      .reduce((sum, h) => sum + h.marketValue, 0);
    
    totalValue = questradeValue + nonQuestradeHoldingsValue;
    
    if (process.env.NODE_ENV === "development") {
      console.log("[Portfolio Summary] Questrade value:", questradeValue);
      console.log("[Portfolio Summary] Non-Questrade holdings value:", nonQuestradeHoldingsValue);
    }
  } else {
    // Fallback to calculating from holdings for all accounts
    totalValue = holdings.reduce((sum, h) => sum + (h.marketValue || 0), 0);
    
    console.log("[Portfolio Summary] No Questrade accounts, calculating from holdings");
    console.log("[Portfolio Summary] Total value from holdings:", totalValue);
    console.log("[Portfolio Summary] Holdings breakdown:", holdings.map(h => ({
      symbol: h.symbol,
      marketValue: h.marketValue,
      accountId: h.accountId,
    })));
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
        console.warn("No historical prices found for day change calculation");
      }
    }
  } catch (error) {
    console.error("Error calculating day change:", error);
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

  // OPTIMIZED: Try Redis cache first (5 minutes TTL for portfolio data)
  const cacheKey = `portfolio:summary:${userId}`;
  const cached = await cache.get<PortfolioSummary>(cacheKey);
  if (cached) {
    // CRITICAL FIX: If cached data shows zero values but we have holdings, recalculate
    // This prevents stale cache from showing zeros when there are actual holdings
    if (cached.totalValue === 0 && cached.holdingsCount === 0) {
      // Check if we actually have holdings - if yes, cache is stale, recalculate
      const holdings = await getHoldings();
      if (holdings.length > 0) {
        console.warn("[Portfolio Summary] Cache shows zero but we have", holdings.length, "holdings. Recalculating...");
        // Delete stale cache and recalculate
        await cache.delete(cacheKey);
        // Continue to calculation below
      } else {
        // No holdings, cache is correct
        console.log("[Portfolio Summary] Using cached data (no holdings):", cached);
        return cached;
      }
    } else {
      // Cache has valid data
      console.log("[Portfolio Summary] Using cached data:", cached);
      return cached;
    }
  }

  // Fallback to Next.js cache if Redis not available
  const result = await unstable_cache(
    async () => getPortfolioSummaryInternal(),
    [`portfolio-summary-${userId}`],
    {
      tags: ['investments', 'portfolio'],
      revalidate: 30, // 30 seconds
    }
  )();

  // Log result for debugging
  console.log("[Portfolio Summary] Calculated result:", result);
  if (result.totalValue === 0 && result.holdingsCount > 0) {
    console.error("[Portfolio Summary] ERROR: Total value is 0 but there are", result.holdingsCount, "holdings!");
    console.error("[Portfolio Summary] This indicates holdings have zero marketValue. Check price data.");
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
  
  if (process.env.NODE_ENV === "development") {
    console.log("[Portfolio Cache] Invalidated cache for user:", targetUserId);
  }
}

// Get portfolio holdings (convert from Supabase format)
export async function getPortfolioHoldings(): Promise<Holding[]> {
  const supabaseHoldings = await getHoldings();
  return Promise.all(supabaseHoldings.map(convertSupabaseHoldingToHolding));
}

// Get portfolio accounts with calculated values
export async function getPortfolioAccounts(): Promise<Account[]> {
  const { createServerClient } = await import("@/lib/supabase-server");
  const supabase = await createServerClient();

  // Get all accounts, prioritizing Questrade accounts with real balance data
  const accounts = await getInvestmentAccounts();
  const holdings = await getHoldings();

  // Get Questrade accounts with balance information
  const { data: questradeAccounts } = await supabase
    .from("InvestmentAccount")
    .select("*")
    .eq("isQuestradeConnected", true);

  // Create a map of account values from Questrade balances
  const questradeAccountValues = new Map<string, number>();
  if (questradeAccounts) {
    for (const account of questradeAccounts) {
      // Use totalEquity if available, otherwise use marketValue + cash
      const accountValue = account.totalEquity ?? 
        ((account.marketValue || 0) + (account.cash || 0));
      questradeAccountValues.set(account.id, accountValue);
    }
  }

  // Calculate total value from all accounts
  const accountValues = accounts.map((account) => {
    // Use Questrade balance if available, otherwise calculate from holdings
    if (questradeAccountValues.has(account.id)) {
      return questradeAccountValues.get(account.id)!;
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

// Internal function to calculate portfolio historical data (without cache)
async function getPortfolioHistoricalDataInternal(days: number = 365): Promise<HistoricalDataPoint[]> {
  const { createServerClient } = await import("@/lib/supabase-server");
  const supabase = await createServerClient();
  
  // Get current portfolio value using the same logic as getPortfolioSummaryInternal
  // This includes Questrade account values, not just holdings
  const summary = await getPortfolioSummaryInternal();
  const currentValue = summary.totalValue;
  
  const portfolioHoldings = await getPortfolioHoldings();
  
  // Try to get historical data from SecurityPrice table
  const endDate = new Date();
  const startDate = subDays(endDate, days);
  
  // Get all unique security IDs from current holdings
  // Note: portfolioHoldings is converted from SupabaseHolding, where id = securityId
  const securityIds = Array.from(new Set(portfolioHoldings.map(h => h.id)));
  
  // Get all investment accounts to check for Questrade accounts
  const allAccounts = await getInvestmentAccounts();
  const { data: questradeAccounts } = await supabase
    .from("InvestmentAccount")
    .select("id, totalEquity, marketValue, cash, isQuestradeConnected")
    .eq("isQuestradeConnected", true);
  
  // If we have Questrade accounts, we should use their values
  // For historical data, we'll calculate from holdings but ensure today's value is accurate
  const hasQuestradeAccounts = questradeAccounts && questradeAccounts.length > 0;
  
  if (securityIds.length === 0 && !hasQuestradeAccounts) {
    // No holdings and no Questrade accounts, return empty array
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
  
  // Get all transactions to track quantity changes over time
  // FIXED: Search from first transaction to ensure we capture initial holdings
  // This ensures historical data is accurate even for long-term holdings
  let transactionsStartDate: Date;
  
  try {
    // Get user's investment accounts
    const accountIds = allAccounts.map(a => a.id);
    
    if (accountIds.length > 0) {
      // Find first transaction to ensure we capture all holdings
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
    } else {
      // No accounts, use startDate
      transactionsStartDate = startDate;
    }
  } catch (error) {
    // Fallback: use startDate if error finding first transaction
    console.warn("Error finding first transaction, using startDate:", error);
    transactionsStartDate = startDate;
  }
  
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
  
  // Process each day chronologically
  for (let i = 0; i <= days; i++) {
    const date = subDays(today, days - i);
    const dateKey = date.toISOString().split("T")[0];
    
    // Process all transactions on this date (in chronological order)
    const transactionsOnDate = sortedTransactions.filter(tx => {
      const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
      const txDateKey = txDate.toISOString().split("T")[0];
      return txDateKey === dateKey;
    });
    
    // Update holdings based on transactions on this date
    for (const tx of transactionsOnDate) {
      if (!tx.securityId || (tx.type !== "buy" && tx.type !== "sell")) continue;
      
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
    
    if (pricesForDate && holdingsOverTime.size > 0) {
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
    } else if (i === days) {
      // Today - use current value from summary (includes Questrade accounts)
      portfolioValue = currentValue;
    } else {
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
      // Override with accurate current value from summary (includes Questrade accounts)
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
  
  // If we have Questrade accounts but no historical data, add a point for today
  // This ensures the chart shows at least the current value
  if (hasQuestradeAccounts && data.length === 1 && data[0].date === today.toISOString().split("T")[0]) {
    // We already have today's value, which is good
    if (process.env.NODE_ENV === "development") {
      console.log("[Portfolio Historical] Using Questrade account values, current value:", currentValue);
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

  // Fallback to Next.js cache if Redis not available
  const result = await unstable_cache(
    async () => getPortfolioHistoricalDataInternal(days),
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

