"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ETAIndicator } from "@/components/goals/eta-indicator";
import { formatMoney } from "@/components/common/money";

// Mock data
const mockGoals = [
  {
    id: "1",
    name: "Emergency Fund",
    targetAmount: 10000,
    currentBalance: 6500,
    incomePercentage: 20,
    priority: "High" as const,
    isCompleted: false,
    progressPct: 65,
    monthsToGoal: 8,
    monthlyContribution: 500,
    incomeBasis: 5000,
  },
  {
    id: "2",
    name: "Vacation",
    targetAmount: 5000,
    currentBalance: 2500,
    incomePercentage: 10,
    priority: "Medium" as const,
    isCompleted: false,
    progressPct: 50,
    monthsToGoal: 5,
    monthlyContribution: 500,
    incomeBasis: 5000,
  },
  {
    id: "3",
    name: "New Car",
    targetAmount: 30000,
    currentBalance: 12000,
    incomePercentage: 15,
    priority: "High" as const,
    isCompleted: false,
    progressPct: 40,
    monthsToGoal: 12,
    monthlyContribution: 750,
    incomeBasis: 5000,
  },
];

export function GoalsDemo() {
  const priorityColors = {
    High: "bg-sentiment-negative dark:bg-sentiment-negative text-white hover:bg-sentiment-negative dark:hover:bg-sentiment-negative",
    Medium: "bg-sentiment-warning dark:bg-sentiment-warning text-white hover:bg-sentiment-warning dark:hover:bg-sentiment-warning",
    Low: "bg-interactive-primary dark:bg-interactive-primary text-white hover:bg-interactive-primary dark:hover:bg-interactive-primary",
  };

  return (
    <div className="space-y-4 pointer-events-none">
        {mockGoals.map((goal) => (
          <Card key={goal.id} className={goal.isCompleted ? "opacity-75" : ""}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{goal.name}</CardTitle>
                    {goal.isCompleted && (
                      <Badge variant="default" className="bg-sentiment-positive dark:bg-sentiment-positive">
                        Completed
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge className={priorityColors[goal.priority]} variant="default">
                      {goal.priority}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {goal.incomePercentage.toFixed(1)}% allocation
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Current</p>
                    <p className="font-semibold text-base">{formatMoney(goal.currentBalance)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Target</p>
                    <p className="font-semibold text-base">{formatMoney(goal.targetAmount)}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{goal.progressPct?.toFixed(1) || 0}%</span>
                  </div>
                  <Progress value={goal.progressPct || 0} className="h-2" />
                </div>

                {goal.monthlyContribution !== undefined && goal.monthlyContribution > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Monthly Contribution</p>
                    <p className="text-sm font-medium">
                      {formatMoney(goal.monthlyContribution)}
                    </p>
                  </div>
                )}

                {goal.incomeBasis !== undefined && (
                  <ETAIndicator
                    monthsToGoal={goal.monthsToGoal ?? null}
                    incomeBasis={goal.incomeBasis}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
