"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FinancialSummaryWidget } from "./widgets/financial-summary-widget";
import { FinancialHealthScoreWidget } from "./widgets/financial-health-score-widget";
import { CashFlowTimelineWidget } from "./widgets/cash-flow-timeline-widget";
import { ExpensesByCategoryWidget } from "./widgets/expenses-by-category-widget";
import { CashOnHandWidget } from "./widgets/cash-on-hand-widget";
import { BudgetStatusWidget } from "./widgets/budget-status-widget";
import { UpcomingBillsWidget } from "./widgets/upcoming-bills-widget";
import { EmergencyFundWidget } from "./widgets/emergency-fund-widget";
import { SavingsGoalsWidget } from "./widgets/savings-goals-widget";
import { NetWorthWidget } from "./widgets/net-worth-widget";
import { InvestmentPortfolioWidget } from "./widgets/investment-portfolio-widget";
import { AlertsInsightsWidget } from "./widgets/alerts-insights-widget";
import { calculateTotalIncome, calculateTotalExpenses } from "./utils/transaction-helpers";

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
  const totalAssets = useMemo(() => {
    return totalBalance + savings; // Cash + investments
  }, [totalBalance, savings]);

  const totalDebts = useMemo(() => {
    let total = 0;

    // Calculate from PlaidLiabilities
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

    // Calculate from Debt table (only debts that are not paid off)
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
        
        // Only add if it's a valid finite number
        if (!isNaN(numValue) && isFinite(numValue) && numValue > 0) {
          return sum + numValue;
        }
        
        return sum;
      }, 0);
      
      total += debtsTotal;
    }

    return total;
  }, [liabilities, debts]);

  const netWorth = totalAssets - totalDebts;

  // Calculate emergency fund months
  const monthlyExpenses = currentExpenses || 1; // Avoid division by zero
  const emergencyFundMonths = totalBalance > 0 ? (totalBalance / monthlyExpenses) : 0;

  // Calculate checking vs savings
  const checkingAccounts = accounts.filter((acc: any) => acc.type === 'checking' || acc.type === 'depository');
  const savingsAccounts = accounts.filter((acc: any) => acc.type === 'savings');
  
  const checkingBalance = checkingAccounts.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0);
  const savingsBalance = savingsAccounts.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0);

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

      {/* Top Widgets - Financial Health Score and Expenses by Category side by side */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2">
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

      {/* Dashboard Grid */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* Cash Flow Timeline */}
        <CashFlowTimelineWidget
          chartTransactions={chartTransactions}
          selectedMonthDate={selectedMonthDate}
        />

        {/* Cash on Hand */}
        <CashOnHandWidget
          totalBalance={totalBalance}
          checkingBalance={checkingBalance}
          savingsBalance={savingsBalance}
        />

        {/* 6. Budget Status */}
        <BudgetStatusWidget
          budgets={budgets}
        />

        {/* 7. Upcoming Bills */}
        <div className="lg:col-span-2">
          <UpcomingBillsWidget
            upcomingTransactions={upcomingTransactions}
          />
        </div>

        {/* 8. Emergency Fund */}
        <EmergencyFundWidget
          emergencyFundMonths={emergencyFundMonths}
          totalBalance={totalBalance}
          monthlyExpenses={monthlyExpenses}
        />

        {/* 9. Savings Goals */}
        <SavingsGoalsWidget
          goals={goals}
        />

        {/* 10. Net Worth Snapshot */}
        <NetWorthWidget
          netWorth={netWorth}
          totalAssets={totalAssets}
          totalDebts={totalDebts}
        />

        {/* 11. Investment Portfolio */}
        <InvestmentPortfolioWidget
          savings={savings}
        />

        {/* 12. Alerts & Insights - full width */}
        <div className="col-span-full">
          <AlertsInsightsWidget
            financialHealth={financialHealth}
            currentIncome={currentIncome}
            currentExpenses={currentExpenses}
            emergencyFundMonths={emergencyFundMonths}
            selectedMonthTransactions={selectedMonthTransactions}
            lastMonthTransactions={lastMonthTransactions}
          />
        </div>
      </div>
    </div>
  );
}

