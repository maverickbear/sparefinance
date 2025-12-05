"use client";

import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { ChartCard } from "./chart-card";
import { formatMoney } from "@/components/common/money";

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
}

interface IncomeExpensesChartProps {
  data: MonthlyData[];
  headerActions?: React.ReactNode;
}

import { sentiment, interactive } from "@/lib/design-system/colors";

// Use design system colors for income (positive) and expenses (negative sentiment)
const INCOME_COLOR = sentiment.positive; // #2F5711
const EXPENSES_COLOR = sentiment.negative; // #A8200D
// Lighter variants for alternating bars
const INCOME_COLOR_LIGHT = interactive.primary; // #94DD78 - lighter green
// Use a lighter variant of negative sentiment - mix with white for lighter red
const EXPENSES_COLOR_LIGHT = interactive.accent; // Use accent as lighter variant, or create a lighter red

// Custom tooltip component
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg bg-card p-3 backdrop-blur-sm">
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
  const getColor = (name: string, fallbackColor: string) => {
    if (name === "Income") return INCOME_COLOR;
    if (name === "Expenses") return EXPENSES_COLOR;
    return fallbackColor;
  };

  return (
    <div className="flex items-center justify-center gap-4 pt-2">
      {payload?.map((entry: any, index: number) => {
        const color = getColor(entry.value, entry.color);
        return (
          <div key={index} className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-muted-foreground">{entry.value}</span>
          </div>
        );
      })}
    </div>
  );
};

export function IncomeExpensesChart({ data, headerActions }: IncomeExpensesChartProps) {
  const totalIncome = data.reduce((sum, item) => sum + item.income, 0);
  const totalExpenses = data.reduce((sum, item) => sum + item.expenses, 0);
  const netCashFlow = totalIncome - totalExpenses;

  return (
    <ChartCard 
      title="Cash Flow" 
      description="Income vs Expenses comparison"
      className="overflow-hidden"
      headerActions={headerActions}
    >
      <div className="mb-4 border-b pb-3">
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-semibold tracking-tight text-foreground">
            {formatMoney(netCashFlow)}
          </div>
          <div className="text-xs font-medium text-muted-foreground">
            Net Cash Flow
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart 
          data={data} 
          margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
          barCategoryGap="20%"
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
            width={50}
            tickFormatter={(value) => {
              if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
              return `$${value}`;
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
          <Bar 
            dataKey="income" 
            name="Income" 
            radius={[4, 4, 0, 0]}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-income-${index}`} 
                fill={index % 2 === 0 ? INCOME_COLOR : INCOME_COLOR_LIGHT}
              />
            ))}
          </Bar>
          <Bar 
            dataKey="expenses" 
            name="Expenses" 
            radius={[4, 4, 0, 0]}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-expenses-${index}`} 
                fill={index % 2 === 0 ? EXPENSES_COLOR : EXPENSES_COLOR_LIGHT}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

