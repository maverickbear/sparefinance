"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import { CardSkeleton } from "@/components/ui/card-skeleton";
import { FinancialSummaryWidget } from "./widgets/financial-summary-widget";
import { FinancialHealthScoreWidget } from "./widgets/financial-health-score-widget";
import { calculateTotalIncome, calculateTotalExpenses } from "./utils/transaction-helpers";

// Lazy load widgets with heavy chart libraries (recharts) - no SSR
const CashFlowTimelineWidget = dynamic(
  () => import("./widgets/cash-flow-timeline-widget").then(m => ({ default: m.CashFlowTimelineWidget })),
  { 
    ssr: false, // recharts doesn't work well with SSR
    loading: () => <ChartSkeleton height={400} />
  }
);

// Lazy load widgets below the fold - with SSR
const ExpensesByCategoryWidget = dynamic(
  () => import("./widgets/expenses-by-category-widget").then(m => ({ default: m.ExpensesByCategoryWidget })),
  { 
    ssr: true,
    loading: () => <CardSkeleton />
  }
);


const BudgetStatusWidget = dynamic(
  () => import("./widgets/budget-status-widget").then(m => ({ default: m.BudgetStatusWidget })),
  { 
    ssr: true,
    loading: () => <CardSkeleton />
  }
);

const SavingsGoalsWidget = dynamic(
  () => import("./widgets/savings-goals-widget").then(m => ({ default: m.SavingsGoalsWidget })),
  { 
    ssr: true,
    loading: () => <CardSkeleton />
  }
);

const NetWorthWidget = dynamic(
  () => import("./widgets/net-worth-widget").then(m => ({ default: m.NetWorthWidget })),
  { 
    ssr: false, // recharts doesn't work well with SSR
    loading: () => <ChartSkeleton height={300} />
  }
);

const PortfolioPerformanceWidget = dynamic(
  () => import("./widgets/portfolio-performance-widget").then(m => ({ default: m.PortfolioPerformanceWidget })),
  { 
    ssr: false, // recharts doesn't work well with SSR
    loading: () => <CardSkeleton />
  }
);

const RecurringPaymentsWidget = dynamic(
  () => import("./widgets/recurring-payments-widget").then(m => ({ default: m.RecurringPaymentsWidget })),
  { 
    ssr: true,
    loading: () => <CardSkeleton />
  }
);

const SubscriptionsWidget = dynamic(
  () => import("./widgets/subscriptions-widget").then(m => ({ default: m.SubscriptionsWidget })),
  { 
    ssr: true,
    loading: () => <CardSkeleton />
  }
);

interface FinancialOverviewPageProps {
  selectedMonthTransactions: any[];
  lastMonthTransactions: any[];
  savings: number;
  totalBalance: number;
  lastMonthTotalBalance: number;
  accounts: any[];
  budgets: any[];
  upcomingTransactions: any[];
  financialHealth: any;
  goals: any[];
  chartTransactions: any[];
  liabilities: any[];
  debts: any[];
  recurringPayments: any[];
  subscriptions: any[];
  selectedMonthDate: Date;
}

export function FinancialOverviewPage({
  selectedMonthTransactions,
  lastMonthTransactions,
  savings,
  totalBalance,
  lastMonthTotalBalance,
  accounts,
  budgets,
  upcomingTransactions,
  financialHealth,
  goals,
  chartTransactions,
  liabilities,
  debts,
  recurringPayments,
  subscriptions,
  selectedMonthDate,
}: FinancialOverviewPageProps) {
  // Helper function to parse date from Supabase format
  const parseTransactionDate = (dateStr: string | Date): Date => {
    if (dateStr instanceof Date) {
      return dateStr;
    }
    // Handle both "YYYY-MM-DD HH:MM:SS" and "YYYY-MM-DDTHH:MM:SS" formats
    const normalized = dateStr.replace(' ', 'T').split('.')[0]; // Remove milliseconds if present
    return new Date(normalized);
  };

  // Get today's date (without time) to filter out future transactions
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  // Filter transactions to only include those with date <= today
  // Exclude future transactions as they haven't happened yet
  const pastSelectedMonthTransactions = useMemo(() => {
    return selectedMonthTransactions.filter((t) => {
      if (!t.date) return false;
      try {
        const txDate = parseTransactionDate(t.date);
        txDate.setHours(0, 0, 0, 0);
        return txDate <= today;
      } catch (error) {
        return false; // Exclude if date parsing fails
      }
    });
  }, [selectedMonthTransactions, today]);

  const pastLastMonthTransactions = useMemo(() => {
    return lastMonthTransactions.filter((t) => {
      if (!t.date) return false;
      try {
        const txDate = parseTransactionDate(t.date);
        txDate.setHours(0, 0, 0, 0);
        return txDate <= today;
      } catch (error) {
        return false; // Exclude if date parsing fails
      }
    });
  }, [lastMonthTransactions, today]);

  // Calculate income and expenses using helper functions for consistency
  // Only include past transactions (exclude future ones)
  const currentIncome = useMemo(() => {
    return calculateTotalIncome(pastSelectedMonthTransactions);
  }, [pastSelectedMonthTransactions]);

  const currentExpenses = useMemo(() => {
    return calculateTotalExpenses(pastSelectedMonthTransactions);
  }, [pastSelectedMonthTransactions]);

  // Calculate last month income and expenses for comparison
  const lastMonthIncome = useMemo(() => {
    return calculateTotalIncome(pastLastMonthTransactions);
  }, [pastLastMonthTransactions]);

  const lastMonthExpenses = useMemo(() => {
    return calculateTotalExpenses(pastLastMonthTransactions);
  }, [pastLastMonthTransactions]);

  // Calculate net worth (assets - debts)
  // 
  // ASSETS: totalBalance includes ALL account types:
  // - Checking accounts (calculated from transactions)
  // - Savings accounts (calculated from transactions)
  // - Investment accounts (calculated from Questrade, AccountInvestmentValue, or Holdings)
  // - All other account types
  //
  // The getAccounts() function already calculates investment account values correctly,
  // so totalBalance is the sum of all account balances including investments.
  const totalAssets = useMemo(() => {
    return totalBalance;
  }, [totalBalance]);

  // DEBTS: Sum of all liabilities and debts
  // - PlaidLiabilities: debts from Plaid connections (credit cards, loans, etc.)
  // - Debt table: manually entered debts (only those not paid off)
  const totalDebts = useMemo(() => {
    let total = 0;

    // Calculate from PlaidLiabilities (from Plaid connections)
    if (liabilities && liabilities.length > 0) {
      const liabilitiesTotal = liabilities.reduce((sum: number, liability: any) => {
        // Try balance first (for backward compatibility), then currentBalance
        const balance = liability.balance ?? liability.currentBalance ?? null;
        
        if (balance == null || balance === undefined) {
          return sum;
        }
        
        // Handle string, number, or null values
        let numValue: number;
        if (typeof balance === 'string') {
          numValue = parseFloat(balance);
        } else {
          numValue = Number(balance);
        }
        
        // Only add if it's a valid finite number (debts can be positive or zero)
        if (!isNaN(numValue) && isFinite(numValue)) {
          // For debts, we want the absolute value (a balance of -1000 means debt of 1000)
          // But if it's already positive, use it as-is
          const debtAmount = numValue < 0 ? Math.abs(numValue) : numValue;
          return sum + debtAmount;
        }
        
        return sum;
      }, 0);
      
      total += liabilitiesTotal;
    }

    // Calculate from Debt table (manually entered debts, only those not paid off)
    if (debts && debts.length > 0) {
      const debtsTotal = debts.reduce((sum: number, debt: any) => {
        // Only include debts that are not paid off
        if (debt.isPaidOff) {
          return sum;
        }
        
        // Use currentBalance from the Debt table
        const balance = debt.currentBalance ?? null;
        
        if (balance == null || balance === undefined) {
          return sum;
        }
        
        // Handle string, number, or null values
        let numValue: number;
        if (typeof balance === 'string') {
          numValue = parseFloat(balance);
        } else {
          numValue = Number(balance);
        }
        
        // Only add if it's a valid finite number and positive
        if (!isNaN(numValue) && isFinite(numValue) && numValue > 0) {
          return sum + numValue;
        }
        
        return sum;
      }, 0);
      
      total += debtsTotal;
    }

    return total;
  }, [liabilities, debts]);

  // NET WORTH = Total Assets - Total Debts
  const netWorth = totalAssets - totalDebts;

  // Use emergency fund months from financial health if available (more accurate)
  // Otherwise calculate from total balance and monthly expenses
  const monthlyExpenses = currentExpenses || 1; // Avoid division by zero
  const emergencyFundMonths = financialHealth?.emergencyFundMonths ?? 
    (totalBalance > 0 ? (totalBalance / monthlyExpenses) : 0);


  return (
    <div className="space-y-4 md:space-y-6">
      {/* Financial Summary - Full Width */}
      <FinancialSummaryWidget
        totalBalance={totalBalance}
        monthlyIncome={currentIncome}
        monthlyExpense={currentExpenses}
        totalSavings={savings}
        lastMonthIncome={lastMonthIncome}
        lastMonthExpense={lastMonthExpenses}
      />

      {/* Top Widgets - Spare Score and Expenses by Category side by side */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        <FinancialHealthScoreWidget
          financialHealth={financialHealth}
          selectedMonthTransactions={selectedMonthTransactions}
          lastMonthTransactions={lastMonthTransactions}
        />
        <ExpensesByCategoryWidget
          selectedMonthTransactions={selectedMonthTransactions}
          selectedMonthDate={selectedMonthDate}
        />
      </div>

      {/* Cash Flow Timeline and Budget Status side by side */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        <CashFlowTimelineWidget
          chartTransactions={chartTransactions}
          selectedMonthDate={selectedMonthDate}
        />
        <BudgetStatusWidget
          budgets={budgets}
        />
      </div>

      {/* Recurring Payments and Savings Goals side by side */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
      <RecurringPaymentsWidget
        recurringPayments={recurringPayments}
        monthlyIncome={currentIncome}
      />
        <SavingsGoalsWidget
          goals={goals}
        />
      </div>

      {/* Subscriptions Widget - Full Width */}
      <SubscriptionsWidget
        subscriptions={subscriptions}
      />

      {/* Dashboard Grid */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* Net Worth Snapshot and Investment Portfolio - side by side, full width */}
        <div className="col-span-full">
          <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
            <NetWorthWidget
              netWorth={netWorth}
              totalAssets={totalAssets}
              totalDebts={totalDebts}
            />
            <PortfolioPerformanceWidget
              savings={savings}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

