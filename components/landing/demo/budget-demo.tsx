"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/components/common/money";
import { cn } from "@/lib/utils";

export function BudgetDemo() {
  // Demo data
  const budget = {
    name: "Groceries",
    amount: 500,
    spent: 320,
    remaining: 180,
    percentage: 64, // 64% spent, 36% remaining
    status: "ok" as "ok" | "over" | "warning",
  };

  const getStatusColor = () => {
    if (budget.status === "over") return "bg-destructive";
    if (budget.status === "warning") return "bg-sentiment-warning";
    return "bg-sentiment-positive";
  };

  const getStatusTextColor = () => {
    if (budget.status === "over") return "text-destructive";
    if (budget.status === "warning") return "text-yellow-600";
    return "text-green-600";
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{budget.name}</CardTitle>
              <Badge className={cn(getStatusColor(), "text-white")} variant="default">
                On Track
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
              <p className="font-semibold text-base">{formatMoney(budget.spent)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Remaining</p>
              <p className={cn("font-semibold text-base", getStatusTextColor())}>
                {formatMoney(budget.remaining)}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className={cn("font-medium", getStatusTextColor())}>
                {budget.percentage.toFixed(1)}%
              </span>
            </div>
            <Progress value={budget.percentage} className="h-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

