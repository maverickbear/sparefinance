"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoney, formatMoneyCompact } from "@/components/common/money";
import { cn } from "@/lib/utils";

interface IncomeVsExpensesWidgetProps {
  income: number;
  expenses: number;
}

export function IncomeVsExpensesWidget({
  income,
  expenses,
}: IncomeVsExpensesWidgetProps) {
  const netResult = income - expenses;
  const isSurplus = netResult >= 0;
  
  // Calculate bar heights (max height is 100%)
  const maxValue = Math.max(income, expenses);
  const incomeHeight = maxValue > 0 ? (income / maxValue) * 100 : 0;
  const expensesHeight = maxValue > 0 ? (expenses / maxValue) * 100 : 0;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Income vs Expenses</CardTitle>
        <CardDescription>Result so far this month</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Net Result */}
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <span className="text-sm text-muted-foreground">Net result</span>
            <span className={cn(
              "text-lg font-bold",
              isSurplus ? "text-green-500" : "text-red-500"
            )}>
              {isSurplus ? "+" : ""}{formatMoneyCompact(Math.abs(netResult))} {isSurplus ? "surplus" : "deficit"}
            </span>
          </div>

          {/* Bar Chart */}
          <div className="flex items-end justify-around gap-4 h-40">
            {/* Income Bar */}
            <div className="flex flex-col items-center flex-1 max-w-[80px]">
              <div
                className={cn(
                  "w-full max-w-[48px] rounded-t-md transition-all hover:opacity-80",
                  "bg-gradient-to-t from-green-600 to-green-500"
                )}
                style={{ height: `${incomeHeight}%` }}
                role="img"
                aria-label={`Income: ${formatMoneyCompact(income)}`}
              />
              <div className="mt-2 text-center">
                <div className="text-xs text-muted-foreground mb-1">Income</div>
                <div className="text-sm font-semibold text-foreground tabular-nums">
                  {formatMoneyCompact(income)}
                </div>
              </div>
            </div>

            {/* Expenses Bar */}
            <div className="flex flex-col items-center flex-1 max-w-[80px]">
              <div
                className={cn(
                  "w-full max-w-[48px] rounded-t-md transition-all hover:opacity-80",
                  "bg-gradient-to-t from-gray-600 to-gray-500"
                )}
                style={{ height: `${expensesHeight}%` }}
                role="img"
                aria-label={`Expenses: ${formatMoneyCompact(expenses)}`}
              />
              <div className="mt-2 text-center">
                <div className="text-xs text-muted-foreground mb-1">Expenses</div>
                <div className="text-sm font-semibold text-foreground tabular-nums">
                  {formatMoneyCompact(expenses)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

