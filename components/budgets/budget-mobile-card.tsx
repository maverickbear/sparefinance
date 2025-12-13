"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { formatMoney } from "@/components/common/money";
import { cn } from "@/lib/utils";
import { Edit, Trash2, Loader2 } from "lucide-react";
import {
  calculateBudgetStatus,
  getBudgetStatusColor,
  getBudgetStatusTextColor,
  getBudgetStatusLabel,
} from "@/lib/utils/budget-utils";

interface BudgetMobileCardProps {
  budget: {
    id: string;
    amount: number;
    note?: string | null;
    period: string;
    categoryId?: string | null;
    subcategoryId?: string | null;
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
    budgetCategories?: Array<{
      category: {
        id: string;
        name: string;
      };
    }>;
  };
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}

export function BudgetMobileCard({
  budget,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  deleting,
}: BudgetMobileCardProps) {
  // SIMPLIFIED: Calculate status and percentage in frontend
  const actualSpend = budget.actualSpend || 0;
  const { percentage, status } = calculateBudgetStatus(budget.amount, actualSpend);
  
  const clampedPercentage = Math.min(percentage, 100);
  const remaining = Math.max(0, budget.amount - actualSpend);

  return (
    <Card className={cn("transition-colors", isSelected && "ring-2 ring-primary")}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
            className="mt-1 h-4 w-4"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">
                  {budget.displayName || budget.category?.name || "Unknown"}
                </h3>
                {budget.subcategory && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {budget.subcategory.name}
                  </p>
                )}
              </div>
              <Badge className={cn(getBudgetStatusColor(status), "text-white text-xs")} variant="default">
                {getBudgetStatusLabel(status)}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Budget</p>
                <p className="font-semibold text-sm">{formatMoney(budget.amount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Spent</p>
                <p className="font-semibold text-sm">{formatMoney(actualSpend)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Remaining</p>
                <p className={cn("font-semibold text-sm", getBudgetStatusTextColor(status))}>
                  {formatMoney(remaining)}
                </p>
              </div>
            </div>

            <div className="space-y-1 mb-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className={cn("font-medium", getBudgetStatusTextColor(status))}>
                  {percentage.toFixed(1)}%
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full transition-all",
                    getBudgetStatusColor(status)
                  )}
                  style={{ width: `${clampedPercentage}%` }}
                />
                {percentage > 100 && (
                  <div
                    className={cn(
                      "absolute top-0 h-full transition-all opacity-30",
                      getBudgetStatusColor(status)
                    )}
                    style={{
                      width: `${((percentage - 100) / percentage) * 100}%`,
                      left: "100%",
                    }}
                  />
                )}
                <div className="absolute top-0 left-0 h-full w-[1px] bg-border" style={{ left: "100%" }} />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onEdit}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

