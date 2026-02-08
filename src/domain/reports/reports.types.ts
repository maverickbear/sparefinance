/**
 * Domain types for reports
 * Pure TypeScript types with no external dependencies
 */

import type { Budget } from "@/src/domain/budgets/budgets.types";
import type { Transaction } from "@/src/domain/transactions/transactions.types";
import type { DebtWithCalculations } from "@/src/domain/debts/debts.types";
import type { GoalWithCalculations } from "@/src/domain/goals/goals.types";
import type { Account } from "@/src/domain/accounts/accounts.types";
import type { FinancialHealthData } from "@/src/application/shared/financial-health";

export type ReportPeriod = 
  | "current-month"
  | "last-3-months"
  | "last-6-months"
  | "last-12-months"
  | "year-to-date"
  | "custom";

export interface ReportsData {
  budgets: Budget[];
  currentMonthTransactions: Transaction[];
  historicalTransactions: Transaction[];
  debts: DebtWithCalculations[];
  goals: GoalWithCalculations[];
  financialHealth: FinancialHealthData | null;
  accounts: Account[];
  portfolioSummary: null;
  portfolioHoldings: unknown[];
  portfolioHistorical: unknown[];
  netWorth: NetWorthData | null;
  cashFlow: CashFlowData;
  trends: TrendData[];
}

export interface NetWorthData {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  historical: NetWorthHistoricalPoint[];
  change: {
    amount: number;
    percent: number;
    period: string;
  };
}

export interface NetWorthHistoricalPoint {
  date: string;
  assets: number;
  liabilities: number;
  netWorth: number;
}

export interface CashFlowData {
  income: number;
  expenses: number;
  net: number;
  monthly: CashFlowMonthlyData[];
}

export interface CashFlowMonthlyData {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface TrendData {
  metric: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  direction: "up" | "down" | "stable";
}

