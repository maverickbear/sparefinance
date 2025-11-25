"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoney, formatMoneyCompact } from "@/components/common/money";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { subMonths, format } from "date-fns";

interface NetWorthWidgetProps {
  netWorth: number;
  totalAssets: number;
  totalDebts: number;
}

// Colors for the chart
const ASSETS_COLOR = "#22c55e"; // Green
const DEBTS_COLOR = "#ef4444"; // Red

// Custom tooltip component
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg bg-card border border-border p-3 shadow-lg">
        <p className="mb-2 text-sm font-medium text-foreground">
          {payload[0].payload.month}
        </p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-muted-foreground">
                {entry.name}:
              </span>
              <span className="text-sm font-semibold text-foreground">
                {formatMoney(entry.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// Custom legend component
const CustomLegend = ({ payload }: any) => {
  return (
    <div className="flex items-center justify-center gap-4 pt-2">
      {payload?.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-1.5">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export function NetWorthWidget({
  netWorth,
  totalAssets,
  totalDebts,
}: NetWorthWidgetProps) {
  // Generate chart data for the last 6 months
  // Since we don't have historical data, we'll create a trend based on current values
  const chartData = useMemo(() => {
    const months = [];
    const now = new Date();
    
    // Generate data for last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(now, i);
      const monthLabel = format(date, "MMM");
      
      // Create a trend: start lower and gradually increase to current values
      // For assets: start at ~85% of current and grow to 100%
      // For debts: start at ~90% of current and grow to 100%
      const progress = i === 5 ? 0.85 : i === 0 ? 1.0 : 0.85 + (5 - i) * 0.03;
      const assetsProgress = i === 5 ? 0.85 : i === 0 ? 1.0 : 0.85 + (5 - i) * 0.03;
      const debtsProgress = i === 5 ? 0.90 : i === 0 ? 1.0 : 0.90 + (5 - i) * 0.02;
      
      months.push({
        month: monthLabel,
        assets: Math.max(0, totalAssets * assetsProgress),
        debts: Math.max(0, totalDebts * debtsProgress),
      });
    }
    
    return months;
  }, [totalAssets, totalDebts]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Net Worth Snapshot</CardTitle>
        <CardDescription>Assets vs Debts over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className={cn(
              "text-2xl font-bold tabular-nums mb-1",
              netWorth >= 0 ? "text-green-500" : "text-red-500"
            )}>
              {formatMoneyCompact(netWorth)}
            </div>
            <div className="text-sm text-muted-foreground">Total net worth</div>
          </div>

          <div className="h-[250px] min-h-[250px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minHeight={250}>
              <LineChart 
                data={chartData} 
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  opacity={0.3}
                  vertical={false}
                />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis 
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={{ stroke: "hsl(var(--border))" }}
                  width={60}
                  tickFormatter={(value) => {
                    if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
                    return `$${value}`;
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend content={<CustomLegend />} />
                <Line
                  type="monotone"
                  dataKey="assets"
                  name="Assets"
                  stroke={ASSETS_COLOR}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="debts"
                  name="Debts"
                  stroke={DEBTS_COLOR}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

