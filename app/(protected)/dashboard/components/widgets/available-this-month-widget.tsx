"use client";

import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { ChartCard } from "@/components/charts/chart-card";
import { formatMoney } from "@/components/common/money";
import { format, subMonths, startOfMonth } from "date-fns";
import type { TransactionWithRelations } from "@/src/domain/transactions/transactions.types";
import type { GoalWithCalculations } from "@/src/domain/goals/goals.types";
import type { DebtWithCalculations } from "@/src/domain/debts/debts.types";
import type { BasePlannedPayment } from "@/src/domain/planned-payments/planned-payments.types";
import type { UserServiceSubscription } from "@/src/domain/subscriptions/subscriptions.types";
import { convertToMonthlyPayment } from "@/lib/utils/debts";
import { sentiment } from "@/lib/design-system/colors";

interface AvailableThisMonthWidgetProps {
  selectedMonthTransactions: TransactionWithRelations[];
  recurringPayments: TransactionWithRelations[];
  subscriptions: UserServiceSubscription[];
  plannedPayments: BasePlannedPayment[];
  goals: GoalWithCalculations[];
  debts: DebtWithCalculations[];
  chartTransactions: Array<{ month: string; income: number; expenses: number }>;
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
            <span className="text-xs text-muted-foreground">Available:</span>
            <span
              className={`text-sm font-semibold ${data.available >= 0 ? "text-sentiment-positive" : "text-sentiment-negative"
                }`}
            >
              {formatMoney(data.available)}
            </span>
          </div>
          {data.income && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Income:</span>
              <span className="text-sm font-semibold text-foreground">
                {formatMoney(data.income)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export function AvailableThisMonthWidget({
  selectedMonthTransactions,
  recurringPayments,
  subscriptions,
  plannedPayments,
  goals,
  debts,
  chartTransactions,
  selectedMonthDate,
}: AvailableThisMonthWidgetProps) {
  // Calculate current month values
  const currentIncome = useMemo(() => {
    return selectedMonthTransactions
      .filter((t) => t && t.type === "income")
      .reduce((sum, t) => {
        const amount = Number(t.amount) || 0;
        return sum + Math.abs(amount);
      }, 0);
  }, [selectedMonthTransactions]);

  const totalBills = useMemo(() => {
    return (
      recurringPayments.reduce((sum: number, rp: any) => {
        let monthlyAmount = Math.abs(rp.amount || 0);
        if (rp.recurringFrequency) {
          switch (rp.recurringFrequency) {
            case "weekly":
              monthlyAmount = Math.abs(rp.amount || 0) * 4.33;
              break;
            case "biweekly":
              monthlyAmount = Math.abs(rp.amount || 0) * 2.17;
              break;
            case "semimonthly":
              monthlyAmount = Math.abs(rp.amount || 0) * 2;
              break;
            case "daily":
              monthlyAmount = Math.abs(rp.amount || 0) * 30;
              break;
            default:
              monthlyAmount = Math.abs(rp.amount || 0);
          }
        }
        return sum + monthlyAmount;
      }, 0) +
      subscriptions
        .filter((s: any) => s.isActive)
        .reduce((sum: number, sub: any) => {
          let monthlyAmount = sub.amount || 0;
          switch (sub.billingFrequency) {
            case "weekly":
              monthlyAmount = (sub.amount || 0) * 4.33;
              break;
            case "biweekly":
              monthlyAmount = (sub.amount || 0) * 2.17;
              break;
            case "semimonthly":
              monthlyAmount = (sub.amount || 0) * 2;
              break;
            case "daily":
              monthlyAmount = (sub.amount || 0) * 30;
              break;
            default:
              monthlyAmount = sub.amount || 0;
          }
          return sum + monthlyAmount;
        }, 0) +
      plannedPayments.reduce((sum: number, pp: any) => {
        return sum + (pp.amount || 0);
      }, 0)
    );
  }, [recurringPayments, subscriptions, plannedPayments]);

  const totalGoalsContributions = useMemo(() => {
    return goals
      .filter((g: any) => !g.isCompleted && !g.isPaused && g.monthlyContribution)
      .reduce((sum: number, g: any) => sum + (g.monthlyContribution || 0), 0);
  }, [goals]);

  const totalMinimumDebtPayments = useMemo(() => {
    return debts
      .filter((d: any) => !d.isPaidOff && !d.isPaused)
      .reduce((sum: number, debt: any) => {
        let monthlyPayment = debt.monthlyPayment || 0;
        if (debt.paymentAmount && debt.paymentFrequency) {
          monthlyPayment = convertToMonthlyPayment(
            debt.paymentAmount,
            debt.paymentFrequency as "monthly" | "biweekly" | "weekly" | "semimonthly" | "daily"
          );
        }
        if (debt.additionalContributions && debt.additionalContributionAmount) {
          monthlyPayment += debt.additionalContributionAmount;
        }
        return sum + monthlyPayment;
      }, 0);
  }, [debts]);

  const availableThisMonth = currentIncome - totalBills - totalGoalsContributions - totalMinimumDebtPayments;

  // Calculate historical available amounts (last 6 months)
  const historicalData = useMemo(() => {
    return chartTransactions.map((item) => {
      // For historical months, we can only estimate based on income/expenses
      // In a real scenario, we'd need historical bills/goals/debts data
      const estimatedAvailable = item.income - item.expenses;
      return {
        month: item.month,
        available: estimatedAvailable,
        income: item.income,
        expenses: item.expenses,
      };
    });
  }, [chartTransactions]);

  // Breakdown data for current month
  const breakdownData = useMemo(() => {
    return [
      { name: "Income", value: currentIncome, color: sentiment.positive },
      { name: "Bills", value: -totalBills, color: sentiment.negative },
      { name: "Goals", value: -totalGoalsContributions, color: sentiment.warning },
      { name: "Debts", value: -totalMinimumDebtPayments, color: sentiment.negative },
      { name: "Available", value: availableThisMonth, color: availableThisMonth >= 0 ? sentiment.positive : sentiment.negative },
    ];
  }, [currentIncome, totalBills, totalGoalsContributions, totalMinimumDebtPayments, availableThisMonth]);

  // Calculate projection
  const today = new Date();
  const endOfMonth = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + 1, 0);
  const daysRemaining = Math.max(0, endOfMonth.getDate() - today.getDate());
  const daysInMonth = endOfMonth.getDate();
  const daysElapsed = daysInMonth - daysRemaining;

  const dailyAverage = daysElapsed > 0 ? availableThisMonth / daysElapsed : 0;
  const projectedAvailable = availableThisMonth + (dailyAverage * daysRemaining);

  // Calculate last month available (if we have the data)
  const lastMonthData = historicalData[historicalData.length - 2];
  const lastMonthAvailable = lastMonthData?.available || 0;
  const difference = availableThisMonth - lastMonthAvailable;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Available This Month</div>
          <div
            className={`text-2xl font-bold ${availableThisMonth >= 0 ? "text-sentiment-positive" : "text-sentiment-negative"
              }`}
          >
            {formatMoney(availableThisMonth)}
          </div>
          {difference !== 0 && (
            <div className={`text-xs mt-1 ${difference > 0 ? "text-sentiment-positive" : "text-sentiment-negative"}`}>
              {difference > 0 ? "+" : ""}
              {formatMoney(difference)} vs last month
            </div>
          )}
        </div>
        <div className="border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Projected This Month</div>
          <div
            className={`text-2xl font-bold ${projectedAvailable >= 0 ? "text-sentiment-positive" : "text-sentiment-negative"
              }`}
          >
            {formatMoney(projectedAvailable)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Based on {daysElapsed} days ({daysRemaining} remaining)
          </div>
        </div>
        <div className="border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Monthly Income</div>
          <div className="text-2xl font-bold text-foreground">{formatMoney(currentIncome)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Before bills, goals, and debts
          </div>
        </div>
      </div>

      {/* Breakdown Chart */}
      <ChartCard
        title="Monthly Breakdown"
        description="Income → Bills → Goals → Debts → Available"
      >
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={breakdownData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
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
              width={60}
              tickFormatter={(value) => {
                if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
                return `$${value}`;
              }}
            />
            <Tooltip
              formatter={(value: number) => formatMoney(value)}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {breakdownData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Historical Trend */}
      {historicalData.length > 0 && (
        <ChartCard
          title="Available Amount Trend"
          description="Historical available amount over the last 6 months"
        >
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={historicalData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
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
                dataKey="available"
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

      {/* Detailed Breakdown */}
      <div className="border border-border rounded-lg p-4">
        <h3 className="text-lg font-semibold text-foreground mb-4">Detailed Breakdown</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Monthly Income</span>
            <span className="text-sm font-semibold text-sentiment-positive">
              {formatMoney(currentIncome)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Bills & Subscriptions</span>
            <span className="text-sm font-semibold text-sentiment-negative">
              -{formatMoney(totalBills)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Goals Contributions</span>
            <span className="text-sm font-semibold text-sentiment-warning">
              -{formatMoney(totalGoalsContributions)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Minimum Debt Payments</span>
            <span className="text-sm font-semibold text-sentiment-negative">
              -{formatMoney(totalMinimumDebtPayments)}
            </span>
          </div>
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Available This Month</span>
              <span
                className={`text-sm font-bold ${availableThisMonth >= 0 ? "text-sentiment-positive" : "text-sentiment-negative"
                  }`}
              >
                {formatMoney(availableThisMonth)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

