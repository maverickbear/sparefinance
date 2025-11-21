"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/components/common/money";
import { Lightbulb } from "lucide-react";
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

  // Get classification text
  const getClassificationText = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    if (score >= 20) return "Poor";
    return "Critical";
  };

  // Horizontal gauge dimensions
  const gaugeWidth = 100; // percentage based
  const gaugeHeight = 8;
  const scaleMarkers = [0, 20, 40, 60, 80, 100];
  
  // Calculate indicator position (0-100 to percentage)
  const indicatorPosition = score;

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
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
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
        <CardTitle>Spare Score</CardTitle>
        <CardDescription>Combined view of spending, savings and debt</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        <div className="space-y-4 flex-1 flex flex-col">
          {/* Score Display */}
          <div className="flex-shrink-0">
            <div className={cn("text-4xl md:text-5xl lg:text-6xl font-bold tabular-nums leading-none", getScoreColor(score))}>
              {score}
            </div>
            <div className="text-sm md:text-base font-medium text-foreground mt-1 md:mt-2">
              {getClassificationText(score)}
            </div>
          </div>

          {/* Horizontal Gauge */}
          <div className="relative flex-shrink-0">
            {/* Indicator pointer - above bar */}
            <div 
              className="absolute -top-2 -translate-x-1/2 transition-all duration-500 z-10"
              style={{ left: `${indicatorPosition}%` }}
            >
              <svg width="14" height="10" viewBox="0 0 14 10" className="text-foreground drop-shadow-sm">
                <path d="M7 10L0 0h14L7 10z" fill="currentColor" />
              </svg>
            </div>
            
            {/* Gradient bar */}
            <div className="relative h-4 rounded-lg overflow-hidden border border-border/50">
              <div className="absolute inset-0" style={{
                background: 'linear-gradient(to right, #ef4444 0%, #fb923c 50%, #22c55e 100%)'
              }}></div>
            </div>
            
            {/* Scale markers */}
            <div className="relative mt-2">
              <div className="flex justify-between">
                {scaleMarkers.map((marker) => (
                  <span key={marker} className="text-xs text-muted-foreground font-medium">
                    {marker}
                  </span>
                ))}
              </div>
            </div>
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

