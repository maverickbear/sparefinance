"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoney, formatMoneyCompact } from "@/components/common/money";
import { cn } from "@/lib/utils";
import { parseTransactionAmount } from "../utils/transaction-helpers";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCategoryColor } from "@/lib/utils/category-colors";

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

  const expensesData = useMemo(() => {
    let expenses = selectedMonthTransactions.filter(
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
      
      if (amount <= 0) return acc;

      if (!acc[categoryName]) {
        acc[categoryName] = { value: 0, categoryId };
      }
      acc[categoryName].value += Math.abs(amount);
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

    // Add percentage and color to each item
    return dataArray.map((item) => ({
      ...item,
      percentage: total > 0 ? (item.value / total) * 100 : 0,
      color: getCategoryColor(item.name),
    }));
  }, [selectedMonthTransactions, expenseFilter]);

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
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            <CardTitle>Expenses by Category</CardTitle>
            <CardDescription>Distribution of total expenses</CardDescription>
          </div>
          <div suppressHydrationWarning>
            <Tabs value={expenseFilter} onValueChange={(value) => setExpenseFilter(value as ExpenseFilter)}>
              <TabsList className="h-9">
                <TabsTrigger value="all" className="text-xs px-3">View All</TabsTrigger>
                <TabsTrigger value="fixed" className="text-xs px-3">Fixed</TabsTrigger>
                <TabsTrigger value="variable" className="text-xs px-3">Variable</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
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
              <div className="text-2xl font-bold text-foreground tabular-nums">
                {formatMoneyCompact(totalExpenses)}
              </div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-1 min-w-0">
            {expensesData.slice(0, 7).map((item, index) => {
              return (
                <div
                  key={index}
                  onClick={() => handleCategoryClick(item.categoryId, item.name)}
                  className="flex items-center justify-between gap-2 py-1 px-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <div
                      className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-medium text-foreground truncate">
                      {item.name}
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      {formatMoneyCompact(item.value)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

