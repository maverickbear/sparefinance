"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from "date-fns";
import { IncomeExpensesChart } from "@/components/charts/income-expenses-chart";
import { parseTransactionAmount } from "../utils/transaction-helpers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PeriodOption = "1M" | "3M" | "6M" | "12M";

interface CashFlowTimelineWidgetProps {
  chartTransactions: any[];
  selectedMonthDate?: Date;
}

export function CashFlowTimelineWidget({
  chartTransactions,
  selectedMonthDate,
}: CashFlowTimelineWidgetProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>("6M");
  
  // Use selected month or current month
  const monthDate = selectedMonthDate || new Date();
  
  // Calculate date range based on selected period
  const { chartStart, chartEnd } = useMemo(() => {
    const end = endOfMonth(monthDate);
    let start: Date;
    
    switch (selectedPeriod) {
      case "1M":
        start = startOfMonth(monthDate);
        break;
      case "3M":
        start = startOfMonth(subMonths(monthDate, 2));
        break;
      case "6M":
        start = startOfMonth(subMonths(monthDate, 5));
        break;
      case "12M":
        start = startOfMonth(subMonths(monthDate, 11));
        break;
      default:
        start = startOfMonth(subMonths(monthDate, 5));
    }
    
    return { chartStart: start, chartEnd: end };
  }, [monthDate, selectedPeriod]);

  const months = eachMonthOfInterval({ start: chartStart, end: chartEnd });
  
  // Prepare monthly data for the bar chart
  const monthlyData = useMemo(() => {
    return months.map((month) => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      const monthTransactions = chartTransactions.filter((t) => {
        const txDate = new Date(t.date);
        return txDate >= monthStart && txDate <= monthEnd;
      });

      const income = monthTransactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + parseTransactionAmount(t.amount), 0);

      const expenses = monthTransactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + Math.abs(parseTransactionAmount(t.amount)), 0);

      return {
        month: format(month, "MMM"),
        income,
        expenses,
      };
    });
  }, [chartTransactions, months]);

  // Period Selector Component
  const periodSelector = (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1">
      {(["1M", "3M", "6M", "12M"] as PeriodOption[]).map((period) => (
        <Button
          key={period}
          variant="ghost"
          size="small"
          onClick={() => setSelectedPeriod(period)}
          className={cn(
            "h-7 px-3 text-xs font-medium transition-all",
            selectedPeriod === period
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {period}
        </Button>
      ))}
    </div>
  );

  return (
    <div className="h-full">
      <IncomeExpensesChart data={monthlyData} headerActions={periodSelector} />
    </div>
  );
}

