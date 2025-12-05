"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { TrendingUp, TrendingDown, Wallet, CreditCard, PiggyBank } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NetWorthData } from "@/src/domain/reports/reports.types";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ChartCard } from "@/components/charts/chart-card";
import { format, parseISO } from "date-fns";
import { sentiment, interactive } from "@/lib/design-system/colors";

interface NetWorthSectionProps {
  netWorth: NetWorthData | null;
}

export function NetWorthSection({ netWorth }: NetWorthSectionProps) {
  if (!netWorth) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <p>Net Worth data is not available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { totalAssets, totalLiabilities, netWorth: netWorthValue, historical, change } = netWorth;

  // Prepare chart data
  const chartData = historical.map((point) => ({
    date: format(parseISO(point.date), "MMM yyyy"),
    assets: point.assets,
    liabilities: point.liabilities,
    netWorth: point.netWorth,
  }));

  // Calculate asset breakdown - use design system colors
  const assetBreakdown = [
    { name: "Cash & Accounts", value: totalAssets * 0.6, color: interactive.primary }, // #94DD78
    { name: "Investments", value: totalAssets * 0.4, color: interactive.accent }, // #B5EF90
  ];

  return (
    <div className="space-y-4">
      {/* Net Worth Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl flex items-center gap-2">
            <PiggyBank className="h-5 w-5" />
            Net Worth Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Total Assets */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-sentiment-positive" />
                <p className="text-sm text-muted-foreground">Total Assets</p>
              </div>
              <p className="text-2xl font-bold text-sentiment-positive">
                {formatMoney(totalAssets)}
              </p>
            </div>

            {/* Total Liabilities */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-sentiment-negative" />
                <p className="text-sm text-muted-foreground">Total Liabilities</p>
              </div>
              <p className="text-2xl font-bold text-sentiment-negative">
                {formatMoney(totalLiabilities)}
              </p>
            </div>

            {/* Net Worth */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <PiggyBank className="h-4 w-4" />
                <p className="text-sm text-muted-foreground">Net Worth</p>
              </div>
              <p
                className={cn(
                  "text-2xl font-bold",
                  netWorthValue >= 0
                    ? "text-sentiment-positive"
                    : "text-sentiment-negative"
                )}
              >
                {formatMoney(netWorthValue)}
              </p>
              {change.amount !== 0 && (
                <div className="flex items-center gap-1 text-xs">
                  {change.amount >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-sentiment-positive" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-sentiment-negative" />
                  )}
                  <span
                    className={cn(
                      change.amount >= 0
                        ? "text-sentiment-positive"
                        : "text-sentiment-negative"
                    )}
                  >
                    {change.amount >= 0 ? "+" : ""}
                    {formatMoney(change.amount)} ({change.percent >= 0 ? "+" : ""}
                    {change.percent.toFixed(1)}%)
                  </span>
                  <span className="text-muted-foreground"> {change.period}</span>
                </div>
              )}
            </div>
          </div>

          {/* Net Worth Chart */}
          {chartData.length > 0 && (
            <ChartCard title="Net Worth Trend" description="Evolution over the last 6 months">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.3}
                  />
                  <XAxis
                    dataKey="date"
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
                      if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                      if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
                      return `$${value}`;
                    }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg bg-card p-3 border">
                            <p className="font-medium mb-2">{payload[0].payload.date}</p>
                            {payload.map((entry, index) => (
                              <p
                                key={index}
                                className="text-sm"
                                style={{ color: entry.color }}
                              >
                                {entry.name}: {formatMoney(entry.value as number)}
                              </p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="netWorth"
                    stroke={sentiment.positive}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Net Worth"
                  />
                  <Line
                    type="monotone"
                    dataKey="assets"
                    stroke={interactive.primary}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 3 }}
                    name="Assets"
                  />
                  <Line
                    type="monotone"
                    dataKey="liabilities"
                    stroke={sentiment.negative}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 3 }}
                    name="Liabilities"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

