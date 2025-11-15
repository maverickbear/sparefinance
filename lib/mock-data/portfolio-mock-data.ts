// Portfolio types and utilities
// This file now only exports types and helper functions
// All data is fetched from Supabase via lib/api/portfolio.ts

// Re-export types from lib/api/portfolio for backward compatibility
export type {
  Holding,
  PortfolioSummary,
  Account,
  HistoricalDataPoint,
  Transaction,
} from "@/lib/api/portfolio";

// Re-export helper function for backward compatibility
export { convertSupabaseHoldingToHolding } from "@/lib/api/portfolio";
