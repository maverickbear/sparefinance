"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatMoney } from "@/components/common/money";
import { cn } from "@/lib/utils";
import {
  MoreVertical,
  Edit,
  Trash2,
} from "lucide-react";

export interface BudgetCardProps {
  budget: {
    id: string;
    amount: number;
    note?: string | null;
    period: string;
    categoryId?: string | null;
    subcategoryId?: string | null;
    macroId?: string | null;
    category: {
      id: string;
      name: string;
    } | null;
    subcategory?: {
      id: string;
      name: string;
    } | null;
    actualSpend?: number;
    percentage?: number;
    status?: "ok" | "warning" | "over";
    displayName?: string;
    macro?: {
      id: string;
      name: string;
    } | null;
    budgetCategories?: Array<{
      category: {
        id: string;
        name: string;
      };
    }>;
  };
  onEdit: (budget: BudgetCardProps["budget"]) => void;
  onDelete: (id: string) => void;
  deletingId?: string | null;
}

export function BudgetCard({
  budget,
  onEdit,
  onDelete,
  deletingId,
}: BudgetCardProps) {
  const getStatusColor = () => {
    if (budget.status === "over") return "bg-destructive";
    if (budget.status === "warning") return "bg-sentiment-warning";
    return "bg-sentiment-positive";
  };

  const getStatusTextColor = () => {
    if (budget.status === "over") return "text-destructive";
    if (budget.status === "warning") return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  const getStatusLabel = () => {
    if (budget.status === "over") return "Over Budget";
    if (budget.status === "warning") return "Warning";
    return "On Track";
  };

  const percentage = budget.percentage || 0;
  const clampedPercentage = Math.min(percentage, 100);
  const actualSpend = budget.actualSpend || 0;
  const remaining = Math.max(0, budget.amount - actualSpend);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">
                {budget.displayName || budget.category?.name || "Unknown"}
              </CardTitle>
              <Badge className={cn(getStatusColor(), "text-white")} variant="default">
                {getStatusLabel()}
              </Badge>
            </div>
            {budget.macro && (
              <p className="text-xs text-muted-foreground mt-1">
                Group: {budget.macro.name}
              </p>
            )}
            {budget.subcategory && (
              <p className="text-xs text-muted-foreground mt-1">
                {budget.subcategory.name}
              </p>
            )}
            {budget.budgetCategories && budget.budgetCategories.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Categories: {budget.budgetCategories.map(bc => bc.category.name).join(", ")}
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
              <DropdownMenuItem onClick={() => onEdit(budget)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(budget.id)}
                className="text-destructive focus:text-destructive"
                disabled={deletingId === budget.id}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
              <p className={cn("font-semibold text-base", getStatusTextColor())}>
                {formatMoney(remaining)}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className={cn("font-medium", getStatusTextColor())}>
                {percentage.toFixed(1)}%
              </span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full transition-all",
                  getStatusColor()
                )}
                style={{ width: `${clampedPercentage}%` }}
              />
              {percentage > 100 && (
                <div
                  className={cn(
                    "absolute top-0 h-full transition-all opacity-30",
                    getStatusColor()
                  )}
                  style={{
                    width: `${((percentage - 100) / percentage) * 100}%`,
                    left: "100%",
                  }}
                />
              )}
              {/* 100% marker */}
              <div className="absolute top-0 left-0 h-full w-[1px] bg-border" style={{ left: "100%" }} />
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
}

