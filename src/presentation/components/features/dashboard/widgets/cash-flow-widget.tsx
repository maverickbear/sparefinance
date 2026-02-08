"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, ArrowRight, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/components/common/money";
import type { CashFlowWidgetData } from "@/src/domain/dashboard/types";
import { WidgetEmptyState } from "./widget-empty-state";
import { WidgetCard } from "./widget-card";

interface CashFlowWidgetProps {
  data: CashFlowWidgetData | null;
  loading?: boolean;
  error?: string | null;
}

export function CashFlowWidget({ data, loading, error }: CashFlowWidgetProps) {
  if (loading) {
    return (
      <WidgetCard title="Cash Flow" compact>
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-muted rounded w-32" />
          <div className="h-4 bg-muted rounded w-24" />
        </div>
      </WidgetCard>
    );
  }

  if (error) {
    return (
      <WidgetCard title="Cash Flow" compact>
        <div className="text-xs text-muted-foreground">
          <p>Error: {error}</p>
          <Button asChild variant="outline" size="small" className="mt-3">
            <Link href="/transactions/new">Add Transaction</Link>
          </Button>
        </div>
      </WidgetCard>
    );
  }

  if (!data) {
    return (
      <WidgetCard title="Cash Flow" compact>
        <WidgetEmptyState
          title="Add transactions"
          description="See income vs expenses"
          primaryAction={{
            label: "Add Transaction",
            href: "/transactions/new",
          }}
          icon={ArrowUpDown}
        />
      </WidgetCard>
    );
  }

  const isPositive = data.net >= 0;
  const incomeBarWidth = data.income > 0 && (data.income + data.expenses) > 0
    ? (data.income / (data.income + data.expenses)) * 100
    : 0;
  const expensesBarWidth = data.expenses > 0 && (data.income + data.expenses) > 0
    ? (data.expenses / (data.income + data.expenses)) * 100
    : 0;

  return (
    <WidgetCard title="Cash Flow" compact>
      <div className="flex-1 flex flex-col justify-between">
        <div className="space-y-3">
          {/* Net Amount - Prominent */}
          <div className={cn(
            "p-3 rounded-lg border",
            isPositive ? "bg-sentiment-positive/5 border-sentiment-positive/20" : "bg-sentiment-negative/5 border-sentiment-negative/20"
          )}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Net</span>
              <span className={cn(
                "text-xl",
                isPositive ? "text-sentiment-positive" : "text-sentiment-negative"
              )}>
                {isPositive ? '+' : ''}{formatMoney(data.net)}
              </span>
            </div>
          </div>

          {/* Compact Bars */}
          <div className="space-y-1.5">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Income</span>
                <span>{formatMoney(data.income)}</span>
              </div>
              <div className="h-2 bg-muted rounded overflow-hidden">
                <div
                  className="h-full bg-sentiment-positive transition-all"
                  style={{ width: `${incomeBarWidth}%` }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Expenses</span>
                <span>{formatMoney(data.expenses)}</span>
              </div>
              <div className="h-2 bg-muted rounded overflow-hidden">
                <div
                  className="h-full bg-sentiment-negative transition-all"
                  style={{ width: `${expensesBarWidth}%` }}
                />
              </div>
            </div>
          </div>

          {/* Context */}
          <div className="text-xs text-muted-foreground">
            {data.spendingRatio.toFixed(0)}% of income
            {data.comparison.expensesChange !== 0 && (
              <span className="ml-2">
                {data.comparison.expensesChange > 0 ? '+' : ''}{data.comparison.expensesChange.toFixed(0)}% vs last month
              </span>
            )}
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
