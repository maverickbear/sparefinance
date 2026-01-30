"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ChartCard } from "./chart-card";
import { formatMoney } from "@/components/common/money";
import { sentiment } from "@/lib/design-system/colors";
import type { BudgetWithRelations } from "@/src/domain/budgets/budgets.types";

interface BudgetVsActualChartProps {
  budgets: BudgetWithRelations[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;

  return (
    <div className="rounded-lg bg-card p-3 backdrop-blur-sm border border-border shadow-lg">
      <p className="mb-2 text-sm font-medium text-foreground">
        {data?.category}
      </p>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Budget:</span>
          <span className="text-sm font-semibold text-foreground">
            {formatMoney(data?.budget || 0)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Actual:</span>
          <span className="text-sm font-semibold text-foreground">
            {formatMoney(data?.actual || 0)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Variance:</span>
          <span className="text-sm font-semibold text-foreground">
            {data?.variance >= 0 ? "+" : ""}
            {formatMoney(data?.variance || 0)}
          </span>
        </div>
      </div>
    </div>
  );
};

export function BudgetVsActualChart({ budgets }: BudgetVsActualChartProps) {
  const chartData = useMemo(() => {
    return budgets
      .map((budget) => ({
        category: budget.displayName || budget.category?.name || "Uncategorized",
        budget: Number(budget.amount || 0),
        actual: Number(budget.actualSpend || 0),
        variance: Number(budget.actualSpend || 0) - Number(budget.amount || 0),
      }))
      .filter((item) => item.budget > 0 || item.actual > 0)
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
      .slice(0, 6);
  }, [budgets]);

  return (
    <ChartCard
      title="Budget vs actual"
      description="Over/under budget by category"
    >
      {chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No budgets available yet
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Create budgets to compare planned vs actual spend
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.3}
            />
            <XAxis
              type="number"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={{ stroke: "hsl(var(--border))" }}
              tickFormatter={(value) => {
                if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}k`;
                return `$${value}`;
              }}
            />
            <YAxis
              type="category"
              dataKey="category"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={{ stroke: "hsl(var(--border))" }}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="variance"
              name="Variance"
              radius={[4, 4, 4, 4]}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.variance <= 0 ? sentiment.positive : sentiment.negative}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
