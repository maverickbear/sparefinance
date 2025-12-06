import type { BasePortfolioHolding as Holding, BasePortfolioAccount as Account } from "@/src/domain/portfolio/portfolio.types";

// Calculate portfolio metrics
export function calculatePortfolioMetrics(holdings: Holding[]) {
  const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.bookValue, 0);
  const totalReturn = totalValue - totalCost;
  const totalReturnPercent = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;
  const totalPnL = holdings.reduce((sum, h) => sum + h.unrealizedPnL, 0);

  return {
    totalValue,
    totalCost,
    totalReturn,
    totalReturnPercent,
    totalPnL,
    holdingsCount: holdings.length,
  };
}

// Normalize asset type to standard format (first letter uppercase, rest lowercase)
// Handles variations like "Stock", "stock", "STOCK", etc.
export function normalizeAssetType(type: string | undefined | null): string {
  if (!type) return "Stock"; // Default to Stock
  
  const normalized = type.trim();
  const lower = normalized.toLowerCase();
  
  // Map common variations to standard format
  const typeMap: Record<string, string> = {
    stock: "Stock",
    etf: "ETF",
    crypto: "Crypto",
    cryptocurrency: "Crypto",
    fund: "Fund",
    mutualfund: "Fund",
    "mutual fund": "Fund",
    bond: "Bond",
    reit: "REIT",
  };
  
  // Check if we have a direct mapping
  if (typeMap[lower]) {
    return typeMap[lower];
  }
  
  // If it's already in a valid format (first letter uppercase), return as is
  // Otherwise, capitalize first letter
  const validTypes = ["Stock", "ETF", "Crypto", "Fund", "Bond", "REIT"];
  if (validTypes.includes(normalized)) {
    return normalized;
  }
  
  // Default: capitalize first letter, lowercase rest
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

// Format asset type
export function formatAssetType(type: string): string {
  const types: Record<string, string> = {
    Stock: "Stock",
    ETF: "ETF",
    Crypto: "Crypto",
    Fund: "Fund",
  };
  return types[type] || type;
}

// Calculate returns
export function calculateReturn(currentValue: number, costBasis: number): number {
  if (costBasis === 0) return 0;
  return ((currentValue - costBasis) / costBasis) * 100;
}

// Group holdings by asset type
export function groupHoldingsByType(holdings: Holding[]): Record<string, Holding[]> {
  return holdings.reduce((acc, holding) => {
    const type = holding.assetType;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(holding);
    return acc;
  }, {} as Record<string, Holding[]>);
}

// Group holdings by sector/industry
export function groupHoldingsBySector(holdings: Holding[]): Record<string, Holding[]> {
  return holdings.reduce((acc, holding) => {
    const sector = holding.sector;
    if (!acc[sector]) {
      acc[sector] = [];
    }
    acc[sector].push(holding);
    return acc;
  }, {} as Record<string, Holding[]>);
}

// Calculate sector allocation percentages
export function calculateSectorAllocation(holdings: Holding[]): Array<{
  sector: string;
  value: number;
  percent: number;
  count: number;
}> {
  const grouped = groupHoldingsBySector(holdings);
  const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);

  return Object.entries(grouped)
    .map(([sector, sectorHoldings]) => {
      const value = sectorHoldings.reduce((sum, h) => sum + h.marketValue, 0);
      const percent = totalValue > 0 ? (value / totalValue) * 100 : 0;
      return {
        sector,
        value,
        percent,
        count: sectorHoldings.length,
      };
    })
    .sort((a, b) => b.value - a.value);
}

// Calculate asset type allocation percentages
export function calculateAssetTypeAllocation(holdings: Holding[]): Array<{
  type: string;
  value: number;
  percent: number;
  count: number;
}> {
  const grouped = groupHoldingsByType(holdings);
  const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);

  return Object.entries(grouped)
    .map(([type, typeHoldings]) => {
      const value = typeHoldings.reduce((sum, h) => sum + h.marketValue, 0);
      const percent = totalValue > 0 ? (value / totalValue) * 100 : 0;
      return {
        type,
        value,
        percent,
        count: typeHoldings.length,
      };
    })
    .sort((a, b) => b.value - a.value);
}

// Calculate account allocation
export function calculateAccountAllocation(
  holdings: Holding[],
  accounts: Account[]
): Account[] {
  const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);

  return accounts.map((account) => {
    const accountHoldings = holdings.filter((h) => h.accountId === account.id);
    const accountValue = accountHoldings.reduce((sum, h) => sum + h.marketValue, 0);
    const allocationPercent = totalValue > 0 ? (accountValue / totalValue) * 100 : 0;

    return {
      ...account,
      value: accountValue,
      allocationPercent,
    };
  });
}

// Get unique sectors from holdings
export function getUniqueSectors(holdings: Holding[]): string[] {
  return Array.from(new Set(holdings.map((h) => h.sector))).sort();
}

// Get unique asset types from holdings
export function getUniqueAssetTypes(holdings: Holding[]): string[] {
  return Array.from(new Set(holdings.map((h) => h.assetType))).sort();
}

// Filter holdings by asset type
export function filterHoldingsByAssetType(
  holdings: Holding[],
  assetType: string | null
): Holding[] {
  if (!assetType) return holdings;
  return holdings.filter((h) => h.assetType === assetType);
}

// Filter holdings by sector
export function filterHoldingsBySector(
  holdings: Holding[],
  sector: string | null
): Holding[] {
  if (!sector) return holdings;
  return holdings.filter((h) => h.sector === sector);
}

// Get color for sector (for charts)
export function getSectorColor(sector: string): string {
  const colors: Record<string, string> = {
    Technology: "#3b82f6", // blue
    Finance: "#10b981", // green
    Healthcare: "#8b5cf6", // purple
    Consumer: "#f59e0b", // amber
    Energy: "#ef4444", // red
    "Broad Market": "#06b6d4", // cyan
    Cryptocurrency: "#f97316", // orange
    Balanced: "#6366f1", // indigo
    International: "#14b8a6", // teal
  };
  return colors[sector] || "#6b7280"; // gray as default
}

// Get color for asset type (for charts)
export function getAssetTypeColor(type: string): string {
  const colors: Record<string, string> = {
    Stock: "#3b82f6", // blue
    ETF: "#10b981", // green
    Crypto: "#f59e0b", // amber
    Fund: "#8b5cf6", // purple
  };
  return colors[type] || "#6b7280"; // gray as default
}

// Map Security class to sector (fallback when sector is not defined)
export function mapClassToSector(assetClass: string, symbol?: string): string {
  // If it's Crypto, return Cryptocurrency
  if (assetClass === "Crypto" || assetClass === "crypto") {
    return "Cryptocurrency";
  }

  // If it's ETF, return Broad Market (can be refined later)
  if (assetClass === "ETF" || assetClass === "etf") {
    return "Broad Market";
  }

  // If it's Fund, return Balanced (can be refined later)
  if (assetClass === "Fund" || assetClass === "fund") {
    return "Balanced";
  }

  // For Stocks, try to map by symbol
  if (assetClass === "Stock" || assetClass === "stock") {
    if (!symbol) return "Technology"; // default

    const symbolUpper = symbol.toUpperCase();

    // Technology stocks
    const techSymbols = ["AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "META", "NVDA", "TSLA", "NFLX", "AMD", "INTC", "CRM", "ORCL", "ADBE", "CSCO"];
    if (techSymbols.includes(symbolUpper)) {
      return "Technology";
    }

    // Finance stocks
    const financeSymbols = ["JPM", "BAC", "WFC", "C", "GS", "MS", "V", "MA", "AXP", "BLK", "SCHW"];
    if (financeSymbols.includes(symbolUpper)) {
      return "Finance";
    }

    // Healthcare stocks
    const healthcareSymbols = ["JNJ", "PFE", "UNH", "ABBV", "MRK", "TMO", "ABT", "CVS", "CI", "HUM"];
    if (healthcareSymbols.includes(symbolUpper)) {
      return "Healthcare";
    }

    // Consumer stocks
    const consumerSymbols = ["WMT", "HD", "MCD", "NKE", "SBUX", "TGT", "LOW", "COST"];
    if (consumerSymbols.includes(symbolUpper)) {
      return "Consumer";
    }

    // Energy stocks
    const energySymbols = ["XOM", "CVX", "COP", "SLB", "EOG", "MPC", "VLO"];
    if (energySymbols.includes(symbolUpper)) {
      return "Energy";
    }

    // Default to Technology for unknown stocks
    return "Technology";
  }

  // Default fallback
  return "Technology";
}

