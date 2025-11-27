"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoney, formatMoneyCompact } from "@/components/common/money";
import { cn } from "@/lib/utils";
import { parseTransactionAmount } from "../utils/transaction-helpers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCategoryColor } from "@/lib/utils/category-colors";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface ExpensesByCategoryWidgetProps {
  selectedMonthTransactions: any[];
  selectedMonthDate: Date;
}

type ExpenseFilter = "all" | "fixed" | "variable";

export function ExpensesByCategoryWidget({
  selectedMonthTransactions,
  selectedMonthDate,
}: ExpensesByCategoryWidgetProps) {
  const router = useRouter();
  const [expenseFilter, setExpenseFilter] = useState<ExpenseFilter>("all");

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

  // Calculate monthly income from past transactions
  const monthlyIncome = useMemo(() => {
    return pastSelectedMonthTransactions
      .filter((t) => t && t.type === "income")
      .reduce((sum, t) => {
        const amount = parseTransactionAmount(t.amount);
        return sum + Math.abs(amount);
      }, 0);
  }, [pastSelectedMonthTransactions]);

  const expensesData = useMemo(() => {
    // Only include past transactions (exclude future ones)
    let expenses = pastSelectedMonthTransactions.filter(
      (t) => t && t.type === "expense"
    );

    // Apply expense type filter
    if (expenseFilter !== "all") {
      expenses = expenses.filter((t) => {
        if (expenseFilter === "fixed") {
          return t.expenseType === "fixed";
        } else if (expenseFilter === "variable") {
          return t.expenseType === "variable";
        }
        return true;
      });
    }

    if (expenses.length === 0) return [];

    // Group by category, keeping category ID
    const expensesByCategory = expenses.reduce((acc, t) => {
      const categoryName = t.category?.name || "Other";
      const categoryId = t.category?.id || null;
      const amount = parseTransactionAmount(t.amount);
      const absAmount = Math.abs(amount);
      
      if (absAmount <= 0) return acc;

      if (!acc[categoryName]) {
        acc[categoryName] = { value: 0, categoryId };
      }
      acc[categoryName].value += absAmount;
      return acc;
    }, {} as Record<string, { value: number; categoryId: string | null }>);

    // Convert to array and sort by value descending
    const dataArray = Object.entries(expensesByCategory)
      .map(([name, data]) => {
        const typedData = data as { value: number; categoryId: string | null };
        return { name, value: typedData.value, categoryId: typedData.categoryId };
      })
      .sort((a, b) => b.value - a.value);

    // Calculate total for percentage
    const total = dataArray.reduce((sum, item) => sum + item.value, 0);

    // Add percentage, income percentage, and color to each item
    return dataArray.map((item) => ({
      ...item,
      percentage: total > 0 ? (item.value / total) * 100 : 0,
      incomePercentage: monthlyIncome > 0 ? (item.value / monthlyIncome) * 100 : 0,
      color: getCategoryColor(item.name),
    }));
  }, [pastSelectedMonthTransactions, expenseFilter, monthlyIncome]);

  // Calculate month date range
  const monthStart = useMemo(() => {
    const date = new Date(selectedMonthDate);
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date.toISOString().split('T')[0];
  }, [selectedMonthDate]);

  const monthEnd = useMemo(() => {
    const date = new Date(selectedMonthDate);
    date.setMonth(date.getMonth() + 1);
    date.setDate(0);
    date.setHours(23, 59, 59, 999);
    return date.toISOString().split('T')[0];
  }, [selectedMonthDate]);

  const handleCategoryClick = (categoryId: string | null, categoryName: string) => {
    if (!categoryId) {
      // If no category ID, try to navigate with category name as search
      router.push(`/transactions?type=expense&startDate=${monthStart}&endDate=${monthEnd}&search=${encodeURIComponent(categoryName)}`);
      return;
    }
    
    router.push(`/transactions?categoryId=${categoryId}&type=expense&startDate=${monthStart}&endDate=${monthEnd}`);
  };

  const totalExpenses = expensesData.reduce((sum, item) => sum + item.value, 0);

  // Calculate donut chart segments
  const radius = 75;
  const circumference = 2 * Math.PI * radius;
  const strokeWidth = 12;
  const svgSize = 180;
  const center = svgSize / 2;
  let accumulatedLength = 0;

  const segments = expensesData.map((item) => {
    const segmentLength = (item.percentage / 100) * circumference;
    // Each segment starts where the previous one ended
    // strokeDashoffset moves the dash pattern start position
    const offset = -accumulatedLength;
    accumulatedLength += segmentLength;
    return {
      ...item,
      offset,
      segmentLength,
    };
  });

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1.5">
            <CardTitle>Expenses by Category</CardTitle>
            <CardDescription>Distribution of total expenses</CardDescription>
          </div>
          <div className="flex-shrink-0">
            <Select value={expenseFilter} onValueChange={(value) => setExpenseFilter(value as ExpenseFilter)}>
              <SelectTrigger size="small" className="w-fit h-7 text-xs px-2.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">View All</SelectItem>
                <SelectItem value="fixed">Fixed</SelectItem>
                <SelectItem value="variable">Variable</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-row items-center lg:items-start gap-4 lg:gap-6">
          {/* Donut Chart */}
          <div className="relative flex-shrink-0 w-[140px] h-[140px] lg:w-[180px] lg:h-[180px]">
            <svg
              className="transform -rotate-90 w-full h-full"
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
              {/* Segments */}
              {segments.map((segment, index) => (
                <circle
                  key={index}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${segment.segmentLength} ${circumference - segment.segmentLength}`}
                  strokeDashoffset={segment.offset}
                  strokeLinecap="round"
                  className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-xl lg:text-2xl font-bold text-foreground tabular-nums">
                {formatMoneyCompact(totalExpenses)}
              </div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 min-w-0 w-full relative">
            <div className="space-y-1">
              {expensesData.map((item, index) => {
                return (
                  <Tooltip key={index}>
                    <TooltipTrigger asChild>
                      <div
                        onClick={() => handleCategoryClick(item.categoryId, item.name)}
                        className="flex items-center justify-between gap-2 py-1 px-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer relative"
                      >
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <div
                            className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-xs lg:text-sm font-medium text-foreground truncate">
                            {item.name}
                          </span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-xs lg:text-sm font-semibold text-foreground tabular-nums">
                            {formatMoneyCompact(item.value)}
                          </span>
                        </div>
                        <TooltipContent side="right" className="!bg-popover !text-popover-foreground border border-border !whitespace-normal w-[160px] !px-2.5 !py-2 !z-[9999]">
                          <div className="space-y-1">
                            <div className="font-medium text-xs">{item.name}</div>
                            <div className="text-[11px] space-y-0.5">
                              <div>
                                <span className="font-semibold">{item.percentage.toFixed(1)}%</span> of total expenses
                              </div>
                              {monthlyIncome > 0 && (
                                <div>
                                  <span className="font-semibold">{item.incomePercentage.toFixed(1)}%</span> of monthly income
                                </div>
                              )}
                            </div>
                          </div>
                        </TooltipContent>
                      </div>
                    </TooltipTrigger>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

