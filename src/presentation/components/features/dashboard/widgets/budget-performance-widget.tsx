"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Target, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/components/common/money";
import type { BudgetPerformanceWidgetData } from "@/src/domain/dashboard/types";
import { WidgetEmptyState } from "./widget-empty-state";
import { WidgetCard } from "./widget-card";

interface BudgetPerformanceWidgetProps {
  data: BudgetPerformanceWidgetData | null;
  loading?: boolean;
  error?: string | null;
}

export function BudgetPerformanceWidget({ data, loading, error }: BudgetPerformanceWidgetProps) {
  const router = useRouter();

  if (loading) {
    return (
      <WidgetCard title="Budget Performance">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded" />
          <div className="h-4 bg-muted rounded" />
        </div>
      </WidgetCard>
    );
  }

  if (error) {
    return (
      <WidgetCard title="Budget Performance">
        <div className="text-xs text-muted-foreground">
          <p>Error: {error}</p>
          <Button asChild variant="outline" size="small" className="mt-3">
            <Link href="/budgets/new">Create Budget</Link>
          </Button>
        </div>
      </WidgetCard>
    );
  }

  if (!data || data.categories.length === 0) {
    return (
      <WidgetCard title="Budget Performance">
        <WidgetEmptyState
          title="Create budgets"
          description="Track your spending by category"
          primaryAction={{
            label: "Create Budget",
            href: "/budgets/new",
          }}
          icon={Target}
        />
      </WidgetCard>
    );
  }

  const overspendingCategories = data.categories.filter(c => c.isOverspending);
  const topOverspending = overspendingCategories.slice(0, 3);

  return (
    <WidgetCard title="Budget Performance">
      <div className="flex-1 flex flex-col justify-between">
        <div className="space-y-2.5">
          {/* Summary - Compact */}
          <div className="flex items-center justify-between p-2 rounded border bg-muted/30">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Spent</span>
              <span className={cn(
                "text-sm",
                data.totalDifference > 0 ? "text-sentiment-negative" : "text-sentiment-positive"
              )}>
                {formatMoney(data.totalActual)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">of {formatMoney(data.totalBudgeted)}</span>
          </div>

          {/* Categories - Compact List */}
          <div className="space-y-1.5">
            {data.categories.slice(0, 4).map((category) => (
              <div
                key={category.categoryId}
                onClick={() => router.push(`/transactions?category=${category.categoryId}`)}
                className="p-2 rounded border hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium truncate flex-1">{category.categoryName}</span>
                  {category.isOverspending && (
                    <AlertTriangle className="h-3 w-3 text-sentiment-negative ml-1 flex-shrink-0" />
                  )}
                </div>
                <Progress
                  value={Math.min(100, category.percentage)}
                  className={cn(
                    "h-1.5",
                    category.isOverspending && "bg-sentiment-negative/20"
                  )}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-0.5">
                  <span>{category.percentage.toFixed(0)}%</span>
                  {category.isOverspending && (
                    <span className="text-sentiment-negative">
                      +{formatMoney(category.difference)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Primary Action */}
        {data.actions.length > 0 && (
          <Button
            asChild
            variant="ghost"
            size="small"
            className="w-full mt-auto text-xs"
          >
            <Link href={data.actions[0].href}>
              {data.actions[0].label}
              <ArrowRight className="h-3 w-3 ml-1.5" />
            </Link>
          </Button>
        )}
      </div>
    </WidgetCard>
  );
}
