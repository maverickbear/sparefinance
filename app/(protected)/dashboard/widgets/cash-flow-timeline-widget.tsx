"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from "date-fns";
import { IncomeExpensesChart } from "@/components/charts/income-expenses-chart";
import { calculateTotalIncome, calculateTotalExpenses } from "../utils/transaction-helpers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

      // Use centralized calculation functions to ensure consistency
      // These functions exclude transfers and validate transactions
      const income = calculateTotalIncome(monthTransactions);
      const expenses = calculateTotalExpenses(monthTransactions);

      return {
        month: format(month, "MMM"),
        income,
        expenses,
      };
    });
  }, [chartTransactions, months]);

  // Period Selector Component
  const periodSelector = (
    <Select value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as PeriodOption)}>
      <SelectTrigger size="small" className="w-fit h-7 text-xs px-2.5">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="1M">1M</SelectItem>
        <SelectItem value="3M">3M</SelectItem>
        <SelectItem value="6M">6M</SelectItem>
        <SelectItem value="12M">12M</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <div className="h-full">
      <IncomeExpensesChart data={monthlyData} headerActions={periodSelector} />
    </div>
  );
}

