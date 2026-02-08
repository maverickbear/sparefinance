"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, ArrowRight, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/components/common/money";
import type { NetWorthWidgetData } from "@/src/domain/dashboard/types";
import { WidgetEmptyState } from "./widget-empty-state";
import { WidgetCard } from "./widget-card";

interface NetWorthWidgetProps {
  data: NetWorthWidgetData | null;
  loading?: boolean;
  error?: string | null;
}

export function NetWorthWidget({ data, loading, error }: NetWorthWidgetProps) {
  if (loading) {
    return (
      <WidgetCard title="Net Worth" compact>
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-muted rounded w-32" />
          <div className="h-4 bg-muted rounded w-24" />
        </div>
      </WidgetCard>
    );
  }

  if (error) {
    return (
      <WidgetCard title="Net Worth" compact>
        <div className="text-xs text-muted-foreground">
          <p>Error: {error}</p>
          <Button asChild variant="outline" size="small" className="mt-3">
            <Link href="/accounts/new">Add Account</Link>
          </Button>
        </div>
      </WidgetCard>
    );
  }

  if (!data) {
    return (
      <WidgetCard title="Net Worth" compact>
        <WidgetEmptyState
          title="Add accounts"
          description="See your total assets minus liabilities"
          primaryAction={{
            label: "Add Account",
            href: "/accounts/new",
          }}
          icon={Wallet}
        />
      </WidgetCard>
    );
  }

  const isPositive = data.netWorth >= 0;
  const changeIsPositive = data.change >= 0;

  return (
    <WidgetCard title="Net Worth" compact>
      <div className="flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className={cn(
              "text-2xl",
              isPositive ? "text-sentiment-positive" : "text-sentiment-negative"
            )}>
              {formatMoney(data.netWorth)}
            </span>
          </div>
          {data.change !== 0 && (
            <div className="flex items-center gap-1">
              {changeIsPositive ? (
                <TrendingUp className="h-3 w-3 text-sentiment-positive" />
              ) : (
                <TrendingDown className="h-3 w-3 text-sentiment-negative" />
              )}
              <span className={cn(
                "text-xs font-medium",
                changeIsPositive ? "text-sentiment-positive" : "text-sentiment-negative"
              )}>
                {changeIsPositive ? '+' : ''}{Math.abs(data.changePercentage).toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        {/* Breakdown - Compact */}
        <div className="space-y-1.5 pt-2 border-t">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Assets</span>
            <span className="font-medium">{formatMoney(data.totalAssets)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Liabilities</span>
            <span className="font-medium">{formatMoney(data.totalLiabilities)}</span>
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
