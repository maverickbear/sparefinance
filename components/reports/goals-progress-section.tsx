"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { Progress } from "@/components/ui/progress";
import { Target, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GoalWithCalculations } from "@/lib/api/goals";

interface GoalsProgressSectionProps {
  goals: GoalWithCalculations[];
}

export function GoalsProgressSection({ goals }: GoalsProgressSectionProps) {
  if (goals.length === 0) {
    return null;
  }

  const activeGoals = goals.filter((g) => !g.isCompleted && !g.isPaused);
  const completedGoals = goals.filter((g) => g.isCompleted);
  const totalTargetAmount = activeGoals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalCurrentBalance = activeGoals.reduce((sum, g) => sum + g.currentBalance, 0);
  const totalMonthlyContribution = activeGoals.reduce((sum, g) => sum + g.monthlyContribution, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl flex items-center gap-2">
            <Target className="h-5 w-5" />
            Goals Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Active Goals</p>
              <p className="text-2xl font-bold">{activeGoals.length}</p>
              <p className="text-xs text-muted-foreground">
                {completedGoals.length} completed
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Target</p>
              <p className="text-2xl font-bold">{formatMoney(totalTargetAmount)}</p>
              <p className="text-xs text-muted-foreground">
                {formatMoney(totalCurrentBalance)} saved
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Monthly Contribution</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatMoney(totalMonthlyContribution)}
              </p>
              <p className="text-xs text-muted-foreground">across all goals</p>
            </div>
          </div>

          {/* Active Goals */}
          {activeGoals.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Active Goals</h3>
              <div className="space-y-3">
                {activeGoals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} />
                ))}
              </div>
            </div>
          )}

          {/* Completed Goals */}
          {completedGoals.length > 0 && (
            <div className="space-y-4 mt-6">
              <h3 className="text-sm font-semibold text-muted-foreground">Completed Goals</h3>
              <div className="space-y-3">
                {completedGoals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} isCompleted />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GoalCard({ goal, isCompleted = false }: { goal: GoalWithCalculations; isCompleted?: boolean }) {
  const progress = goal.targetAmount > 0
    ? Math.min((goal.currentBalance / goal.targetAmount) * 100, 100)
    : 0;

  return (
    <div className={cn("p-4 rounded-lg border", isCompleted && "opacity-60")}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{goal.name}</p>
            {isCompleted && (
              <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                Completed
              </span>
            )}
            {goal.isPaused && (
              <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300">
                Paused
              </span>
            )}
          </div>
          {goal.description && (
            <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
          )}
        </div>
        <div className="text-right">
          <p className="font-semibold">{formatMoney(goal.currentBalance)}</p>
          <p className="text-xs text-muted-foreground">
            of {formatMoney(goal.targetAmount)}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">{progress.toFixed(1)}%</span>
        </div>
        <Progress value={progress} className="h-2" />

        <div className="grid grid-cols-2 gap-4 pt-2 text-sm">
          <div>
            <p className="text-muted-foreground">Monthly Contribution</p>
            <p className="font-medium">{formatMoney(goal.monthlyContribution)}</p>
            {goal.incomePercentage > 0 && (
              <p className="text-xs text-muted-foreground">
                {goal.incomePercentage.toFixed(1)}% of income
              </p>
            )}
          </div>
          {goal.monthsToGoal !== null && !isCompleted && (
            <div>
              <p className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                ETA
              </p>
              <p className="font-medium">
                {goal.monthsToGoal === 0
                  ? "This month"
                  : goal.monthsToGoal === 1
                  ? "1 month"
                  : `${goal.monthsToGoal} months`}
              </p>
            </div>
          )}
        </div>

        {goal.priority && (
          <div className="pt-2 border-t text-xs">
            <span className="text-muted-foreground">Priority: </span>
            <span
              className={cn(
                "font-medium",
                goal.priority === "High"
                  ? "text-red-600 dark:text-red-400"
                  : goal.priority === "Medium"
                  ? "text-yellow-600 dark:text-yellow-400"
                  : "text-green-600 dark:text-green-400"
              )}
            >
              {goal.priority}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

