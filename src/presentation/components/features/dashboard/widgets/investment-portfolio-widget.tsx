"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, PieChart, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/components/common/money";
import type { InvestmentPortfolioWidgetData } from "@/src/domain/dashboard/types";
import { WidgetEmptyState } from "./widget-empty-state";
import { WidgetCard } from "./widget-card";

interface InvestmentPortfolioWidgetProps {
  data: InvestmentPortfolioWidgetData | null;
  loading?: boolean;
  error?: string | null;
}

export function InvestmentPortfolioWidget({ data, loading, error }: InvestmentPortfolioWidgetProps) {
  if (loading) {
    return (
      <WidgetCard title="Portfolio" compact>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded" />
          <div className="h-4 bg-muted rounded" />
        </div>
      </WidgetCard>
    );
  }

  if (error) {
    return (
      <WidgetCard title="Portfolio" compact>
        <div className="text-xs text-muted-foreground">
          <p>Error: {error}</p>
          <Button asChild variant="outline" size="small" className="mt-3">
            <a href="/investments/new">Add Investment</a>
          </Button>
        </div>
      </WidgetCard>
    );
  }

  if (!data) {
    return (
      <WidgetCard title="Portfolio" compact>
        <WidgetEmptyState
          title="Add investments"
          description="Track your portfolio"
          primaryAction={{
            label: "Add Investment",
            href: "/investments/new",
          }}
          icon={PieChart}
        />
      </WidgetCard>
    );
  }

  const performanceIsPositive = data.performanceYTD >= 0;

  return (
    <WidgetCard title="Portfolio" compact>
      <div className="flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          {/* Total Value */}
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Total Value</p>
            <p className="text-xl font-bold">{formatMoney(data.totalValue)}</p>
          </div>

          {/* Performance - Compact */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded border bg-muted/30">
              <p className="text-xs text-muted-foreground mb-0.5">YTD</p>
              <div className="flex items-center gap-1">
                {performanceIsPositive ? (
                  <TrendingUp className="h-3 w-3 text-sentiment-positive" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-sentiment-negative" />
                )}
                <span className={cn(
                  "text-sm font-semibold",
                  performanceIsPositive ? "text-sentiment-positive" : "text-sentiment-negative"
                )}>
                  {performanceIsPositive ? '+' : ''}{data.performanceYTD.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="p-2 rounded border bg-muted/30">
              <p className="text-xs text-muted-foreground mb-0.5">1Y</p>
              <div className="flex items-center gap-1">
                {data.performance1Y >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-sentiment-positive" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-sentiment-negative" />
                )}
                <span className={cn(
                  "text-sm font-semibold",
                  data.performance1Y >= 0 ? "text-sentiment-positive" : "text-sentiment-negative"
                )}>
                  {data.performance1Y >= 0 ? '+' : ''}{data.performance1Y.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Allocation - Compact */}
          {data.allocation.length > 0 && (
            <div className="space-y-1.5">
              {data.allocation.slice(0, 3).map((asset, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{asset.assetClass}</span>
                    <span className="font-semibold">{asset.percentage.toFixed(0)}%</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${asset.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Off Target Alert - Compact */}
          {data.isOffTarget && (
            <div className="p-2 rounded border bg-sentiment-warning/5 border-sentiment-warning/20">
              <p className="text-xs text-sentiment-warning">
                Off target - consider rebalancing
              </p>
            </div>
          )}
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
