"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CreditCard, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/components/common/money";
import type { DebtOverviewWidgetData } from "@/src/domain/dashboard/types";
import { WidgetEmptyState } from "./widget-empty-state";
import { WidgetCard } from "./widget-card";

interface DebtOverviewWidgetProps {
  data: DebtOverviewWidgetData | null;
  loading?: boolean;
  error?: string | null;
}

export function DebtOverviewWidget({ data, loading, error }: DebtOverviewWidgetProps) {
  if (loading) {
    return (
      <WidgetCard title="Debt" compact>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded" />
          <div className="h-4 bg-muted rounded" />
        </div>
      </WidgetCard>
    );
  }

  if (error) {
    return (
      <WidgetCard title="Debt" compact>
        <div className="text-xs text-muted-foreground">
          <p>Error: {error}</p>
          <Button asChild variant="outline" size="small" className="mt-3">
            <a href="/debts/new">Add Debt</a>
          </Button>
        </div>
      </WidgetCard>
    );
  }

  if (!data) {
    return (
      <WidgetCard title="Debt" compact>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-sentiment-positive mb-2" />
          <p className="text-xs text-muted-foreground">Debt-free!</p>
        </div>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="Debt" compact>
      <div className="flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          {/* Total Debt */}
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Total</p>
            <p className="text-xl text-sentiment-negative">
              {formatMoney(data.totalDebt)}
            </p>
          </div>

          {/* Monthly Payments */}
          <div className="p-2 rounded border bg-muted/30">
            <p className="text-xs text-muted-foreground mb-0.5">Monthly</p>
            <p className="text-sm">{formatMoney(data.monthlyPayments)}</p>
          </div>

          {/* Payoff Timeline */}
          {data.payoffTimeline > 0 && (
            <div className="p-2 rounded border">
              <p className="text-xs text-muted-foreground mb-0.5">Payoff</p>
              <p className="text-sm font-semibold">
                {data.payoffTimeline} month{data.payoffTimeline !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* Next Milestone - Compact */}
          {data.nextMilestone && (
            <div className="p-2 rounded border bg-primary/5 border-primary/20">
              <div className="flex items-center gap-1.5 mb-1">
                <CreditCard className="h-3 w-3 text-primary" />
                <p className="text-xs font-semibold text-primary">Next</p>
              </div>
              <p className="text-xs font-medium mb-0.5 truncate">{data.nextMilestone.milestoneDescription}</p>
              <p className="text-xs text-muted-foreground">
                {data.nextMilestone.monthsUntilMilestone}m
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
