"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SpareScoreWidgetData } from "@/src/domain/dashboard/types";
import { WidgetEmptyState } from "./widget-empty-state";
import { WidgetCard } from "./widget-card";
import { TrendingUp as TrendingUpIcon } from "lucide-react";

interface SpareScoreWidgetProps {
  data: SpareScoreWidgetData | null;
  loading?: boolean;
  error?: string | null;
}

export function SpareScoreWidget({ data, loading, error }: SpareScoreWidgetProps) {
  if (loading) {
    return (
      <WidgetCard title="Spare Score" subtitle="Monthly score">
        <div className="animate-pulse space-y-3">
          <div className="h-10 bg-muted rounded w-24" />
          <div className="h-4 bg-muted rounded w-32" />
        </div>
      </WidgetCard>
    );
  }

  if (error) {
    return (
      <WidgetCard title="Spare Score" subtitle="Monthly score">
        <div className="text-sm text-muted-foreground">
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
      <WidgetCard title="Spare Score" subtitle="Monthly score">
        <WidgetEmptyState
          title="Start tracking your finances"
          description="Get your Spare Score based on income, expenses, and savings"
          primaryAction={{
            label: "Add Transaction",
            href: "/transactions/new",
          }}
          icon={TrendingUpIcon}
        />
      </WidgetCard>
    );
  }

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case "Excellent":
      case "Strong":
        return "text-sentiment-positive";
      case "Fair":
        return "text-sentiment-warning";
      case "Fragile":
        return "text-sentiment-warning";
      case "Critical":
        return "text-sentiment-negative";
      default:
        return "text-muted-foreground";
    }
  };

  const getClassificationBgColor = (classification: string) => {
    switch (classification) {
      case "Excellent":
      case "Strong":
        return "bg-sentiment-positive/10 text-sentiment-positive";
      case "Fair":
      case "Fragile":
        return "bg-sentiment-warning/10 text-sentiment-warning";
      case "Critical":
        return "bg-sentiment-negative/10 text-sentiment-negative";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-sentiment-positive";
    if (score >= 70) return "text-sentiment-positive";
    if (score >= 55) return "text-sentiment-warning";
    if (score >= 40) return "text-sentiment-warning";
    return "text-sentiment-negative";
  };

  const getTrendIcon = () => {
    if (data.trend === 'up') {
      return <TrendingUp className="h-4 w-4 text-sentiment-positive" />;
    } else if (data.trend === 'down') {
      return <TrendingDown className="h-4 w-4 text-sentiment-negative" />;
    }
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'text-sentiment-negative';
      case 'medium':
        return 'text-sentiment-warning';
      case 'low':
        return 'text-muted-foreground';
      default:
        return 'text-muted-foreground';
    }
  };

  const empty = data.details?.isEmptyState ?? false;

  return (
    <WidgetCard title="Spare Score" subtitle="Monthly score" compact>
      {/* Score Display */}
      <div className="flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className={cn("text-3xl font-bold", empty ? "text-muted-foreground" : getScoreColor(data.score))}>
              {empty ? "—" : data.score}
            </span>
            <span className="text-xs text-muted-foreground">/100</span>
            {data.trendValue !== undefined && (
              <div className="flex items-center gap-1 ml-auto">
                {getTrendIcon()}
                <span className={cn(
                  "text-xs font-medium",
                  data.trend === 'up' ? "text-sentiment-positive" : 
                  data.trend === 'down' ? "text-sentiment-negative" : 
                  "text-muted-foreground"
                )}>
                  {data.trendValue > 0 ? '+' : ''}{data.trendValue.toFixed(0)}
                </span>
              </div>
            )}
          </div>
          <div className={cn(
            "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium w-fit",
            empty ? "bg-muted text-muted-foreground" : getClassificationBgColor(data.classification),
            empty ? "text-muted-foreground" : getClassificationColor(data.classification)
          )}>
            {!empty && data.classification === "Excellent" && <CheckCircle2 className="h-3 w-3" />}
            {empty ? "No data" : data.classification}
          </div>
        </div>

        {/* Top 3 Drivers - Compact */}
        {data.topDrivers.length > 0 && (
          <div className="space-y-1.5 mt-3">
            {data.topDrivers.map((driver, index) => (
              <Link
                key={index}
                href={driver.actionHref}
                className="flex items-center justify-between p-2 rounded border hover:bg-muted/30 transition-colors text-xs"
              >
                <span className="text-muted-foreground truncate flex-1">{driver.label}</span>
                <span className={cn(
                  "text-xs font-medium ml-2",
                  getImpactColor(driver.impact)
                )}>
                  {driver.change.toFixed(0)}%
                </span>
              </Link>
            ))}
          </div>
        )}

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
