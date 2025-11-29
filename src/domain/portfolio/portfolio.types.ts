/**
 * Domain types for portfolio
 * Pure TypeScript types with no external dependencies
 */

export interface BasePortfolioHolding {
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

export interface BasePortfolioSummary {
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  totalReturn: number;
  totalReturnPercent: number;
  totalCost: number;
  holdingsCount: number;
}

export interface BasePortfolioAccount {
  id: string;
  name: string;
  type: string;
  value: number;
  allocationPercent: number;
}

export interface BaseHistoricalDataPoint {
  date: string;
  value: number;
}

export interface BasePortfolioTransaction {
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

// Aliases for backward compatibility (matches lib/api/portfolio.ts interfaces)
export type Holding = BasePortfolioHolding;
export type PortfolioSummary = BasePortfolioSummary;
export type HistoricalDataPoint = BaseHistoricalDataPoint;

