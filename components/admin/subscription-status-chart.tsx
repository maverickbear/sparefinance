"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { ChartCard } from "@/components/charts/chart-card";

interface SubscriptionStatusData {
  active: number;
  trialing: number;
  cancelled: number;
  pastDue: number;
  churnRisk: number;
}

interface SubscriptionStatusChartProps {
  data: SubscriptionStatusData;
}

const STATUS_COLORS = {
  active: "hsl(var(--sentiment-positive))",
  trialing: "hsl(var(--primary))",
  cancelled: "hsl(var(--destructive))",
  pastDue: "hsl(var(--sentiment-warning))",
  churnRisk: "hsl(var(--accent))",
};

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
          <div className="text-sm font-semibold">{data.value} subscriptions</div>
        </div>
      </div>
    );
  }
  return null;
};

export function SubscriptionStatusChart({ data }: SubscriptionStatusChartProps) {
  const chartData = [
    { name: "Active", value: data.active, fill: STATUS_COLORS.active },
    { name: "Trialing", value: data.trialing, fill: STATUS_COLORS.trialing },
    { name: "Cancelled", value: data.cancelled, fill: STATUS_COLORS.cancelled },
    { name: "Past Due", value: data.pastDue, fill: STATUS_COLORS.pastDue },
    { name: "Churn Risk", value: data.churnRisk, fill: STATUS_COLORS.churnRisk },
  ].filter((item) => item.value > 0);

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <ChartCard
        title="Subscription Status"
        description="Distribution of subscriptions by status"
      >
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-muted-foreground">No subscription data available</p>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Subscription Status"
      description="Distribution of subscriptions by status"
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

