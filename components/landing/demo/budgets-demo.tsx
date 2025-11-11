"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/components/common/money";
import { cn } from "@/lib/utils";

// Mock data
const mockBudgets = [
  {
    id: "1",
    category: { name: "Food & Dining" },
    amount: 1000,
    actualSpend: 750,
    percentage: 75,
    status: "ok" as const,
    displayName: "Food & Dining",
  },
  {
    id: "2",
    category: { name: "Transportation" },
    amount: 500,
    actualSpend: 420,
    percentage: 84,
    status: "ok" as const,
    displayName: "Transportation",
  },
  {
    id: "3",
    category: { name: "Shopping" },
    amount: 800,
    actualSpend: 950,
    percentage: 118.75,
    status: "over" as const,
    displayName: "Shopping",
  },
  {
    id: "4",
    category: { name: "Entertainment" },
    amount: 600,
    actualSpend: 540,
    percentage: 90,
    status: "warning" as const,
    displayName: "Entertainment",
  },
];

export function BudgetsDemo() {
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

  const getStatusLabel = (status: string) => {
    if (status === "over") return "Over Budget";
    if (status === "warning") return "Warning";
    return "On Track";
  };

  return (
    <div className="space-y-4 pointer-events-none">
        {mockBudgets.map((budget) => {
          const clampedPercentage = Math.min(budget.percentage || 0, 100);
          const actualSpend = budget.actualSpend || 0;
          const remaining = Math.max(0, budget.amount - actualSpend);

          return (
            <Card key={budget.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">
                        {budget.displayName || budget.category?.name || "Unknown"}
                      </CardTitle>
                      <Badge className={cn(getStatusColor(budget.status), "text-white")} variant="default">
                        {getStatusLabel(budget.status)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Budget</p>
                      <p className="font-semibold text-base">{formatMoney(budget.amount)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Spent</p>
                      <p className="font-semibold text-base">{formatMoney(actualSpend)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Remaining</p>
                      <p className={cn("font-semibold text-base", getStatusTextColor(budget.status))}>
                        {formatMoney(remaining)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className={cn("font-medium", getStatusTextColor(budget.status))}>
                        {budget.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full transition-all",
                          getStatusColor(budget.status)
                        )}
                        style={{ width: `${clampedPercentage}%` }}
                      />
                    </div>
                  </div>

                  {budget.status === "over" && (
                    <div className="text-xs text-destructive">
                      You've exceeded your budget by {formatMoney(actualSpend - budget.amount)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
}

