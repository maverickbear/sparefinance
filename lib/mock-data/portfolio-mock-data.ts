// Mock data for Portfolio Management Dashboard
// All assets are categorized by sector/industry

import type { Holding as SupabaseHolding } from "@/lib/api/investments";

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

// Mock Holdings Data
export const mockHoldings: Holding[] = [
  // Stocks - Technology
  {
    id: "1",
    symbol: "AAPL",
    name: "Apple Inc.",
    assetType: "Stock",
    sector: "Technology",
    quantity: 50,
    avgPrice: 150.00,
    currentPrice: 175.50,
    marketValue: 8775.00,
    bookValue: 7500.00,
    unrealizedPnL: 1275.00,
    unrealizedPnLPercent: 17.0,
    accountId: "acc1",
    accountName: "RRSP",
  },
  {
    id: "2",
    symbol: "MSFT",
    name: "Microsoft Corporation",
    assetType: "Stock",
    sector: "Technology",
    quantity: 30,
    avgPrice: 320.00,
    currentPrice: 385.20,
    marketValue: 11556.00,
    bookValue: 9600.00,
    unrealizedPnL: 1956.00,
    unrealizedPnLPercent: 20.4,
    accountId: "acc1",
    accountName: "RRSP",
  },
  {
    id: "3",
    symbol: "GOOGL",
    name: "Alphabet Inc.",
    assetType: "Stock",
    sector: "Technology",
    quantity: 25,
    avgPrice: 125.00,
    currentPrice: 142.30,
    marketValue: 3557.50,
    bookValue: 3125.00,
    unrealizedPnL: 432.50,
    unrealizedPnLPercent: 13.8,
    accountId: "acc2",
    accountName: "TFSA",
  },
  {
    id: "4",
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    assetType: "Stock",
    sector: "Technology",
    quantity: 15,
    avgPrice: 450.00,
    currentPrice: 520.75,
    marketValue: 7811.25,
    bookValue: 6750.00,
    unrealizedPnL: 1061.25,
    unrealizedPnLPercent: 15.7,
    accountId: "acc1",
    accountName: "RRSP",
  },
  // Stocks - Finance
  {
    id: "5",
    symbol: "JPM",
    name: "JPMorgan Chase & Co.",
    assetType: "Stock",
    sector: "Finance",
    quantity: 40,
    avgPrice: 140.00,
    currentPrice: 152.30,
    marketValue: 6092.00,
    bookValue: 5600.00,
    unrealizedPnL: 492.00,
    unrealizedPnLPercent: 8.8,
    accountId: "acc1",
    accountName: "RRSP",
  },
  {
    id: "6",
    symbol: "BAC",
    name: "Bank of America Corp",
    assetType: "Stock",
    sector: "Finance",
    quantity: 60,
    avgPrice: 32.00,
    currentPrice: 35.20,
    marketValue: 2112.00,
    bookValue: 1920.00,
    unrealizedPnL: 192.00,
    unrealizedPnLPercent: 10.0,
    accountId: "acc2",
    accountName: "TFSA",
  },
  {
    id: "7",
    symbol: "V",
    name: "Visa Inc.",
    assetType: "Stock",
    sector: "Finance",
    quantity: 20,
    avgPrice: 240.00,
    currentPrice: 265.50,
    marketValue: 5310.00,
    bookValue: 4800.00,
    unrealizedPnL: 510.00,
    unrealizedPnLPercent: 10.6,
    accountId: "acc1",
    accountName: "RRSP",
  },
  // Stocks - Healthcare
  {
    id: "8",
    symbol: "JNJ",
    name: "Johnson & Johnson",
    assetType: "Stock",
    sector: "Healthcare",
    quantity: 35,
    avgPrice: 160.00,
    currentPrice: 168.50,
    marketValue: 5897.50,
    bookValue: 5600.00,
    unrealizedPnL: 297.50,
    unrealizedPnLPercent: 5.3,
    accountId: "acc1",
    accountName: "RRSP",
  },
  {
    id: "9",
    symbol: "UNH",
    name: "UnitedHealth Group Inc.",
    assetType: "Stock",
    sector: "Healthcare",
    quantity: 15,
    avgPrice: 480.00,
    currentPrice: 525.00,
    marketValue: 7875.00,
    bookValue: 7200.00,
    unrealizedPnL: 675.00,
    unrealizedPnLPercent: 9.4,
    accountId: "acc2",
    accountName: "TFSA",
  },
  // Stocks - Consumer
  {
    id: "10",
    symbol: "AMZN",
    name: "Amazon.com Inc.",
    assetType: "Stock",
    sector: "Consumer",
    quantity: 20,
    avgPrice: 140.00,
    currentPrice: 152.80,
    marketValue: 3056.00,
    bookValue: 2800.00,
    unrealizedPnL: 256.00,
    unrealizedPnLPercent: 9.1,
    accountId: "acc2",
    accountName: "TFSA",
  },
  {
    id: "11",
    symbol: "TSLA",
    name: "Tesla, Inc.",
    assetType: "Stock",
    sector: "Consumer",
    quantity: 25,
    avgPrice: 200.00,
    currentPrice: 245.50,
    marketValue: 6137.50,
    bookValue: 5000.00,
    unrealizedPnL: 1137.50,
    unrealizedPnLPercent: 22.8,
    accountId: "acc3",
    accountName: "Taxable",
  },
  {
    id: "12",
    symbol: "WMT",
    name: "Walmart Inc.",
    assetType: "Stock",
    sector: "Consumer",
    quantity: 30,
    avgPrice: 150.00,
    currentPrice: 162.30,
    marketValue: 4869.00,
    bookValue: 4500.00,
    unrealizedPnL: 369.00,
    unrealizedPnLPercent: 8.2,
    accountId: "acc1",
    accountName: "RRSP",
  },
  // Stocks - Energy
  {
    id: "13",
    symbol: "XOM",
    name: "Exxon Mobil Corporation",
    assetType: "Stock",
    sector: "Energy",
    quantity: 40,
    avgPrice: 95.00,
    currentPrice: 102.50,
    marketValue: 4100.00,
    bookValue: 3800.00,
    unrealizedPnL: 300.00,
    unrealizedPnLPercent: 7.9,
    accountId: "acc1",
    accountName: "RRSP",
  },
  {
    id: "14",
    symbol: "CVX",
    name: "Chevron Corporation",
    assetType: "Stock",
    sector: "Energy",
    quantity: 25,
    avgPrice: 150.00,
    currentPrice: 158.20,
    marketValue: 3955.00,
    bookValue: 3750.00,
    unrealizedPnL: 205.00,
    unrealizedPnLPercent: 5.5,
    accountId: "acc2",
    accountName: "TFSA",
  },
  // ETFs - Technology
  {
    id: "15",
    symbol: "QQQ",
    name: "Invesco QQQ Trust",
    assetType: "ETF",
    sector: "Technology",
    quantity: 50,
    avgPrice: 350.00,
    currentPrice: 385.50,
    marketValue: 19275.00,
    bookValue: 17500.00,
    unrealizedPnL: 1775.00,
    unrealizedPnLPercent: 10.1,
    accountId: "acc1",
    accountName: "RRSP",
  },
  {
    id: "16",
    symbol: "XLK",
    name: "Technology Select Sector SPDR Fund",
    assetType: "ETF",
    sector: "Technology",
    quantity: 30,
    avgPrice: 180.00,
    currentPrice: 195.20,
    marketValue: 5856.00,
    bookValue: 5400.00,
    unrealizedPnL: 456.00,
    unrealizedPnLPercent: 8.4,
    accountId: "acc2",
    accountName: "TFSA",
  },
  // ETFs - Broad Market
  {
    id: "17",
    symbol: "SPY",
    name: "SPDR S&P 500 ETF Trust",
    assetType: "ETF",
    sector: "Broad Market",
    quantity: 40,
    avgPrice: 420.00,
    currentPrice: 445.30,
    marketValue: 17812.00,
    bookValue: 16800.00,
    unrealizedPnL: 1012.00,
    unrealizedPnLPercent: 6.0,
    accountId: "acc1",
    accountName: "RRSP",
  },
  {
    id: "18",
    symbol: "VTI",
    name: "Vanguard Total Stock Market ETF",
    assetType: "ETF",
    sector: "Broad Market",
    quantity: 35,
    avgPrice: 220.00,
    currentPrice: 235.50,
    marketValue: 8242.50,
    bookValue: 7700.00,
    unrealizedPnL: 542.50,
    unrealizedPnLPercent: 7.0,
    accountId: "acc2",
    accountName: "TFSA",
  },
  // ETFs - Healthcare
  {
    id: "19",
    symbol: "XLV",
    name: "Health Care Select Sector SPDR Fund",
    assetType: "ETF",
    sector: "Healthcare",
    quantity: 25,
    avgPrice: 130.00,
    currentPrice: 142.50,
    marketValue: 3562.50,
    bookValue: 3250.00,
    unrealizedPnL: 312.50,
    unrealizedPnLPercent: 9.6,
    accountId: "acc1",
    accountName: "RRSP",
  },
  // ETFs - Finance
  {
    id: "20",
    symbol: "XLF",
    name: "Financial Select Sector SPDR Fund",
    assetType: "ETF",
    sector: "Finance",
    quantity: 30,
    avgPrice: 35.00,
    currentPrice: 38.20,
    marketValue: 1146.00,
    bookValue: 1050.00,
    unrealizedPnL: 96.00,
    unrealizedPnLPercent: 9.1,
    accountId: "acc2",
    accountName: "TFSA",
  },
  // Crypto
  {
    id: "21",
    symbol: "BTC",
    name: "Bitcoin",
    assetType: "Crypto",
    sector: "Cryptocurrency",
    quantity: 0.5,
    avgPrice: 45000.00,
    currentPrice: 48500.00,
    marketValue: 24250.00,
    bookValue: 22500.00,
    unrealizedPnL: 1750.00,
    unrealizedPnLPercent: 7.8,
    accountId: "acc4",
    accountName: "Crypto Wallet",
  },
  {
    id: "22",
    symbol: "ETH",
    name: "Ethereum",
    assetType: "Crypto",
    sector: "Cryptocurrency",
    quantity: 5,
    avgPrice: 2800.00,
    currentPrice: 3100.00,
    marketValue: 15500.00,
    bookValue: 14000.00,
    unrealizedPnL: 1500.00,
    unrealizedPnLPercent: 10.7,
    accountId: "acc4",
    accountName: "Crypto Wallet",
  },
  {
    id: "23",
    symbol: "SOL",
    name: "Solana",
    assetType: "Crypto",
    sector: "Cryptocurrency",
    quantity: 50,
    avgPrice: 120.00,
    currentPrice: 135.50,
    marketValue: 6775.00,
    bookValue: 6000.00,
    unrealizedPnL: 775.00,
    unrealizedPnLPercent: 12.9,
    accountId: "acc4",
    accountName: "Crypto Wallet",
  },
  {
    id: "24",
    symbol: "ADA",
    name: "Cardano",
    assetType: "Crypto",
    sector: "Cryptocurrency",
    quantity: 2000,
    avgPrice: 0.50,
    currentPrice: 0.55,
    marketValue: 1100.00,
    bookValue: 1000.00,
    unrealizedPnL: 100.00,
    unrealizedPnLPercent: 10.0,
    accountId: "acc4",
    accountName: "Crypto Wallet",
  },
  // Funds
  {
    id: "25",
    symbol: "TECHFUND",
    name: "Technology Growth Fund",
    assetType: "Fund",
    sector: "Technology",
    quantity: 100,
    avgPrice: 25.00,
    currentPrice: 28.50,
    marketValue: 2850.00,
    bookValue: 2500.00,
    unrealizedPnL: 350.00,
    unrealizedPnLPercent: 14.0,
    accountId: "acc1",
    accountName: "RRSP",
  },
  {
    id: "26",
    symbol: "BALFUND",
    name: "Balanced Growth Fund",
    assetType: "Fund",
    sector: "Balanced",
    quantity: 150,
    avgPrice: 20.00,
    currentPrice: 21.80,
    marketValue: 3270.00,
    bookValue: 3000.00,
    unrealizedPnL: 270.00,
    unrealizedPnLPercent: 9.0,
    accountId: "acc2",
    accountName: "TFSA",
  },
  {
    id: "27",
    symbol: "INTFUND",
    name: "International Equity Fund",
    assetType: "Fund",
    sector: "International",
    quantity: 80,
    avgPrice: 30.00,
    currentPrice: 32.20,
    marketValue: 2576.00,
    bookValue: 2400.00,
    unrealizedPnL: 176.00,
    unrealizedPnLPercent: 7.3,
    accountId: "acc1",
    accountName: "RRSP",
  },
];

// Calculate portfolio summary
const totalValue = mockHoldings.reduce((sum, h) => sum + h.marketValue, 0);
const totalCost = mockHoldings.reduce((sum, h) => sum + h.bookValue, 0);
const totalReturn = totalValue - totalCost;
const totalReturnPercent = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;

export const mockPortfolioSummary: PortfolioSummary = {
  totalValue: totalValue,
  dayChange: 1250.50,
  dayChangePercent: 0.85,
  totalReturn: totalReturn,
  totalReturnPercent: totalReturnPercent,
  totalCost: totalCost,
  holdingsCount: mockHoldings.length,
};

// Mock Accounts
export const mockAccounts: Account[] = [
  {
    id: "acc1",
    name: "RRSP",
    type: "Retirement",
    value: mockHoldings
      .filter((h) => h.accountId === "acc1")
      .reduce((sum, h) => sum + h.marketValue, 0),
    allocationPercent: 0,
  },
  {
    id: "acc2",
    name: "TFSA",
    type: "Tax-Free",
    value: mockHoldings
      .filter((h) => h.accountId === "acc2")
      .reduce((sum, h) => sum + h.marketValue, 0),
    allocationPercent: 0,
  },
  {
    id: "acc3",
    name: "Taxable",
    type: "Taxable",
    value: mockHoldings
      .filter((h) => h.accountId === "acc3")
      .reduce((sum, h) => sum + h.marketValue, 0),
    allocationPercent: 0,
  },
  {
    id: "acc4",
    name: "Crypto Wallet",
    type: "Crypto",
    value: mockHoldings
      .filter((h) => h.accountId === "acc4")
      .reduce((sum, h) => sum + h.marketValue, 0),
    allocationPercent: 0,
  },
].map((acc) => ({
  ...acc,
  allocationPercent: (acc.value / totalValue) * 100,
}));

// Generate historical data (365 days)
export const generateHistoricalData = (days: number = 365): HistoricalDataPoint[] => {
  const data: HistoricalDataPoint[] = [];
  const today = new Date();
  const startValue = totalValue * 0.85; // Start 15% lower
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Simulate growth with some volatility
    const progress = (days - i) / days;
    const volatility = (Math.random() - 0.5) * 0.02;
    const value = startValue * (1 + progress * 0.2) * (1 + volatility);
    
    data.push({
      date: date.toISOString().split("T")[0],
      value: Math.max(0, value),
    });
  }
  
  return data;
};

export const mockHistoricalData = generateHistoricalData(365);

// Mock Transactions
export const mockTransactions: Transaction[] = [
  {
    id: "tx1",
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    type: "buy",
    symbol: "AAPL",
    name: "Apple Inc.",
    quantity: 10,
    price: 175.50,
    amount: 1755.00,
    accountName: "RRSP",
  },
  {
    id: "tx2",
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    type: "dividend",
    symbol: "JPM",
    name: "JPMorgan Chase & Co.",
    amount: 120.00,
    accountName: "RRSP",
  },
  {
    id: "tx3",
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    type: "buy",
    symbol: "ETH",
    name: "Ethereum",
    quantity: 1,
    price: 3100.00,
    amount: 3100.00,
    accountName: "Crypto Wallet",
  },
  {
    id: "tx4",
    date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    type: "sell",
    symbol: "TSLA",
    name: "Tesla, Inc.",
    quantity: 5,
    price: 245.50,
    amount: 1227.50,
    accountName: "Taxable",
  },
  {
    id: "tx5",
    date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    type: "dividend",
    symbol: "SPY",
    name: "SPDR S&P 500 ETF Trust",
    amount: 85.50,
    accountName: "RRSP",
  },
  {
    id: "tx6",
    date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    type: "buy",
    symbol: "QQQ",
    name: "Invesco QQQ Trust",
    quantity: 10,
    price: 385.50,
    amount: 3855.00,
    accountName: "RRSP",
  },
];

// Get unique sectors from holdings
export const getUniqueSectors = (): string[] => {
  return Array.from(new Set(mockHoldings.map((h) => h.sector))).sort();
};

// Get unique asset types
export const getUniqueAssetTypes = (): string[] => {
  return Array.from(new Set(mockHoldings.map((h) => h.assetType))).sort();
};

// Helper function to convert Supabase Holding to mock data Holding format
export function convertSupabaseHoldingToHolding(supabaseHolding: SupabaseHolding): Holding {
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

