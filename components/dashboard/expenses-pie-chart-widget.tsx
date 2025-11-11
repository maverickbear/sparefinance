"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { formatMoney } from "@/components/common/money";

interface ExpensesPieChartWidgetProps {
  selectedMonthTransactions: any[];
}

const COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#4949f2", // primary (roxo)
  "#06b6d4", // cyan
  "#f97316", // orange
  "#ec4899", // pink
  "#14b8a6", // teal
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#84cc16", // lime
  "#f43f5e", // rose
  "#0ea5e9", // sky
  "#a855f7", // purple
  "#22c55e", // emerald
];

// Custom tooltip component
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="rounded-[12px] bg-card p-3 backdrop-blur-sm border border-border shadow-lg">
        <p className="mb-2 text-sm font-medium text-foreground">
          {data.name || "Uncategorized"}
        </p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: data.payload.fill }}
            />
            <span className="text-xs text-muted-foreground">Amount:</span>
            <span className="text-sm font-semibold text-foreground">
              {formatMoney(data.value)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Percentage:</span>
            <span className="text-sm font-semibold text-foreground">
              {data.payload.percentage?.toFixed(1) || 0}%
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Custom legend component
const CustomLegend = ({ payload }: any) => {
  if (!payload || payload.length === 0) return null;
  
  // Show only top 10 items in legend to avoid clutter
  const topItems = payload.slice(0, 10);
  const remainingCount = payload.length - 10;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
      {topItems.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-1.5">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-muted-foreground truncate max-w-[100px]">
            {entry.value || "Uncategorized"}
          </span>
        </div>
      ))}
      {remainingCount > 0 && (
        <span className="text-xs text-muted-foreground">
          +{remainingCount} more
        </span>
      )}
    </div>
  );
};

export function ExpensesPieChartWidget({
  selectedMonthTransactions,
}: ExpensesPieChartWidgetProps) {
  // Process expenses data
  const expensesData = useMemo(() => {
    const expenses = selectedMonthTransactions.filter(
      (t) => t && t.type === "expense"
    );

    if (expenses.length === 0) return [];

    // Group by category
    const expensesByCategory = expenses.reduce(
      (acc, t) => {
        const categoryName = t.category?.name || "Uncategorized";
        const amount =
          t.amount != null
            ? typeof t.amount === "string"
              ? parseFloat(t.amount)
              : Number(t.amount)
            : 0;

        if (isNaN(amount) || amount <= 0) return acc;

        if (!acc[categoryName]) {
          acc[categoryName] = 0;
        }
        acc[categoryName] += amount;
        return acc;
      },
      {} as Record<string, number>
    );

    // Convert to array and sort by value descending
    const dataArray = Object.entries(expensesByCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Calculate total for percentage
    const total = dataArray.reduce((sum, item) => sum + item.value, 0);

    // Add percentage to each item
    return dataArray.map((item) => ({
      ...item,
      percentage: total > 0 ? (item.value / total) * 100 : 0,
    }));
  }, [selectedMonthTransactions]);

  const totalExpenses = expensesData.reduce(
    (sum, item) => sum + item.value,
    0
  );

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <CardTitle className="text-lg font-semibold">
              Expenses by Category
            </CardTitle>
            <CardDescription className="text-sm">
              Distribution of expenses grouped by category
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {expensesData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No expenses found for this period
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Add transactions to see your spending distribution
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">
                {formatMoney(totalExpenses)}
              </span>
              <span className="text-sm text-muted-foreground">
                total expenses
              </span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={expensesData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {expensesData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend content={<CustomLegend />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

