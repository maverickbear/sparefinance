"use server";

import { getHoldings, getInvestmentAccounts, getInvestmentTransactions } from "@/lib/api/investments";
import { Holding as SupabaseHolding } from "@/lib/api/investments";
import { formatDateStart, formatDateEnd } from "@/lib/utils/timestamp";
import { subDays, startOfDay, endOfDay } from "date-fns";

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

// Get portfolio summary
export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  const { createServerClient } = await import("@/lib/supabase-server");
  const supabase = await createServerClient();

  const holdings = await getHoldings();
  
  // Try to get total value from Questrade accounts first (more accurate)
  const { data: questradeAccounts } = await supabase
    .from("InvestmentAccount")
    .select("*")
    .eq("isQuestradeConnected", true);

  let totalValue: number;
  if (questradeAccounts && questradeAccounts.length > 0) {
    // Sum totalEquity from all Questrade accounts
    totalValue = questradeAccounts.reduce((sum, account) => {
      const accountValue = account.totalEquity ?? 
        ((account.marketValue || 0) + (account.cash || 0));
      return sum + accountValue;
    }, 0);
  } else {
    // Fallback to calculating from holdings
    totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
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
    const yesterdayKey = yesterday.toISOString().split("T")[0];
    
    // Get security IDs from holdings (Holding.id is the securityId)
    const securityIds = Array.from(new Set(holdings.map(h => h.id)));
    
    if (securityIds.length > 0) {
      // Get yesterday's prices directly from SecurityPrice table
      const { data: yesterdayPrices } = await supabase
        .from("SecurityPrice")
        .select("securityId, price")
        .in("securityId", securityIds)
        .eq("date", formatDateStart(yesterday))
        .order("securityId", { ascending: true });
      
      if (yesterdayPrices && yesterdayPrices.length > 0) {
        // Calculate yesterday's portfolio value
        const priceMap = new Map(yesterdayPrices.map(p => [p.securityId, p.price]));
        let yesterdayValue = 0;
        
        for (const holding of holdings) {
          const price = priceMap.get(holding.id); // Holding.id is the securityId (from convertSupabaseHoldingToHolding)
          if (price !== undefined) {
            yesterdayValue += holding.quantity * price;
          } else {
            // Use average price if no price available
            yesterdayValue += holding.quantity * holding.avgPrice;
          }
        }
        
        if (yesterdayValue > 0) {
          dayChange = totalValue - yesterdayValue;
          dayChangePercent = (dayChange / yesterdayValue) * 100;
        }
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

// Get portfolio historical data
export async function getPortfolioHistoricalData(days: number = 365): Promise<HistoricalDataPoint[]> {
  const { createServerClient } = await import("@/lib/supabase-server");
  const supabase = await createServerClient();
  
  const portfolioHoldings = await getPortfolioHoldings();
  const currentValue = portfolioHoldings.reduce((sum, h) => sum + h.marketValue, 0);
  
  // Try to get historical data from SecurityPrice table
  const endDate = new Date();
  const startDate = subDays(endDate, days);
  
  // Get all unique security IDs from current holdings (Holding.id is the securityId)
  const securityIds = Array.from(new Set(portfolioHoldings.map(h => h.id)));
  
  if (securityIds.length === 0) {
    // No holdings, return empty array
    return [];
  }
  
  // Get historical prices for all securities
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
  // We need transactions from before startDate too, to calculate initial holdings
  const transactionsStartDate = subDays(startDate, 365 * 5); // Get transactions from up to 5 years ago
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
      // Today - use current value
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
  
  return data;
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

