"use server";

import { getHoldings, getInvestmentAccounts, getInvestmentTransactions } from "@/lib/api/investments";
import { Holding } from "@/lib/api/investments";
import { formatDateStart, formatDateEnd } from "@/lib/utils/timestamp";
import { subDays, startOfDay, endOfDay } from "date-fns";
import type { PortfolioSummary, Account, HistoricalDataPoint, Transaction } from "@/lib/mock-data/portfolio-mock-data";

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

  // Calculate day change (simplified - would need previous day's value in real implementation)
  // For now, we'll estimate based on a small percentage
  const dayChangePercent = 0.85; // Mock value - in real implementation, calculate from historical data
  const dayChange = totalValue * (dayChangePercent / 100);

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

// Get portfolio holdings (already in correct format from getHoldings)
export async function getPortfolioHoldings(): Promise<Holding[]> {
  return await getHoldings();
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
  const holdings = await getHoldings();
  const currentValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  
  // Get all transactions to calculate historical values
  const endDate = new Date();
  const startDate = subDays(endDate, days);
  
  const transactions = await getInvestmentTransactions({
    startDate,
    endDate,
  });

  // Generate historical data points
  // For now, we'll create a simplified version
  // In a real implementation, you'd calculate portfolio value for each day
  const data: HistoricalDataPoint[] = [];
  const today = new Date();
  
  // Start from 15% lower and grow to current value
  const startValue = currentValue * 0.85;
  
  for (let i = days; i >= 0; i--) {
    const date = subDays(today, i);
    const progress = (days - i) / days;
    
    // Simulate growth with some volatility
    const volatility = (Math.random() - 0.5) * 0.02;
    const value = startValue * (1 + progress * 0.2) * (1 + volatility);
    
    data.push({
      date: date.toISOString().split("T")[0],
      value: Math.max(0, value),
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

