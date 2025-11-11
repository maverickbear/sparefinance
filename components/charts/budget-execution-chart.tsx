"use client";

import { ChartCard } from "./chart-card";

interface BudgetExecutionData {
  category: string;
  percentage: number;
}

interface BudgetExecutionChartProps {
  data: BudgetExecutionData[];
}

// Elegant color palette based on status
const getStatusColor = (percentage: number) => {
  if (percentage > 100) {
    return {
      bg: "bg-red-100 dark:bg-red-900/20",
      bar: "bg-red-400 dark:bg-red-500",
      text: "text-red-600 dark:text-red-400",
    };
  } else if (percentage > 90) {
    return {
      bg: "bg-amber-100 dark:bg-amber-900/20",
      bar: "bg-amber-400 dark:bg-amber-500",
      text: "text-amber-600 dark:text-amber-400",
    };
  } else {
    return {
      bg: "bg-emerald-100 dark:bg-emerald-900/20",
      bar: "bg-emerald-400 dark:bg-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
    };
  }
};

const getStatusLabel = (percentage: number) => {
  if (percentage > 100) return "Over Budget";
  if (percentage > 90) return "Warning";
  return "On Track";
};

export function BudgetExecutionChart({ data }: BudgetExecutionChartProps) {
  // Sort by percentage descending
  const sortedData = [...data].sort((a, b) => b.percentage - a.percentage);

  // Calculate average
  const averagePercentage = data.length > 0
    ? data.reduce((sum, item) => sum + item.percentage, 0) / data.length
    : 0;

  return (
    <ChartCard 
      title="Budget Used" 
      description="Budget percentage by category"
      className="overflow-hidden"
    >
      {sortedData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No budgets found for this period
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Create budgets to track your spending
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedData.map((item, index) => {
          const colors = getStatusColor(item.percentage);
          const statusLabel = getStatusLabel(item.percentage);
          const clampedPercentage = Math.min(item.percentage, 100);

          return (
            <div key={`${item.category}-${index}`} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-sm font-medium truncate">
                    {item.category}
                  </span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.text} ${colors.bg}`}
                  >
                    {statusLabel}
                  </span>
                </div>
                <div className="text-sm font-semibold ml-2 flex-shrink-0">
                  {item.percentage.toFixed(1)}%
                </div>
              </div>
              <div className="relative h-[5px] w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${colors.bar}`}
                  style={{ width: `${clampedPercentage}%` }}
                />
                {item.percentage > 100 && (
                  <div
                    className={`absolute top-0 h-full rounded-full ${colors.bar} opacity-30`}
                    style={{
                      width: `${((item.percentage - 100) / item.percentage) * 100}%`,
                      left: "100%",
                    }}
                  />
                )}
                {/* 100% marker */}
                <div className="absolute top-0 left-0 h-full w-[1px] bg-border" style={{ left: "100%" }} />
              </div>
            </div>
          );
        })}
        </div>
      )}
    </ChartCard>
  );
}

