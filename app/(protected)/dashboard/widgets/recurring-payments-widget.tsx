"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoney, formatMoneyCompact } from "@/components/common/money";
import { getCategoryColor } from "@/lib/utils/category-colors";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface RecurringPayment {
  id: string;
  date: Date | string;
  type: "expense" | "income" | "transfer";
  amount: number;
  description?: string | null;
  account?: { id: string; name: string } | null;
  toAccount?: { id: string; name: string } | null;
  transferToId?: string | null;
  transferFromId?: string | null;
  category?: { id: string; name: string } | null;
  subcategory?: { id: string; name: string; logo?: string | null } | null;
}

interface RecurringPaymentsWidgetProps {
  recurringPayments: RecurringPayment[];
  monthlyIncome?: number;
}

export function RecurringPaymentsWidget({
  recurringPayments,
  monthlyIncome = 0,
}: RecurringPaymentsWidgetProps) {
  // Filter only expense recurring payments for the donut chart
  const expenseRecurringPayments = useMemo(() => {
    return recurringPayments.filter((p) => p.type === "expense");
  }, [recurringPayments]);

  // Process data for donut chart - group by category/description
  const donutData = useMemo(() => {
    if (expenseRecurringPayments.length === 0) return [];

    // Group by category name or description
    const grouped = expenseRecurringPayments.reduce((acc, payment) => {
      const categoryName = 
        payment.subcategory?.name ||
        payment.category?.name ||
        payment.description ||
        "Other";
      const amount = Math.abs(payment.amount || 0);
      
      if (amount <= 0) return acc;

      if (!acc[categoryName]) {
        acc[categoryName] = { value: 0, categoryId: payment.category?.id || null };
      }
      acc[categoryName].value += amount;
      return acc;
    }, {} as Record<string, { value: number; categoryId: string | null }>);

    // Convert to array and sort by value descending
    const dataArray = Object.entries(grouped)
      .map(([name, data]) => ({
        name,
        value: data.value,
        categoryId: data.categoryId,
      }))
      .sort((a, b) => b.value - a.value);

    // Calculate total for percentage
    const total = dataArray.reduce((sum, item) => sum + item.value, 0);

    // Add percentage and color to each item
    return dataArray.map((item) => ({
      ...item,
      percentage: total > 0 ? (item.value / total) * 100 : 0,
      incomePercentage: monthlyIncome > 0 ? (item.value / monthlyIncome) * 100 : 0,
      color: getCategoryColor(item.name),
    }));
  }, [expenseRecurringPayments, monthlyIncome]);

  const totalRecurringExpenses = donutData.reduce((sum, item) => sum + item.value, 0);

  // Calculate donut chart segments
  const radius = 75;
  const circumference = 2 * Math.PI * radius;
  const strokeWidth = 12;
  const svgSize = 180;
  const center = svgSize / 2;
  let accumulatedLength = 0;

  const segments = donutData.map((item) => {
    const segmentLength = (item.percentage / 100) * circumference;
    const offset = -accumulatedLength;
    accumulatedLength += segmentLength;
    return {
      ...item,
      offset,
      segmentLength,
    };
  });

  if (expenseRecurringPayments.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>
            Recurring Payments
          </CardTitle>
          <CardDescription>Expense transactions that repeat automatically</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              No expense recurring payments found
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>
              Recurring Payments
            </CardTitle>
            <CardDescription>
              {expenseRecurringPayments.length}{" "}
              {expenseRecurringPayments.length === 1
                ? "expense recurring payment"
                : "expense recurring payments"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Donut Chart Section - Only show if there are expense recurring payments */}
        {expenseRecurringPayments.length > 0 ? (
          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-4 lg:gap-6">
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
                    className="transition-all duration-300 hover:opacity-80"
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-xl lg:text-2xl font-bold text-foreground tabular-nums">
                  {formatMoneyCompact(totalRecurringExpenses)}
                </div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex-1 min-w-0 w-full relative">
              <div className="space-y-1">
                {donutData.map((item, index) => {
                  return (
                    <Tooltip key={index}>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-between gap-2 py-1 px-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer relative">
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
                                  <span className="font-semibold">{item.percentage.toFixed(1)}%</span> of total recurring expenses
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
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              No expense recurring payments found
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
