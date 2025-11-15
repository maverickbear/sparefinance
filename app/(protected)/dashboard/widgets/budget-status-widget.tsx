"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/components/common/money";

interface BudgetStatusWidgetProps {
  budgets: any[];
}

export function BudgetStatusWidget({
  budgets,
}: BudgetStatusWidgetProps) {
  // Sort budgets by percentage (highest first) to show most critical at top
  const sortedBudgets = useMemo(() => {
    return [...budgets].sort((a, b) => {
      const pctA = a.percentage || 0;
      const pctB = b.percentage || 0;
      return pctB - pctA;
    });
  }, [budgets]);

  const getStatusColor = (status: string) => {
    if (status === "over") return "bg-destructive";
    if (status === "warning") return "bg-yellow-500 dark:bg-yellow-600";
    return "bg-green-500 dark:bg-green-600";
  };

  const getStatusTextColor = (status: string) => {
    if (status === "over") return "text-destructive";
    if (status === "warning") return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  if (budgets.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Budget Status</CardTitle>
          <CardDescription>Used vs remaining in your budgets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">No budgets set for this period</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Budget Status</CardTitle>
        <CardDescription>Used vs remaining in your budgets</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedBudgets.map((budget) => {
            const percentage = budget.percentage || 0;
            const clampedPercentage = Math.min(percentage, 100);
            const displayName = budget.displayName || budget.category?.name || budget.macro?.name || "Unknown";
            const status = budget.status || "ok";
            const actualSpend = budget.actualSpend || 0;
            const amount = budget.amount || 0;

            return (
              <div key={budget.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground truncate pr-2">
                    {displayName}
                  </span>
                  <span className={cn(
                    "text-sm font-semibold tabular-nums flex-shrink-0",
                    getStatusTextColor(status)
                  )}>
                    {percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>
                    {formatMoney(actualSpend)} / {formatMoney(amount)}
                  </span>
                  <span>
                    {formatMoney(Math.max(0, amount - actualSpend))} remaining
                  </span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full transition-all",
                      getStatusColor(status)
                    )}
                    style={{ width: `${clampedPercentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

