"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/components/common/money";
import type { FinancialHealthData } from "@/lib/api/financial-health";

interface FinancialHealthScoreWidgetProps {
  financialHealth: FinancialHealthData | null;
  selectedMonthTransactions: any[];
  lastMonthTransactions: any[];
}

export function FinancialHealthScoreWidget({
  financialHealth,
  selectedMonthTransactions,
  lastMonthTransactions,
}: FinancialHealthScoreWidgetProps) {
  // Check if financial health data is available
  // Allow showing data even if classification is "Unknown" as long as we have a score
  // This handles edge cases where score might be 0 but we still want to show it
  const hasData = financialHealth && financialHealth.score !== undefined;
  
  const score = financialHealth?.score ?? 0;
  const classification = financialHealth?.classification || "Unknown";
  const lastMonthScore = useMemo(() => {
    // Use calculated last month score if available
    return financialHealth?.lastMonthScore;
  }, [financialHealth]);

  const scoreChange = useMemo(() => {
    if (lastMonthScore !== undefined) {
      return score - lastMonthScore;
    }
    return null; // No comparison available
  }, [score, lastMonthScore]);

  const scoreChangeText = scoreChange !== null
    ? scoreChange >= 0 ? `+${scoreChange.toFixed(0)} pts` : `${scoreChange.toFixed(0)} pts`
    : "N/A";

  // Calculate circumference for donut chart
  const radius = 75;
  const circumference = 2 * Math.PI * radius;
  const strokeWidth = 12;
  const svgSize = 180;
  const center = svgSize / 2;
  const percentage = score / 100;
  const offset = circumference * (1 - percentage);

  // Get spending discipline from financial health (now calculated)
  const spendingDiscipline = financialHealth?.spendingDiscipline || "Unknown";
  const debtExposure = financialHealth?.debtExposure || "Low";
  
  // Get emergency fund months from financial health (now calculated)
  const emergencyFundMonths = financialHealth?.emergencyFundMonths ?? 0;

  const getSpendingDisciplineColor = (discipline: string) => {
    switch (discipline) {
      case "Excellent":
        return "text-green-500";
      case "Good":
        return "text-green-600";
      case "Fair":
        return "text-yellow-500";
      case "Poor":
        return "text-orange-500";
      case "Critical":
        return "text-red-500";
      default:
        return "text-muted-foreground";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getStrokeColor = (score: number) => {
    if (score >= 80) return "#22c55e";
    if (score >= 60) return "#eab308";
    return "#ef4444";
  };

  // Show error state if no data available
  if (!hasData) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Financial Health Score</CardTitle>
          <CardDescription>Combined view of spending, savings and debt</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              {financialHealth?.message || "Unable to calculate financial health at this time."}
            </p>
            <p className="text-xs text-muted-foreground">
              Make sure you have transactions for this month.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Financial Health Score</CardTitle>
        <CardDescription>Combined view of spending, savings and debt</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          {/* Donut Chart */}
          <div className="relative flex-shrink-0">
            <svg
              className="transform -rotate-90"
              width={svgSize}
              height={svgSize}
              viewBox={`0 0 ${svgSize} ${svgSize}`}
            >
              {/* Background circle */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth={strokeWidth}
              />
              {/* Progress circle */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={getStrokeColor(score)}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-300"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className={cn("text-3xl font-bold", getScoreColor(score))}>
                {score}
              </div>
              <div className="text-xs text-muted-foreground">of 100</div>
            </div>
          </div>

          {/* Metrics List */}
          <div className="flex-1 space-y-3 min-w-0">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Change vs last month</span>
              <span className={cn(
                "text-sm font-semibold",
                scoreChange !== null
                  ? scoreChange >= 0 ? "text-green-500" : "text-red-500"
                  : "text-muted-foreground"
              )}>
                {scoreChangeText}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Spending discipline</span>
              <span className={cn("text-sm font-semibold", getSpendingDisciplineColor(spendingDiscipline))}>
                {spendingDiscipline}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Debt exposure</span>
              <span className={cn(
                "text-sm font-semibold",
                debtExposure === "Low" ? "text-green-500" :
                debtExposure === "Moderate" ? "text-yellow-500" : "text-red-500"
              )}>
                {debtExposure}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Emergency fund</span>
              <span className="text-sm font-semibold text-foreground">
                {emergencyFundMonths.toFixed(1)} months
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

