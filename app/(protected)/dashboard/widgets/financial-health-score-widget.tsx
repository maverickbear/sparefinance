"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/components/common/money";
import { AnimatedNumber } from "@/components/common/animated-number";
import { Lightbulb } from "lucide-react";
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
    // Handle both "YYYY-MM-DD HH:MM:SS" and "YYYY-MM-DDTHH:MM:SS" formats
    const normalized = dateStr.replace(' ', 'T').split('.')[0]; // Remove milliseconds if present
    return new Date(normalized);
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

  const emergencyFundMonths = financialHealth?.emergencyFundMonths ?? 0;
  
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
    : null;

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


  // Get spending discipline from financial health (now calculated)
  const spendingDiscipline = financialHealth?.spendingDiscipline || "Unknown";
  const debtExposure = financialHealth?.debtExposure || "Low";

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
    if (score >= 91) return "text-[hsl(var(--sentiment-positive))]";
    if (score >= 81) return "text-[#94DD78]";
    if (score >= 71) return "text-[hsl(var(--sentiment-warning))]";
    if (score >= 61) return "text-[#FF8C42]";
    return "text-[hsl(var(--sentiment-negative))]";
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

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
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
      <CardContent className="flex-1 flex flex-col min-h-0">
        <div className="space-y-4 flex-1 flex flex-col">
          {/* Score Display with Legend */}
          <div className="flex-shrink-0">
            <div className="flex items-start gap-4 md:gap-6">
              {/* Score Number */}
              <div className="flex-shrink-0">
                <div className={cn("text-4xl md:text-5xl lg:text-6xl font-bold tabular-nums leading-none text-foreground")}>
                  <AnimatedNumber value={score} format="number" decimals={0} />
                </div>
                <div className="flex items-center gap-2 mt-1 md:mt-2">
                  <div className="text-sm md:text-base font-medium text-foreground">
                    {getClassificationText(score)}
                  </div>
                  {financialHealth?.isProjected && (
                    <Badge variant="secondary" className="text-xs">
                      Based on expected income
                    </Badge>
                  )}
                </div>
              </div>

              {/* Legend with score ranges - Two columns */}
              <div className="flex-1 pt-1">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {scoreLevels.map((level) => (
                    <div key={level.label} className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground">
                        {level.label}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {level.range}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {financialHealth?.isProjected && expectedIncomeRange && (
              <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                <div>Expected income: {formatExpectedIncomeRange(expectedIncomeRange)}</div>
                <div className="font-medium">
                  {formatMonthlyIncomeFromRange(expectedIncomeRange)}/month
                </div>
              </div>
            )}
            {financialHealth?.isProjected && financialHealth?.message && !expectedIncomeRange && (
              <p className="text-xs text-muted-foreground mt-2">
                {financialHealth.message}
              </p>
            )}
          </div>

          {/* Insights Button */}
          <div className="flex-shrink-0 mt-auto">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => router.push("/insights")}
            >
              <Lightbulb className="h-4 w-4" />
              <span>View Insights & Actions</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

