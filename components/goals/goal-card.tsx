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
import { ProgressRing } from "./progress-ring";
import { ETAIndicator } from "./eta-indicator";
import { formatMoney } from "@/components/common/money";
import {
  MoreVertical,
  Edit,
  Trash2,
  Pause,
  Play,
  Plus,
  Minus,
} from "lucide-react";

export interface GoalCardProps {
  goal: {
    id: string;
    name: string;
    targetAmount: number;
    currentBalance: number;
    incomePercentage: number;
    priority: "High" | "Medium" | "Low";
    isPaused: boolean;
    isCompleted: boolean;
    description?: string | null;
    expectedIncome?: number | null;
    targetMonths?: number | null;
    monthlyContribution?: number;
    monthsToGoal?: number | null;
    progressPct?: number;
    incomeBasis?: number;
  };
  onEdit: (goal: GoalCardProps["goal"]) => void;
  onDelete: (id: string) => void;
  onPause: (id: string, isPaused: boolean) => void;
  onTopUp: (id: string) => void;
  onWithdraw: (id: string) => void;
}

export function GoalCard({
  goal,
  onEdit,
  onDelete,
  onPause,
  onTopUp,
  onWithdraw,
}: GoalCardProps) {
  const priorityColors = {
    High: "bg-red-500 dark:bg-red-600 text-white",
    Medium: "bg-yellow-500 dark:bg-yellow-600 text-white",
    Low: "bg-blue-500 dark:bg-blue-600 text-white",
  };

  return (
    <Card className={goal.isCompleted ? "opacity-75" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{goal.name}</CardTitle>
              {goal.isCompleted && (
                <Badge variant="default" className="bg-green-600 dark:bg-green-500">
                  Completed
                </Badge>
              )}
              {goal.isPaused && (
                <Badge variant="outline" className="border-yellow-500 dark:border-yellow-400 text-yellow-600 dark:text-yellow-400">
                  Paused
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
            {goal.description && (
              <p className="mt-2 text-sm text-muted-foreground">
                {goal.description}
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
              <DropdownMenuItem
                onClick={() => onPause(goal.id, !goal.isPaused)}
              >
                {goal.isPaused ? (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onTopUp(goal.id)}>
                <Plus className="mr-2 h-4 w-4" />
                Top-up
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onWithdraw(goal.id)}>
                <Minus className="mr-2 h-4 w-4" />
                Withdraw
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(goal.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center">
          <ProgressRing
            percentage={goal.progressPct || 0}
            size={120}
            strokeWidth={10}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Current</p>
            <p className="font-semibold">{formatMoney(goal.currentBalance)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Target</p>
            <p className="font-semibold">{formatMoney(goal.targetAmount)}</p>
          </div>
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
      </CardContent>
    </Card>
  );
}

