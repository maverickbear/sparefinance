"use client";

import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartCard } from "@/components/charts/chart-card";
import { formatMoney } from "@/components/common/money";
import { Button } from "@/components/ui/button";
import { HistoricalDataPoint } from "@/lib/mock-data/portfolio-mock-data";
import { format, subDays, parseISO } from "date-fns";

interface PortfolioPerformanceChartProps {
  data: HistoricalDataPoint[];
  currentValue: number;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border bg-background p-3 shadow-sm">
        <div className="font-semibold">
          {format(parseISO(data.date), "MMM dd, yyyy")}
        </div>
        <div className="text-sm text-muted-foreground">
          Value: {formatMoney(data.value)}
        </div>
      </div>
    );
  }
  return null;
};

export function PortfolioPerformanceChart({
  data,
  currentValue,
}: PortfolioPerformanceChartProps) {
  const [period, setPeriod] = useState<"1D" | "5D" | "1M" | "3M" | "6M" | "YTD" | "1Y">("1D");

  const getFilteredData = () => {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    let cutoffDate: Date;
    
    switch (period) {
      case "1D":
        cutoffDate = subDays(today, 1);
        break;
      case "5D":
        cutoffDate = subDays(today, 5);
        break;
      case "1M":
        cutoffDate = subDays(today, 30);
        break;
      case "3M":
        cutoffDate = subDays(today, 90);
        break;
      case "6M":
        cutoffDate = subDays(today, 180);
        break;
      case "YTD":
        cutoffDate = startOfYear;
        break;
      case "1Y":
        cutoffDate = subDays(today, 365);
        break;
      default:
        cutoffDate = subDays(today, 1);
    }
    
    return data.filter((point) => {
      const pointDate = parseISO(point.date);
      return pointDate >= cutoffDate;
    });
  };

  const filteredData = getFilteredData();
  const startValue = filteredData[0]?.value || currentValue;
  // Calculate performance, handling division by zero
  const performance = startValue !== 0 
    ? ((currentValue - startValue) / startValue) * 100 
    : 0;

  return (
    <ChartCard
      title="Portfolio Performance"
      description="Portfolio value over time"
      className="overflow-hidden"
      headerActions={
        <div className="flex gap-2">
          <Button
            variant={period === "1D" ? "default" : "outline"}
            size="small"
            onClick={() => setPeriod("1D")}
            className={`rounded-full transition-all ${
              period === "1D"
                ? "border-2 border-primary"
                : ""
            }`}
          >
            1D
          </Button>
          <Button
            variant={period === "5D" ? "default" : "outline"}
            size="small"
            onClick={() => setPeriod("5D")}
            className={`rounded-full transition-all ${
              period === "5D"
                ? "border-2 border-primary"
                : ""
            }`}
          >
            5D
          </Button>
          <Button
            variant={period === "1M" ? "default" : "outline"}
            size="small"
            onClick={() => setPeriod("1M")}
            className={`rounded-full transition-all ${
              period === "1M"
                ? "border-2 border-primary"
                : ""
            }`}
          >
            1M
          </Button>
          <Button
            variant={period === "3M" ? "default" : "outline"}
            size="small"
            onClick={() => setPeriod("3M")}
            className={`rounded-full transition-all ${
              period === "3M"
                ? "border-2 border-primary"
                : ""
            }`}
          >
            3M
          </Button>
          <Button
            variant={period === "6M" ? "default" : "outline"}
            size="small"
            onClick={() => setPeriod("6M")}
            className={`rounded-full transition-all ${
              period === "6M"
                ? "border-2 border-primary"
                : ""
            }`}
          >
            6M
          </Button>
          <Button
            variant={period === "YTD" ? "default" : "outline"}
            size="small"
            onClick={() => setPeriod("YTD")}
            className={`rounded-full transition-all ${
              period === "YTD"
                ? "border-2 border-primary"
                : ""
            }`}
          >
            YTD
          </Button>
          <Button
            variant={period === "1Y" ? "default" : "outline"}
            size="small"
            onClick={() => setPeriod("1Y")}
            className={`rounded-full transition-all ${
              period === "1Y"
                ? "border-2 border-primary"
                : ""
            }`}
          >
            1Y
          </Button>
        </div>
      }
    >
      <div className="mb-4 border-b pb-3">
        <div className="flex items-baseline gap-2">
          <div className="text-xl font-semibold tracking-tight text-foreground">
            {formatMoney(currentValue)}
          </div>
          <div
            className={`text-sm ${
              performance >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {performance >= 0 ? "+" : ""}
            {performance.toFixed(2)}%
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={filteredData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            opacity={0.3}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={{ stroke: "hsl(var(--border))" }}
            tickFormatter={(value) => {
              try {
                return format(parseISO(value), "MMM dd");
              } catch {
                return value;
              }
            }}
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
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

