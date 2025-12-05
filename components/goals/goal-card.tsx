"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { ETAIndicator } from "./eta-indicator";
import { formatMoney } from "@/components/common/money";
import {
  MoreVertical,
  Edit,
  Trash2,
  Plus,
  Minus,
  Lock,
} from "lucide-react";

export interface GoalCardProps {
  goal: {
    id: string;
    name: string;
    targetAmount: number;
    currentBalance: number;
    incomePercentage: number;
    priority: "High" | "Medium" | "Low";
    isCompleted: boolean;
    description?: string | null;
    expectedIncome?: number | null;
    targetMonths?: number | null;
    monthlyContribution?: number;
    monthsToGoal?: number | null;
    progressPct?: number;
    incomeBasis?: number;
    isSystemGoal?: boolean;
  };
  onEdit: (goal: GoalCardProps["goal"]) => void;
  onDelete: (id: string) => void;
  onTopUp: (id: string) => void;
  onWithdraw: (id: string) => void;
}

export function GoalCard({
  goal,
  onEdit,
  onDelete,
  onTopUp,
  onWithdraw,
}: GoalCardProps) {
  const priorityColors = {
    High: "bg-sentiment-negative dark:bg-sentiment-negative text-white hover:bg-sentiment-negative dark:hover:bg-sentiment-negative",
    Medium: "bg-sentiment-warning dark:bg-sentiment-warning text-white hover:bg-sentiment-warning dark:hover:bg-sentiment-warning",
    Low: "bg-interactive-primary dark:bg-interactive-primary text-white hover:bg-interactive-primary dark:hover:bg-interactive-primary",
  };

  return (
    <Card className={goal.isCompleted ? "opacity-75" : ""}>
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
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <Badge className={priorityColors[goal.priority]} variant="default">
                {goal.priority}
              </Badge>
              {goal.isSystemGoal && (
                <Badge variant="outline" className="text-xs">
                  <Lock className="mr-1 h-3 w-3" />
                  System Goal
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {goal.incomePercentage.toFixed(1)}% allocation
              </span>
            </div>
            {goal.description && (
              <p className="mt-2 text-sm text-muted-foreground">
                {goal.description}
              </p>
            )}
            {goal.isSystemGoal && (
              <p className="mt-2 text-xs text-muted-foreground italic">
                This is a system goal and cannot be removed. You can edit it to customize your emergency fund target.
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(goal)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onTopUp(goal.id)}>
                <Plus className="mr-2 h-4 w-4" />
                Top-up
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onWithdraw(goal.id)}>
                <Minus className="mr-2 h-4 w-4" />
                Withdraw
              </DropdownMenuItem>
              {goal.isSystemGoal !== true && (
                <DropdownMenuItem
                  onClick={() => onDelete(goal.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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

          {/* Progress bar after the numbers */}
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
  );
}

