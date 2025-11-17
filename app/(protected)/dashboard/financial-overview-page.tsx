"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartSkeleton } from "@/components/ui/chart-skeleton";
import { CardSkeleton } from "@/components/ui/card-skeleton";
import { ListSkeleton } from "@/components/ui/list-skeleton";
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

const UpcomingBillsWidget = dynamic(
  () => import("./widgets/upcoming-bills-widget").then(m => ({ default: m.UpcomingBillsWidget })),
  { 
    ssr: true,
    loading: () => <ListSkeleton itemCount={5} />
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
    ssr: true,
    loading: () => <CardSkeleton />
  }
);

const InvestmentPortfolioWidget = dynamic(
  () => import("./widgets/investment-portfolio-widget").then(m => ({ default: m.InvestmentPortfolioWidget })),
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
  selectedMonthDate,
}: FinancialOverviewPageProps) {
  // Calculate income and expenses using helper functions for consistency
  const currentIncome = useMemo(() => {
    return calculateTotalIncome(selectedMonthTransactions);
  }, [selectedMonthTransactions]);

  const currentExpenses = useMemo(() => {
    return calculateTotalExpenses(selectedMonthTransactions);
  }, [selectedMonthTransactions]);

  // Calculate last month income and expenses for comparison
  const lastMonthIncome = useMemo(() => {
    return calculateTotalIncome(lastMonthTransactions);
  }, [lastMonthTransactions]);

  const lastMonthExpenses = useMemo(() => {
    return calculateTotalExpenses(lastMonthTransactions);
  }, [lastMonthTransactions]);

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

      {/* Cash Flow Timeline */}
      <CashFlowTimelineWidget
        chartTransactions={chartTransactions}
        selectedMonthDate={selectedMonthDate}
      />

      {/* Budget Status and Upcoming Transactions - Same Row */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Budget Status */}
        <BudgetStatusWidget
          budgets={budgets}
        />

        {/* Upcoming Transactions */}
        <UpcomingBillsWidget
          upcomingTransactions={upcomingTransactions}
        />
      </div>

      {/* Dashboard Grid */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* Savings Goals, Net Worth Snapshot, and Investment Portfolio - side by side, full width */}
        <div className="col-span-full">
          <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-3">
            <SavingsGoalsWidget
              goals={goals}
            />
            <NetWorthWidget
              netWorth={netWorth}
              totalAssets={totalAssets}
              totalDebts={totalDebts}
            />
            <InvestmentPortfolioWidget
              savings={savings}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

