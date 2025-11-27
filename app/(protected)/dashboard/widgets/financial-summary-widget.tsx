"use client";

import { Card } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { ArrowUp, ArrowDown } from "lucide-react";
import { AnimatedNumber } from "@/components/common/animated-number";

interface FinancialSummaryWidgetProps {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  totalSavings: number;
  lastMonthIncome?: number;
  lastMonthExpense?: number;
}

export function FinancialSummaryWidget({
  totalBalance,
  monthlyIncome,
  monthlyExpense,
  totalSavings,
  lastMonthIncome = 0,
  lastMonthExpense = 0,
}: FinancialSummaryWidgetProps) {
  // Calculate percentage change vs last month
  const incomeChangePercent = lastMonthIncome > 0 
    ? ((monthlyIncome - lastMonthIncome) / lastMonthIncome) * 100 
    : 0;
  
  const expenseChangePercent = lastMonthExpense > 0 
    ? ((monthlyExpense - lastMonthExpense) / lastMonthExpense) * 100 
    : 0;

  const formatPercentChange = (percent: number) => {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(1)}%`;
  };
  
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {/* Total Balance Card */}
      <Card className="p-4 md:p-6">
        <div className="text-xs text-muted-foreground mb-1">Total Balance</div>
        <div className="text-lg md:text-xl font-semibold tabular-nums">
          <AnimatedNumber value={totalBalance} format="money" />
        </div>
      </Card>

      {/* Monthly Income Card */}
      <Card className="p-4 md:p-6">
        <div className="text-xs text-muted-foreground mb-1">Monthly Income</div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-lg md:text-xl font-semibold tabular-nums text-green-600 dark:text-green-400">
            <ArrowUp className="h-4 w-4 md:h-5 md:w-5" />
            <AnimatedNumber value={monthlyIncome} format="money" />
          </div>
          {lastMonthIncome > 0 && (
            <div className="text-xs text-muted-foreground">
              {formatPercentChange(incomeChangePercent)} vs last month
            </div>
          )}
        </div>
      </Card>

      {/* Monthly Expense Card */}
      <Card className="p-4 md:p-6">
        <div className="text-xs text-muted-foreground mb-1">Monthly Expense</div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-lg md:text-xl font-semibold tabular-nums text-red-600 dark:text-red-400">
            <ArrowDown className="h-4 w-4 md:h-5 md:w-5" />
            <AnimatedNumber value={monthlyExpense} format="money" />
          </div>
          {lastMonthExpense > 0 && (
            <div className="text-xs text-muted-foreground">
              {formatPercentChange(expenseChangePercent)} vs last month
            </div>
          )}
        </div>
      </Card>

      {/* Total Savings Card */}
      <Card className="p-4 md:p-6">
        <div className="text-xs text-muted-foreground mb-1">Total Savings</div>
        <div className="text-lg md:text-xl font-semibold tabular-nums">
          <AnimatedNumber value={totalSavings} format="money" />
        </div>
      </Card>
    </div>
  );
}

