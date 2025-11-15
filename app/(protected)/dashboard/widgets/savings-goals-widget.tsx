"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";

interface SavingsGoalsWidgetProps {
  goals: any[];
}

export function SavingsGoalsWidget({
  goals,
}: SavingsGoalsWidgetProps) {
  // Filter for savings goals (type === 'savings' or similar)
  const savingsGoals = goals
    .filter((g) => g.type === "savings" || !g.type) // Include goals without type or with type 'savings'
    .slice(0, 3);

  if (savingsGoals.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Savings Goals</CardTitle>
          <CardDescription>Progress towards what matters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No savings goals yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Savings Goals</CardTitle>
        <CardDescription>Progress towards what matters</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {savingsGoals.map((goal) => {
            const targetAmount = goal.targetAmount || 0;
            const currentAmount = goal.currentAmount || goal.savedAmount || 0;
            const percentage = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;

            return (
              <div key={goal.id} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">{goal.name || "Goal"}</span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {percentage.toFixed(0)}%
                  </span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100} aria-label={`${goal.name}: ${percentage.toFixed(0)}% complete`}>
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min(percentage, 100)}%` }}
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

