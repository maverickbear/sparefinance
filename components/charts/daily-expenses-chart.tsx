"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartCard } from "./chart-card";

interface DailyExpensesData {
  date: string;
  amount: number;
}

interface DailyExpensesChartProps {
  data: DailyExpensesData[];
}

export function DailyExpensesChart({ data }: DailyExpensesChartProps) {
  return (
    <ChartCard title="Daily Expenses" description="Expenses by day for current month">
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
          <Line type="monotone" dataKey="amount" stroke="#8884d8" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

