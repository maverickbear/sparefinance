"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProgressRing } from "@/components/goals/progress-ring";
import { formatMoney } from "@/components/common/money";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentBalance: number;
  incomePercentage: number;
  priority: "High" | "Medium" | "Low";
  isCompleted: boolean;
  progressPct?: number;
  monthsToGoal?: number | null;
}

interface GoalsOverviewProps {
  goals: Goal[];
}

export function GoalsOverview({ goals }: GoalsOverviewProps) {
  if (!goals || goals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Goals Overview</CardTitle>
          <CardDescription>Track your financial goals</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No goals yet</p>
            <Link href="/planning/budgets?tab=goals">
              <Button variant="outline" size="small">Create Your First Goal</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate statistics
  const activeGoals = goals.filter((g) => !g.isCompleted);
  const completedGoals = goals.filter((g) => g.isCompleted);

  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalBalance = goals.reduce((sum, g) => sum + g.currentBalance, 0);
  const overallProgress = totalTarget > 0 ? (totalBalance / totalTarget) * 100 : 0;

  const totalMonthlyContribution = activeGoals.reduce(
    (sum, g) => sum + (g.incomePercentage || 0),
    0
  );

  // Get top 3 goals by priority and progress
  const topGoals = [...goals]
    .filter((g) => !g.isCompleted)
    .sort((a, b) => {
      const priorityOrder = { High: 3, Medium: 2, Low: 1 };
      if (priorityOrder[b.priority] !== priorityOrder[a.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return (b.progressPct || 0) - (a.progressPct || 0);
    })
    .slice(0, 3);

  const priorityColors = {
    High: "bg-sentiment-negative hover:bg-sentiment-negative",
    Medium: "bg-sentiment-warning hover:bg-sentiment-warning",
    Low: "bg-interactive-primary hover:bg-interactive-primary",
  };

  return (
    <Card className="w-full max-w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Goals Overview</CardTitle>
            <CardDescription>Track your financial progress</CardDescription>
          </div>
          <Link href="/planning/budgets?tab=goals">
            <Button variant="ghost" size="small">
              View All
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Progress */}
        <div className="flex items-center gap-6">
          <div className="flex-shrink-0">
            <ProgressRing
              percentage={overallProgress}
              size={80}
              strokeWidth={8}
            />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Progress</span>
              <span className="text-sm font-semibold">{overallProgress.toFixed(1)}%</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Invested</span>
                <span className="font-medium">{formatMoney(totalBalance)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Target</span>
                <span className="font-medium">{formatMoney(totalTarget)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Goals */}
        {topGoals.length > 0 && (
          <div className="space-y-3 pt-2 border-t">
            <h4 className="text-sm font-medium text-muted-foreground">Top Goals</h4>
            <div className="space-y-3">
              {topGoals.map((goal) => (
                <Link
                  key={goal.id}
                  href="/planning/budgets?tab=goals"
                  className="block group"
                >
                  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-shrink-0">
                      <ProgressRing
                        percentage={goal.progressPct || 0}
                        size={48}
                        strokeWidth={6}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium truncate">{goal.name}</p>
                        <Badge
                          className={`${priorityColors[goal.priority]} text-white text-[10px] px-1.5 py-0`}
                        >
                          {goal.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {formatMoney(goal.currentBalance)} / {formatMoney(goal.targetAmount)}
                        </span>
                        {goal.monthsToGoal !== null && goal.monthsToGoal !== undefined && (
                          <span className="text-muted-foreground">
                            {goal.monthsToGoal > 0 ? (
                              <>
                                {goal.monthsToGoal >= 12
                                  ? `${Math.floor(goal.monthsToGoal / 12)}y `
                                  : ""}
                                {Math.round(goal.monthsToGoal % 12)}m
                              </>
                            ) : (
                              "Reached!"
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

