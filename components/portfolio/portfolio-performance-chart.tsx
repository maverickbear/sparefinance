"use client";

import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartCard } from "@/components/charts/chart-card";
import { formatMoney } from "@/components/common/money";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HistoricalDataPoint } from "@/src/domain/portfolio/portfolio.types";
import { subDays, parseISO, format } from "date-fns";
import { formatTransactionDate } from "@/src/infrastructure/utils/timestamp";

interface PortfolioPerformanceChartProps {
  data: HistoricalDataPoint[];
  currentValue: number;
  defaultPeriod?: "1D" | "5D" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "ALL";
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border bg-background p-3 shadow-sm">
        <div className="font-semibold">
          {formatTransactionDate(data.date)}
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
  defaultPeriod = "ALL",
}: PortfolioPerformanceChartProps) {
  const [period, setPeriod] = useState<"1D" | "5D" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "ALL">(defaultPeriod);

  const getFilteredData = () => {
    // If "ALL" is selected, return all data (no filtering)
    if (period === "ALL") {
      return data;
    }

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
  
  // Ensure data is sorted by date (ascending) for proper chart rendering
  const sortedData = filteredData.length > 0 
    ? [...filteredData].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      })
    : [];
  
  // Ensure we have at least one data point (current value)
  const chartData = sortedData.length > 0 
    ? sortedData 
    : [{ date: new Date().toISOString().split("T")[0], value: currentValue }];
  
  const startValue = chartData[0]?.value || currentValue;
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
        <Select value={period} onValueChange={(value) => setPeriod(value as typeof period)}>
          <SelectTrigger size="small" className="w-fit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1D">1D</SelectItem>
            <SelectItem value="5D">5D</SelectItem>
            <SelectItem value="1M">1M</SelectItem>
            <SelectItem value="3M">3M</SelectItem>
            <SelectItem value="6M">6M</SelectItem>
            <SelectItem value="YTD">YTD</SelectItem>
            <SelectItem value="1Y">1Y</SelectItem>
            <SelectItem value="ALL">ALL</SelectItem>
          </SelectContent>
        </Select>
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
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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

