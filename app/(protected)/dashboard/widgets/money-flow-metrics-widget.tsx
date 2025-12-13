"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { cn } from "@/lib/utils";

interface MoneyFlowMetricsWidgetProps {
  monthlyIncome: number;
  expectedIncome?: number; // Expected monthly income
  incomeChangePercent?: number; // vs last month
  monthlyExpenses: number;
  budgetedExpenses?: number; // Total budgeted amount
  expensesChangePercent?: number; // vs last month or vs budget
  monthlySavings: number;
  savingsGoal?: number; // Target savings amount
  savingsChangeText?: string; // e.g., "Better than last month"
}

export function MoneyFlowMetricsWidget({
  monthlyIncome,
  expectedIncome,
  incomeChangePercent,
  monthlyExpenses,
  budgetedExpenses,
  expensesChangePercent,
  monthlySavings,
  savingsGoal,
  savingsChangeText,
}: MoneyFlowMetricsWidgetProps) {
  // Calculate progress percentages
  const incomeProgress = expectedIncome && expectedIncome > 0 
    ? Math.min((monthlyIncome / expectedIncome) * 100, 100) 
    : 0;
  
  const expensesProgress = budgetedExpenses && budgetedExpenses > 0
    ? Math.min((monthlyExpenses / budgetedExpenses) * 100, 100)
    : 0;
  
  const savingsProgress = savingsGoal && savingsGoal > 0
    ? Math.min((monthlySavings / savingsGoal) * 100, 100)
    : 0;

  const formatPercentChange = (percent?: number) => {
    if (percent === undefined || percent === null) return null;
    const sign = percent >= 0 ? "+" : "";
    return `${sign}${percent.toFixed(0)}%`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Monthly Income */}
      <Card>
        <CardContent className="p-5">
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Monthly income</div>
            <div className="text-xl font-semibold tabular-nums text-foreground">
              {formatMoney(monthlyIncome)}
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(incomeProgress, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{expectedIncome ? `Expected: ${formatMoney(expectedIncome)}` : "No target set"}</span>
              {incomeChangePercent !== undefined && incomeChangePercent !== null && (
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border",
                  incomeChangePercent >= 0
                    ? "bg-sentiment-positive/10 text-sentiment-positive border-sentiment-positive/20"
                    : "bg-sentiment-negative/10 text-sentiment-negative border-sentiment-negative/20"
                )}>
                  <span>▲</span>
                  <span>{formatPercentChange(incomeChangePercent)} vs last month</span>
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Expenses */}
      <Card>
        <CardContent className="p-5">
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Monthly expenses</div>
            <div className="text-xl font-semibold tabular-nums text-foreground">
              {formatMoney(monthlyExpenses)}
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  expensesProgress >= 100 ? "bg-sentiment-negative" : "bg-primary"
                )}
                style={{ width: `${Math.min(expensesProgress, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{budgetedExpenses ? `Budgeted: ${formatMoney(budgetedExpenses)}` : "No budget set"}</span>
              {expensesChangePercent !== undefined && expensesChangePercent !== null && (
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border",
                  expensesChangePercent >= 0
                    ? "bg-sentiment-negative/10 text-sentiment-negative border-sentiment-negative/20"
                    : "bg-sentiment-positive/10 text-sentiment-positive border-sentiment-positive/20"
                )}>
                  <span>▲</span>
                  <span>{Math.abs(expensesChangePercent)}% {expensesChangePercent >= 0 ? "higher" : "lower"} than usual</span>
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Savings */}
      <Card>
        <CardContent className="p-5">
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Monthly savings</div>
            <div className="text-xl font-semibold tabular-nums text-foreground">
              {formatMoney(monthlySavings)}
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(savingsProgress, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{savingsGoal ? `Goal: ${formatMoney(savingsGoal)}` : "No goal set"}</span>
              {savingsChangeText && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border bg-sentiment-positive/10 text-sentiment-positive border-sentiment-positive/20">
                  <span>▲</span>
                  <span>{savingsChangeText}</span>
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

