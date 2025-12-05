"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ChartCard } from "@/components/charts/chart-card";

interface MRRComparisonData {
  mrr: number;
  estimatedFutureMRR: number;
  totalEstimatedMRR: number;
}

interface MRRComparisonChartProps {
  data: MRRComparisonData;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

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
          <div className="text-sm font-semibold">{formatCurrency(data.value)}</div>
          {data.payload.description && (
            <div className="text-xs text-muted-foreground">{data.payload.description}</div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export function MRRComparisonChart({ data }: MRRComparisonChartProps) {
  const chartData = [
    {
      name: "Current MRR",
      value: data.mrr,
      fill: "hsl(var(--primary))",
      description: "Active subscriptions revenue",
    },
    {
      name: "Estimated Future MRR",
      value: data.estimatedFutureMRR,
      fill: "hsl(var(--accent))",
      description: "Potential revenue from trials",
    },
    {
      name: "Total Estimated MRR",
      value: data.totalEstimatedMRR,
      fill: "hsl(var(--sentiment-positive))",
      description: "Current + Future MRR",
    },
  ];

  return (
    <ChartCard
      title="MRR Comparison"
      description="Current MRR vs estimated future MRR from trials"
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

