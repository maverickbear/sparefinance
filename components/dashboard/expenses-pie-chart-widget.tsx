"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { getCategoryColor } from "@/lib/utils/category-colors";

interface ExpensesPieChartWidgetProps {
  selectedMonthTransactions: any[];
  lastMonthTransactions?: any[];
  className?: string;
}

export function ExpensesPieChartWidget({
  selectedMonthTransactions,
  lastMonthTransactions = [],
  className,
}: ExpensesPieChartWidgetProps) {
  const { items, totalExpenses, insight } = useMemo(() => {
    const toCategoryTotals = (transactions: any[]) => {
      return transactions
        .filter((t) => t && t.type === "expense")
        .reduce((acc, t) => {
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
        }, {} as Record<string, number>);
    };

    const currentTotals = toCategoryTotals(selectedMonthTransactions);
    const lastTotals = toCategoryTotals(lastMonthTransactions);

    const entries = (Object.entries(currentTotals) as [string, number][])
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const total = entries.reduce((sum, item) => sum + item.value, 0);
    const topThree = entries.slice(0, 3);
    const otherTotal = entries.slice(3).reduce((sum, item) => sum + item.value, 0);

    const normalized = [...topThree, ...(otherTotal > 0 ? [{ name: "Other", value: otherTotal }] : [])]
      .map((item) => {
        const lastValue = lastTotals[item.name] || 0;
        const changePercent = lastValue > 0
          ? ((item.value - lastValue) / lastValue) * 100
          : item.value > 0
            ? 100
            : 0;

        return {
          ...item,
          percentage: total > 0 ? (item.value / total) * 100 : 0,
          changePercent,
          color: getCategoryColor(item.name),
        };
      });

    const topCategory = normalized[0];
    const insightText = topCategory
      ? `${topCategory.name} accounts for ${Math.round(topCategory.percentage)}% of your spending`
      : "No expenses recorded yet";

    return { items: normalized, totalExpenses: total, insight: insightText };
  }, [selectedMonthTransactions, lastMonthTransactions]);

  return (
    <Card className={`w-full max-w-full h-full ${className ?? ""}`}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <CardTitle className="text-lg font-semibold">
              Expenses by category
            </CardTitle>
            <CardDescription className="text-sm">
              Top spending areas this month
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
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
              <span className="text-2xl font-semibold text-foreground">
                {formatMoney(totalExpenses)}
              </span>
              <span className="text-sm text-muted-foreground">
                total expenses
              </span>
            </div>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.name} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-foreground">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>{formatMoney(item.value)}</span>
                      <span className={item.changePercent >= 0 ? "text-sentiment-negative" : "text-sentiment-positive"}>
                        {item.changePercent >= 0 ? "+" : ""}
                        {item.changePercent.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              {insight}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

