"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/components/common/money";
import { AnimatedNumber } from "@/components/common/animated-number";
import { Lightbulb, AlertCircle, CheckCircle2 } from "lucide-react";
import type { FinancialHealthData } from "@/src/application/shared/financial-health";
import { formatExpectedIncomeRange, formatMonthlyIncomeFromRange } from "@/src/presentation/utils/format-expected-income";

interface FinancialHealthScoreWidgetProps {
  financialHealth: FinancialHealthData | null;
  selectedMonthTransactions: any[];
  lastMonthTransactions: any[];
  expectedIncomeRange?: string | null;
}

export function FinancialHealthScoreWidget({
  financialHealth,
  selectedMonthTransactions,
  lastMonthTransactions,
  expectedIncomeRange,
}: FinancialHealthScoreWidgetProps) {
  const router = useRouter();
  
  // Helper function to parse date from Supabase format
  const parseTransactionDate = (dateStr: string | Date): Date => {
    if (dateStr instanceof Date) {
      return dateStr;
    }
    if (!dateStr || typeof dateStr !== 'string') {
      return new Date();
    }
    try {
      // Handle both "YYYY-MM-DD HH:MM:SS" and "YYYY-MM-DDTHH:MM:SS" formats
      const normalized = dateStr.replace(' ', 'T').split('.')[0]; // Remove milliseconds if present
      const date = new Date(normalized);
      if (isNaN(date.getTime())) {
        return new Date();
      }
      return date;
    } catch (error) {
      return new Date();
    }
  };

  // Get today's date (without time) to filter out future transactions
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  // Filter transactions to only include those with date <= today
  // Exclude future transactions as they haven't happened yet
  const pastSelectedMonthTransactions = useMemo(() => {
    return selectedMonthTransactions.filter((t) => {
      if (!t.date) return false;
      try {
        const txDate = parseTransactionDate(t.date);
        txDate.setHours(0, 0, 0, 0);
        return txDate <= today;
      } catch (error) {
        return false; // Exclude if date parsing fails
      }
    });
  }, [selectedMonthTransactions, today]);
  
  // Check if financial health data is available
  // Allow showing data even if classification is "Unknown" as long as we have a score
  // This handles edge cases where score might be 0 but we still want to show it
  const hasData = financialHealth && financialHealth.score !== undefined;
  
  // Calculate current income and expenses for the modal
  // Only include past transactions (exclude future ones)
  const currentIncome = useMemo(() => {
    return pastSelectedMonthTransactions
      .filter((t) => t && t.type === "income")
      .reduce((sum, t) => {
        const amount = Number(t.amount) || 0;
        return sum + Math.abs(amount);
      }, 0);
  }, [pastSelectedMonthTransactions]);

  const currentExpenses = useMemo(() => {
    return pastSelectedMonthTransactions
      .filter((t) => t && t.type === "expense")
      .reduce((sum, t) => {
        const amount = Number(t.amount) || 0;
        return sum + Math.abs(amount);
      }, 0);
  }, [pastSelectedMonthTransactions]);

  const score = financialHealth?.score ?? 0;
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

  // Spare Score levels with ranges and colors
  const scoreLevels = [
    { range: "91-100", label: "Excellent", min: 91, max: 100, color: "hsl(var(--sentiment-positive))", bgColor: "bg-[hsl(var(--sentiment-positive))]" },
    { range: "81-90", label: "Good", min: 81, max: 90, color: "#94DD78", bgColor: "bg-[#94DD78]" },
    { range: "71-80", label: "Fair", min: 71, max: 80, color: "hsl(var(--sentiment-warning))", bgColor: "bg-[hsl(var(--sentiment-warning))]" },
    { range: "61-70", label: "Poor", min: 61, max: 70, color: "#FF8C42", bgColor: "bg-[#FF8C42]" },
    { range: "0-60", label: "Critical", min: 0, max: 60, color: "hsl(var(--sentiment-negative))", bgColor: "bg-[hsl(var(--sentiment-negative))]" },
  ];

  // Get classification text based on actual score ranges
  const getClassificationText = (score: number) => {
    if (score >= 91) return "Excellent";
    if (score >= 81) return "Good";
    if (score >= 71) return "Fair";
    if (score >= 61) return "Poor";
    return "Critical";
  };

  // Show error state if no data available
  if (!hasData) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="flex-shrink-0">
          <CardTitle>Spare Score</CardTitle>
          <CardDescription>Combined view of spending, savings and debt</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center justify-center text-center">
            <p className="text-sm text-muted-foreground mb-2">
              {financialHealth?.message || "Unable to calculate Spare Score at this time."}
            </p>
            <p className="text-xs text-muted-foreground">
              Make sure you have transactions for this month.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const classificationText = getClassificationText(score);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Spare Score</CardTitle>
            <CardDescription>Combined view of spending, savings and debt</CardDescription>
          </div>
          {financialHealth?.isProjected && (
            <Badge variant="outline" className="text-xs">
              Projected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col pt-6">
        <div className="space-y-4 flex-1 flex flex-col">
          {/* Score Display with Legend */}
          <div className="flex-shrink-0">
            <div className="flex flex-col lg:flex-row items-stretch gap-4 md:gap-6 bg-muted rounded-xl p-6">
              {/* Left Side - Score Number and Classification */}
              <div className="flex-1 lg:w-1/2 flex flex-col items-center justify-center">
                {/* Large Score Number - Black */}
                <div className={cn("text-4xl md:text-5xl lg:text-6xl font-bold tabular-nums leading-none text-foreground mb-2 md:mb-3")}>
                  <AnimatedNumber value={score} format="number" decimals={0} />
                </div>
                {/* Classification Text - Black */}
                <div className="text-base md:text-lg lg:text-xl font-semibold text-foreground">
                  {classificationText}
                </div>
                {financialHealth?.isProjected && (
                  <div className="mt-3 md:mt-4">
                    <Badge variant="secondary" className="text-xs">
                      Based on expected income
                    </Badge>
                  </div>
                )}
              </div>

              {/* Right Side - Legend with score ranges */}
              <div className="flex-1 lg:w-1/2 flex flex-col justify-center">
                <div className="space-y-1">
                  {scoreLevels.map((level) => (
                    <div key={level.label} className="flex items-center justify-between w-full">
                      <span className="text-sm font-semibold text-foreground">
                        {level.label}
                      </span>
                      <span className="text-sm font-normal text-foreground text-right">
                        {level.range}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {financialHealth?.isProjected && expectedIncomeRange && (
              <div className="text-xs text-muted-foreground mt-3 space-y-0.5">
                <div>Expected income: {formatExpectedIncomeRange(expectedIncomeRange)}</div>
                <div className="font-medium">
                  {formatMonthlyIncomeFromRange(expectedIncomeRange)}/month
                </div>
              </div>
            )}
            {financialHealth?.isProjected && financialHealth?.message && !expectedIncomeRange && (
              <p className="text-xs text-muted-foreground mt-3">
                {financialHealth.message}
              </p>
            )}
          </div>

          {/* Insights Preview */}
          {financialHealth && (financialHealth.alerts?.length > 0 || financialHealth.suggestions?.length > 0) && (
            <div className="flex-shrink-0 space-y-3 pt-4">
              <h3 className="text-sm font-semibold text-foreground">Key Insights</h3>
              
              {/* Alerts Preview - Show first 2 */}
              {financialHealth.alerts && financialHealth.alerts.length > 0 && (
                <div className="space-y-1">
                  {financialHealth.alerts.slice(0, 2).map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <AlertCircle
                        className={cn(
                          "h-4 w-4 flex-shrink-0",
                          alert.severity === "critical"
                            ? "text-red-600 dark:text-red-400"
                            : alert.severity === "warning"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-blue-600 dark:text-blue-400"
                        )}
                      />
                      <p className="text-foreground">{alert.title}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggestions Preview - Show first 1 if no alerts or only 1 alert */}
              {financialHealth.suggestions && financialHealth.suggestions.length > 0 && (
                <div className="space-y-1">
                  {financialHealth.suggestions
                    .slice(0, financialHealth.alerts?.length >= 2 ? 0 : 1)
                    .map((suggestion) => (
                      <div
                        key={suggestion.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400" />
                        <p className="text-foreground">{suggestion.title}</p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* View Full Report Button - Footer */}
          <div className="flex-shrink-0 mt-auto pt-4">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => router.push("/insights")}
            >
              <Lightbulb className="h-4 w-4" />
              <span>View Full Report</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

