"use client";

import { useMemo } from "react";
import { IncomeExpensesChart } from "@/components/charts/income-expenses-chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartCard } from "@/components/charts/chart-card";
import { formatMoney } from "@/components/common/money";
import { format } from "date-fns";
import { sentiment } from "@/lib/design-system/colors";

interface NetCashFlowWidgetProps {
  chartTransactions: Array<{ month: string; income: number; expenses: number }>;
  currentIncome: number;
  currentExpenses: number;
  currentNetCashFlow: number;
  selectedMonthDate: Date;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg bg-card p-3 backdrop-blur-sm border border-border shadow-lg">
        <p className="mb-2 text-sm font-medium text-foreground">
          {data.month}
        </p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Net Cash Flow:</span>
            <span
              className={`text-sm font-semibold ${data.netCashFlow >= 0 ? "text-sentiment-positive" : "text-sentiment-negative"
                }`}
            >
              {formatMoney(data.netCashFlow)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Income:</span>
            <span className="text-sm font-semibold text-foreground">
              {formatMoney(data.income)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Expenses:</span>
            <span className="text-sm font-semibold text-foreground">
              {formatMoney(data.expenses)}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function NetCashFlowWidget({
  chartTransactions,
  currentIncome,
  currentExpenses,
  currentNetCashFlow,
  selectedMonthDate,
}: NetCashFlowWidgetProps) {
  // Prepare data for income/expenses chart (6 months)
  const monthlyData = useMemo(() => {
    return chartTransactions.map((item) => ({
      month: item.month,
      income: item.income,
      expenses: item.expenses,
    }));
  }, [chartTransactions]);

  // Prepare data for net cash flow trend
  const netCashFlowData = useMemo(() => {
    return chartTransactions.map((item) => ({
      month: item.month,
      netCashFlow: item.income - item.expenses,
      income: item.income,
      expenses: item.expenses,
    }));
  }, [chartTransactions]);

  // Calculate averages and trends
  const averageNetCashFlow = useMemo(() => {
    if (netCashFlowData.length === 0) return 0;
    const sum = netCashFlowData.reduce((acc, item) => acc + item.netCashFlow, 0);
    return sum / netCashFlowData.length;
  }, [netCashFlowData]);

  const trend = useMemo(() => {
    if (netCashFlowData.length < 2) return "stable";
    const recent = netCashFlowData.slice(-3);
    const older = netCashFlowData.slice(-6, -3);
    if (older.length === 0) return "stable";

    const recentAvg = recent.reduce((acc, item) => acc + item.netCashFlow, 0) / recent.length;
    const olderAvg = older.reduce((acc, item) => acc + item.netCashFlow, 0) / older.length;

    if (recentAvg > olderAvg * 1.1) return "improving";
    if (recentAvg < olderAvg * 0.9) return "declining";
    return "stable";
  }, [netCashFlowData]);

  // Calculate days remaining and projection
  const today = new Date();
  const endOfMonth = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + 1, 0);
  const daysRemaining = Math.max(0, endOfMonth.getDate() - today.getDate());
  const daysInMonth = endOfMonth.getDate();
  const daysElapsed = daysInMonth - daysRemaining;

  const dailyAverage = daysElapsed > 0 ? currentNetCashFlow / daysElapsed : 0;
  const projectedNetCashFlow = currentNetCashFlow + (dailyAverage * daysRemaining);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Current Month</div>
          <div
            className={`text-2xl font-bold ${currentNetCashFlow >= 0 ? "text-sentiment-positive" : "text-sentiment-negative"
              }`}
          >
            {currentNetCashFlow >= 0 ? "+" : ""}
            {formatMoney(currentNetCashFlow)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {format(selectedMonthDate, "MMM yyyy")}
          </div>
        </div>
        <div className="border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Projected This Month</div>
          <div
            className={`text-2xl font-bold ${projectedNetCashFlow >= 0 ? "text-sentiment-positive" : "text-sentiment-negative"
              }`}
          >
            {projectedNetCashFlow >= 0 ? "+" : ""}
            {formatMoney(projectedNetCashFlow)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Based on {daysElapsed} days ({daysRemaining} remaining)
          </div>
        </div>
        <div className="border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">6-Month Average</div>
          <div
            className={`text-2xl font-bold ${averageNetCashFlow >= 0 ? "text-sentiment-positive" : "text-sentiment-negative"
              }`}
          >
            {averageNetCashFlow >= 0 ? "+" : ""}
            {formatMoney(averageNetCashFlow)}
          </div>
          <div className="text-xs text-muted-foreground mt-1 capitalize">
            Trend: {trend}
          </div>
        </div>
      </div>

      {/* Income vs Expenses Chart (6 months) */}
      {monthlyData.length > 0 && (
        <IncomeExpensesChart data={monthlyData} />
      )}

      {/* Net Cash Flow Trend */}
      {netCashFlowData.length > 0 && (
        <ChartCard
          title="Net Cash Flow Trend"
          description="Monthly net cash flow over the last 6 months"
        >
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={netCashFlowData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
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
              <Line
                type="monotone"
                dataKey="netCashFlow"
                stroke={sentiment.positive}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              {/* Zero line */}
              <Line
                type="monotone"
                dataKey={() => 0}
                stroke="hsl(var(--border))"
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Insights */}
      <div className="border border-border rounded-lg p-4">
        <h3 className="text-lg font-semibold text-foreground mb-4">Insights</h3>
        <div className="space-y-3">
          {trend === "improving" && (
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-sentiment-positive mt-1.5" />
              <div>
                <div className="text-sm font-medium text-foreground">Improving Trend</div>
                <div className="text-xs text-muted-foreground">
                  Your cash flow has been improving over the last 3 months. Keep up the good work!
                </div>
              </div>
            </div>
          )}
          {trend === "declining" && (
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-sentiment-warning mt-1.5" />
              <div>
                <div className="text-sm font-medium text-foreground">Declining Trend</div>
                <div className="text-xs text-muted-foreground">
                  Your cash flow has been declining. Consider reviewing your expenses or increasing income.
                </div>
              </div>
            </div>
          )}
          {currentNetCashFlow < 0 && (
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-sentiment-negative mt-1.5" />
              <div>
                <div className="text-sm font-medium text-foreground">Negative This Month</div>
                <div className="text-xs text-muted-foreground">
                  You're spending more than you're earning this month. Review your expenses to get back on track.
                </div>
              </div>
            </div>
          )}
          {currentNetCashFlow >= 0 && averageNetCashFlow >= 0 && (
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-sentiment-positive mt-1.5" />
              <div>
                <div className="text-sm font-medium text-foreground">Positive Cash Flow</div>
                <div className="text-xs text-muted-foreground">
                  You're maintaining positive cash flow. Consider allocating surplus to savings or investments.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {chartTransactions.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No cash flow data available.</p>
          <p className="text-xs mt-1">Add transactions to see cash flow trends.</p>
        </div>
      )}
    </div>
  );
}

