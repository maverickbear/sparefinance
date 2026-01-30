"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { ChartCard } from "./chart-card";
import { formatMoney } from "@/components/common/money";
import { sentiment, interactive } from "@/lib/design-system/colors";
import type { AccountWithBalance } from "@/src/domain/accounts/accounts.types";
import type { DebtWithCalculations } from "@/src/domain/debts/debts.types";

interface AccountsCompositionChartProps {
  accounts: AccountWithBalance[];
  liabilities: AccountWithBalance[];
  debts: DebtWithCalculations[];
}

interface CompositionSlice {
  name: string;
  value: number;
}

const COLORS = [
  interactive.primary,
  sentiment.positive,
  interactive.accent,
  sentiment.negative,
];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0];

  return (
    <div className="rounded-lg bg-card p-3 backdrop-blur-sm border border-border shadow-lg">
      <p className="mb-2 text-sm font-medium text-foreground">
        {data.name}
      </p>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: data.payload.fill }}
          />
          <span className="text-xs text-muted-foreground">Amount:</span>
          <span className="text-sm font-semibold text-foreground">
            {formatMoney(data.value)}
          </span>
        </div>
      </div>
    </div>
  );
};

const CustomLegend = ({ payload }: any) => {
  if (!payload?.length) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
      {payload.map((entry: any, index: number) => (
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

export function AccountsCompositionChart({
  accounts,
  liabilities,
  debts,
}: AccountsCompositionChartProps) {
  const data = useMemo<CompositionSlice[]>(() => {
    const bankTotal = accounts
      .filter((acc) => acc.type === "checking" || acc.type === "savings" || acc.type === "other")
      .reduce((sum, acc) => sum + (acc.balance || 0), 0);

    const creditTotal = accounts
      .filter((acc) => acc.type === "credit")
      .reduce((sum, acc) => sum + Math.abs(acc.balance || 0), 0);

    const investmentTotal = accounts
      .filter((acc) => acc.type === "investment")
      .reduce((sum, acc) => sum + (acc.balance || 0), 0);

    const liabilityTotal = liabilities
      .reduce((sum, acc) => sum + Math.abs(acc.balance || 0), 0);

    const debtTotal = debts
      .filter((debt) => !debt.isPaidOff)
      .reduce((sum, debt) => sum + Math.abs(Number(debt.currentBalance || 0)), 0);

    const loanTotal = liabilityTotal + debtTotal;

    return [
      { name: "Bank", value: Math.max(0, bankTotal) },
      { name: "Investments", value: Math.max(0, investmentTotal) },
      { name: "Credit cards", value: Math.max(0, creditTotal) },
      { name: "Loans", value: Math.max(0, loanTotal) },
    ].filter((item) => item.value > 0);
  }, [accounts, liabilities, debts]);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <ChartCard
      title="Accounts composition"
      description="How your balances are distributed today"
    >
      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No account balances available yet
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Add accounts to unlock balance insights
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-foreground">
              {formatMoney(total)}
            </span>
            <span className="text-xs text-muted-foreground">
              total across accounts
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={false}
                outerRadius={88}
                innerRadius={66}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${entry.name}-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
