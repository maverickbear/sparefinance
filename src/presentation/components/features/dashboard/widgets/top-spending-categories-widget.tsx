"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, ArrowRight, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/components/common/money";
import type { TopSpendingCategoriesWidgetData } from "@/src/domain/dashboard/types";
import { WidgetEmptyState } from "./widget-empty-state";
import { WidgetCard } from "./widget-card";

interface TopSpendingCategoriesWidgetProps {
  data: TopSpendingCategoriesWidgetData | null;
  loading?: boolean;
  error?: string | null;
}

export function TopSpendingCategoriesWidget({ data, loading, error }: TopSpendingCategoriesWidgetProps) {
  const router = useRouter();

  if (loading) {
    return (
      <WidgetCard title="Top Categories">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded" />
          <div className="h-4 bg-muted rounded" />
        </div>
      </WidgetCard>
    );
  }

  if (error) {
    return (
      <WidgetCard title="Top Categories">
        <div className="text-xs text-muted-foreground">
          <p>Error: {error}</p>
          <Button asChild variant="outline" size="small" className="mt-3">
            <a href="/transactions/new">Add Transaction</a>
          </Button>
        </div>
      </WidgetCard>
    );
  }

  if (!data || data.categories.length === 0) {
    return (
      <WidgetCard title="Top Categories">
        <WidgetEmptyState
          title="Add expenses"
          description="See where your money goes"
          primaryAction={{
            label: "Add Expense",
            href: "/transactions/new?type=expense",
          }}
          icon={PieChart}
        />
      </WidgetCard>
    );
  }

  const maxAmount = Math.max(...data.categories.map(c => c.amount));

  return (
    <WidgetCard title="Top Categories">
      <div className="flex-1 flex flex-col justify-between">
        <div className="space-y-1.5">
          {data.categories.map((category) => {
            const barWidth = maxAmount > 0 ? (category.amount / maxAmount) * 100 : 0;
            const deltaIsPositive = category.delta > 0;

            return (
              <div
                key={category.categoryId}
                onClick={() => router.push(`/transactions?category=${category.categoryId}`)}
                className="p-2 rounded border hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium truncate flex-1">{category.categoryName}</span>
                  <div className="flex items-center gap-1.5 ml-2">
                    <span className="text-xs">{formatMoney(category.amount)}</span>
                    {category.delta !== 0 && (
                      <div className="flex items-center gap-0.5">
                        {deltaIsPositive ? (
                          <TrendingUp className="h-3 w-3 text-sentiment-negative" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-sentiment-positive" />
                        )}
                        <span className={cn(
                          "text-xs font-medium",
                          deltaIsPositive ? "text-sentiment-negative" : "text-sentiment-positive"
                        )}>
                          {deltaIsPositive ? '+' : ''}{category.deltaPercentage.toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Primary Action */}
        {data.actions.length > 0 && (
          <Button
            asChild
            variant="ghost"
            size="small"
            className="w-full mt-auto text-xs"
          >
            <a href={data.actions[0].href}>
              {data.actions[0].label}
              <ArrowRight className="h-3 w-3 ml-1.5" />
            </a>
          </Button>
        )}
      </div>
    </WidgetCard>
  );
}
