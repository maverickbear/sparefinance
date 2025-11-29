"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ChartCard } from "@/components/charts/chart-card";
import { Calendar, CreditCard } from "lucide-react";
import type { Transaction } from "@/src/domain/transactions/transactions.types";
import { format, parseISO, getDay } from "date-fns";

interface SpendingPatternsSectionProps {
  transactions: Transaction[];
}

export function SpendingPatternsSection({ transactions }: SpendingPatternsSectionProps) {
  const expenses = transactions.filter((t) => t.type === "expense");

  if (expenses.length === 0) {
    return null;
  }

  // Spending by day of week
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const spendingByDay = expenses.reduce(
    (acc, tx) => {
      const day = getDay(parseISO(tx.date));
      acc[day] = (acc[day] || 0) + (Number(tx.amount) || 0);
      return acc;
    },
    {} as Record<number, number>
  );

  const dayOfWeekData = dayNames.map((name, index) => ({
    day: name,
    amount: spendingByDay[index] || 0,
  }));

  // Spending by account
  const spendingByAccount = expenses.reduce(
    (acc, tx) => {
      const accountName = tx.account?.name || "Unknown";
      acc[accountName] = (acc[accountName] || 0) + (Number(tx.amount) || 0);
      return acc;
    },
    {} as Record<string, number>
  );

  const accountData = Object.entries(spendingByAccount)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Recurring transactions
  const recurringTransactions = expenses.filter((tx) => tx.recurring);
  const recurringTotal = recurringTransactions.reduce(
    (sum, tx) => sum + (Number(tx.amount) || 0),
    0
  );

  const COLORS = [
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#f43f5e",
    "#f59e0b",
    "#10b981",
    "#06b6d4",
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Spending Patterns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Spending by Day of Week */}
            <ChartCard title="Spending by Day of Week" description="Average spending per day">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dayOfWeekData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.3}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
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
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg bg-card p-3 border">
                            <p className="font-medium mb-1">{payload[0].payload.day}</p>
                            <p className="text-sm text-foreground">
                              {formatMoney(payload[0].value as number)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {dayOfWeekData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Spending by Account */}
            <ChartCard title="Top 5 Accounts by Spending" description="Total spending per account">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={accountData}
                  layout="vertical"
                  margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
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
                    dataKey="name"
                    type="category"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                    width={100}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg bg-card p-3 border">
                            <p className="font-medium mb-1">{payload[0].payload.name}</p>
                            <p className="text-sm text-foreground">
                              {formatMoney(payload[0].value as number)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                    {accountData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Recurring Transactions Summary */}
          {recurringTransactions.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Recurring Transactions</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Recurring Expenses</p>
                  <p className="text-2xl font-bold">{formatMoney(recurringTotal)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Number of Recurring Items</p>
                  <p className="text-2xl font-bold">{recurringTransactions.length}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

