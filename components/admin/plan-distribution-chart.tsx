"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { ChartCard } from "@/components/charts/chart-card";

interface PlanDistributionData {
  planId: string;
  planName: string;
  activeCount: number;
  trialingCount: number;
  totalCount: number;
}

interface PlanDistributionChartProps {
  data: PlanDistributionData[];
}

// Use design system colors for chart
const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--content-link))",
  "hsl(var(--sentiment-positive))",
  "hsl(var(--sentiment-warning))",
  "hsl(var(--muted-foreground))",
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: data.payload.fill }}
            />
            <span className="font-medium">{data.name}</span>
          </div>
          <div className="text-sm">
            <div className="font-semibold">{data.value} subscriptions</div>
            <div className="text-muted-foreground">
              {data.payload.activeCount} active, {data.payload.trialingCount} trialing
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function PlanDistributionChart({ data }: PlanDistributionChartProps) {
  // Filter out plans with no subscriptions and prepare chart data
  const chartData = data
    .filter((plan) => plan.totalCount > 0)
    .map((plan, index) => ({
      name: plan.planName,
      value: plan.totalCount,
      activeCount: plan.activeCount,
      trialingCount: plan.trialingCount,
      fill: COLORS[index % COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);

  if (chartData.length === 0) {
    return (
      <ChartCard
        title="Plan Distribution"
        description="Distribution of subscriptions across plans"
      >
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-muted-foreground">No subscription data available</p>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Plan Distribution"
      description="Distribution of subscriptions across plans"
    >
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value, entry: any) => (
              <span style={{ color: entry.color }}>
                {value} ({entry.payload.value})
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

