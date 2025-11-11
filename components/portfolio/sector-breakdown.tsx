"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ChartCard } from "@/components/charts/chart-card";
import { formatMoney } from "@/components/common/money";
import { getSectorColor } from "@/lib/utils/portfolio-utils";

interface SectorBreakdownData {
  sector: string;
  value: number;
  percent: number;
  count: number;
}

interface SectorBreakdownProps {
  data: SectorBreakdownData[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border bg-background p-3 shadow-sm">
        <div className="font-semibold">{data.sector}</div>
        <div className="text-sm text-muted-foreground">
          Value: {formatMoney(data.value)}
        </div>
        <div className="text-sm text-muted-foreground">
          Allocation: {data.percent.toFixed(2)}%
        </div>
        <div className="text-sm text-muted-foreground">
          Holdings: {data.count}
        </div>
      </div>
    );
  }
  return null;
};

export function SectorBreakdown({ data }: SectorBreakdownProps) {
  const chartData = data.map((item) => ({
    sector: item.sector,
    value: item.value,
    percent: item.percent,
    count: item.count,
    fill: getSectorColor(item.sector),
  }));

  return (
    <ChartCard
      title="Sector Allocation"
      description="Portfolio distribution by industry sector"
      className="overflow-hidden"
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
          layout="vertical"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            opacity={0.3}
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={{ stroke: "hsl(var(--border))" }}
            tickFormatter={(value) => {
              if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
              return `$${value}`;
            }}
          />
          <YAxis
            dataKey="sector"
            type="category"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={{ stroke: "hsl(var(--border))" }}
            width={120}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

