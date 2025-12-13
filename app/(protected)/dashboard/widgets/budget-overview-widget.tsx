"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { cn } from "@/lib/utils";
import type { BudgetWithRelations } from "@/src/domain/budgets/budgets.types";
import { calculateBudgetStatus } from "@/lib/utils/budget-utils";

interface BudgetOverviewWidgetProps {
  budgets: BudgetWithRelations[];
}

export function BudgetOverviewWidget({
  budgets,
}: BudgetOverviewWidgetProps) {
  const router = useRouter();

  // Calculate budget statuses and sort by percentage (highest first)
  const budgetsWithStatus = useMemo(() => {
    return budgets
      .map(budget => {
        const actualSpend = budget.actualSpend || 0;
        const amount = budget.amount || 0;
        const { percentage, status } = calculateBudgetStatus(amount, actualSpend);
        return {
          ...budget,
          percentage,
          status,
          actualSpend,
          amount,
        };
      })
      .sort((a, b) => (b.percentage || 0) - (a.percentage || 0))
      .slice(0, 3); // Show top 3 budgets
  }, [budgets]);

  // Count budgets at risk (warning or over)
  const budgetsAtRisk = useMemo(() => {
    return budgetsWithStatus.filter(b => b.status === "warning" || b.status === "over").length;
  }, [budgetsWithStatus]);

  if (budgets.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>How your budgets are holding up</CardTitle>
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
        <CardTitle>How your budgets are holding up</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {budgetsWithStatus.map((budget) => {
            const percentage = budget.percentage || 0;
            const clampedPercentage = Math.min(percentage, 100);
            const displayName = budget.displayName || budget.category?.name || "Unknown";
            const status = budget.status || "ok";

            return (
              <div key={budget.id} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{displayName}</span>
                  <span className="text-sm text-foreground tabular-nums">
                    {formatMoney(budget.actualSpend)} / {formatMoney(budget.amount)}
                  </span>
                </div>
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      status === "over" ? "bg-sentiment-negative" :
                      status === "warning" ? "bg-sentiment-warning" :
                      "bg-primary"
                    )}
                    style={{ width: `${clampedPercentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 flex-wrap">
          {budgetsAtRisk > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground">
              {budgetsAtRisk} {budgetsAtRisk === 1 ? "budget" : "budgets"} at risk
            </span>
          )}
          <button
            onClick={() => router.push("/planning/budgets")}
            className="text-xs text-content-link hover:underline cursor-pointer"
          >
            Open budgets
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

