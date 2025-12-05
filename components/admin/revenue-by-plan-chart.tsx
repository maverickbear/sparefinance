"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ChartCard } from "@/components/charts/chart-card";

interface SubscriptionDetail {
  subscriptionId: string;
  userId: string;
  planId: string;
  planName: string;
  status: string;
  monthlyRevenue: number;
  interval: "month" | "year" | "unknown";
  trialEndDate: string | null;
}

interface RevenueByPlanChartProps {
  subscriptionDetails: SubscriptionDetail[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
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
          <div className="font-medium">{data.name}</div>
          <div className="text-sm">
            <div className="font-semibold">{formatCurrency(data.value)}</div>
            <div className="text-muted-foreground">
              {data.payload.count} subscription{data.payload.count !== 1 ? "s" : ""}
            </div>
            <div className="text-muted-foreground">
              {data.payload.percentage}% of total MRR
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function RevenueByPlanChart({ subscriptionDetails }: RevenueByPlanChartProps) {
  // Aggregate revenue by plan
  const planRevenue = subscriptionDetails.reduce(
    (acc, sub) => {
      if (!acc[sub.planName]) {
        acc[sub.planName] = {
          planName: sub.planName,
          revenue: 0,
          count: 0,
        };
      }
      acc[sub.planName].revenue += sub.monthlyRevenue;
      acc[sub.planName].count += 1;
      return acc;
    },
    {} as Record<string, { planName: string; revenue: number; count: number }>
  );

  const totalMRR = Object.values(planRevenue).reduce((sum, plan) => sum + plan.revenue, 0);

  const chartData = Object.values(planRevenue)
    .map((plan, index) => ({
      name: plan.planName,
      value: plan.revenue,
      count: plan.count,
      percentage: totalMRR > 0 ? ((plan.revenue / totalMRR) * 100).toFixed(1) : "0.0",
      fill: COLORS[index % COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);

  if (chartData.length === 0) {
    return (
      <ChartCard
        title="Revenue by Plan"
        description="Monthly recurring revenue breakdown by plan"
      >
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-muted-foreground">No revenue data available</p>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Revenue by Plan"
      description="Monthly recurring revenue breakdown by plan"
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            opacity={0.3}
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={{ stroke: "hsl(var(--border))" }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={{ stroke: "hsl(var(--border))" }}
            width={80}
            tickFormatter={(value) => {
              if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
              return `$${value}`;
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

