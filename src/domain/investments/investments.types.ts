/**
 * Domain types for investments
 * Pure TypeScript types with no external dependencies
 */

export interface BaseHolding {
  securityId: string;
  symbol: string;
  name: string;
  assetType: string;
  sector: string;
  quantity: number;
  avgPrice: number;
  bookValue: number;
  lastPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  accountId: string;
  accountName: string;
}

export interface BaseInvestmentTransaction {
  id: string;
  date: Date | string;
  type: "buy" | "sell" | "dividend" | "interest" | "transfer_in" | "transfer_out";
  quantity: number | null;
  price: number | null;
  fees: number;
  notes: string | null;
  securityId: string | null;
  accountId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  // Enriched fields
  account?: { id: string; name: string; type: string } | null;
  security?: { id: string; symbol: string; name: string; class: string; sector: string | null } | null;
}

export interface BaseSecurity {
  id: string;
  symbol: string;
  name: string;
  class: string;
  sector: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface BaseSecurityPrice {
  id: string;
  securityId: string;
  date: Date | string;
  price: number;
  createdAt: Date | string;
  // Enriched fields
  security?: BaseSecurity | null;
}

export interface BaseInvestmentAccount {
  id: string;
  name: string;
  type: string;
  userId: string;
  householdId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

