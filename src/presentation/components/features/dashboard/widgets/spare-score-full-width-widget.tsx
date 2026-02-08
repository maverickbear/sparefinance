"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { SpareScoreWidgetData } from "@/src/domain/dashboard/types";
import { Info } from "lucide-react";

interface SpareScoreFullWidthWidgetProps {
  data: SpareScoreWidgetData | null;
  onOpenDetails: () => void;
}

export function SpareScoreFullWidthWidget({ data, onOpenDetails }: SpareScoreFullWidthWidgetProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  const details = data?.details;
  const empty = details?.isEmptyState ?? false;
  const score = data?.score ?? 0;
  const classification = data?.classification ?? "—";
  const hasData = data != null;

  const handleViewDetails = () => {
    setInfoOpen(false);
    onOpenDetails();
  };

  // Single most important insight: critical alert > warning alert > first suggestion > widget message
  const topInsight =
    details?.alerts?.find((a) => a.severity === "critical")?.title ??
    details?.alerts?.find((a) => a.severity === "warning")?.title ??
    details?.suggestions?.[0]?.title ??
    (data?.message && data.message.trim() ? data.message : null);

  const metrics = details
    ? [
        {
          label: "Savings Rate",
          value: empty ? "—" : `${details.savingsRate.toFixed(1)}%`,
          good: details.savingsRate >= 20,
        },
        {
          label: "Emergency Fund",
          value: empty ? "—" : `${details.emergencyFundMonths.toFixed(1)} mo`,
          good: details.emergencyFundMonths >= 6,
        },
        {
          label: "Debt",
          value: empty ? "—" : details.debtExposure,
          good: details.debtExposure === "Low",
        },
        {
          label: "Spending",
          value: empty ? "—" : details.spendingDiscipline,
          good: details.spendingDiscipline === "Excellent" || details.spendingDiscipline === "Good",
        },
      ]
    : [];

  return (
    <Card className="w-full overflow-hidden">
      <CardContent className="p-6 space-y-6">
        {/* Title with info */}
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Spare Score</h2>
          <Popover open={infoOpen} onOpenChange={setInfoOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label="What is Spare Score?"
              >
                <Info className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4 space-y-3" align="start">
              <p className="text-sm font-medium">What is Spare Score?</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Spare Score is your financial health rating from 0 to 100. It reflects your ability to afford your lifestyle, absorb shocks, and keep healthy money habits — not how much you have. The score is coaching-oriented and action-driven: it helps you see what to improve and how.
              </p>
              <Button size="small" className="w-full" onClick={handleViewDetails}>
                View Details
              </Button>
            </PopoverContent>
          </Popover>
        </div>

        {/* Row 1: Score (fit) | [spacer] | Insight (right) + Details (fit) */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex shrink-0 w-fit items-baseline gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-0.5">Current Score</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums">
                  {!hasData ? "—" : score}
                </span>
                <span className="text-base text-muted-foreground">/ 100</span>
              </div>
              <p className={cn("text-sm font-medium mt-0.5", !hasData ? "text-muted-foreground" : "text-foreground")}>
                {!hasData ? "No data" : classification}
              </p>
            </div>
          </div>
          <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
            {topInsight && (
              <p className="text-sm text-muted-foreground text-right sm:text-right max-w-md ml-0 sm:ml-auto truncate" title={topInsight}>
                {topInsight}
              </p>
            )}
            <Button variant="outline" size="small" onClick={onOpenDetails} className="shrink-0 w-fit self-start sm:self-center">
              Details
            </Button>
          </div>
        </div>

        {/* Row 2: Progress bar - full width below */}
        <div className="w-full space-y-1.5">
          <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
            <span>0</span>
            <span>Critical</span>
            <span>Fragile</span>
            <span>Fair</span>
            <span>Strong</span>
            <span>Excellent</span>
            <span>100</span>
          </div>
          <div className="relative h-2.5 w-full rounded-full bg-secondary overflow-hidden">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 opacity-80" />
            {hasData && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-1 h-4 bg-foreground border border-background rounded-full z-10 shadow-sm"
                style={{ left: `${Math.min(100, Math.max(0, score))}%` }}
              />
            )}
          </div>
        </div>

        {/* Row 3: Metrics pills */}
        {metrics.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {metrics.map((m) => (
              <div
                key={m.label}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-700 bg-muted/30 w-fit",
                  !empty && m.good && "text-green-700 dark:text-green-400",
                  !empty && !m.good && m.value !== "—" && "text-amber-700 dark:text-amber-400"
                )}
              >
                <span className="text-muted-foreground">{m.label}:</span>{" "}
                <span className="font-semibold">{m.value}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
