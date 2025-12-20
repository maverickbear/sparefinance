"use client";

import { Suspense } from "react";
import { formatMoney } from "@/components/common/money";
import { WidgetExpandableCard } from "@/components/dashboard/widget-expandable-card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { TransactionWithRelations } from "@/src/domain/transactions/transactions.types";
import { IncomeDetailWidget } from "./widgets/income-detail-widget";
import { ExpensesDetailWidget } from "./widgets/expenses-detail-widget";
import { NetCashFlowWidget } from "./widgets/net-cash-flow-widget";

interface CashFlowSectionProps {
  income: number;
  expenses: number;
  netCashFlow: number;
  selectedMonthDate: Date;
  selectedMonthTransactions: TransactionWithRelations[];
  lastMonthTransactions?: TransactionWithRelations[];
  chartTransactions?: Array<{ month: string; income: number; expenses: number }>;
  incomeSubtitle?: string;
  expensesSubtitle?: string;
  netSubtitle?: string;
}

export function CashFlowSection({
  income,
  expenses,
  netCashFlow,
  selectedMonthDate,
  selectedMonthTransactions,
  lastMonthTransactions = [],
  chartTransactions = [],
  incomeSubtitle = "Money coming in",
  expensesSubtitle = "Money going out",
  netSubtitle,
}: CashFlowSectionProps) {
  const isPositive = netCashFlow >= 0;
  const defaultNetSubtitle = isPositive
    ? "You're growing your wealth!"
    : "Spending more than income.";

  return (
    <section
      className="rounded-[var(--radius)] p-0 mt-3.5"
      aria-label="Cash flow"
    >
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="m-0 text-2xl font-semibold text-foreground">
          How you're doing this month
        </h2>
        <div className="text-muted-foreground text-xs">
          Income → Expenses → Result
        </div>
      </div>

      <div className="grid gap-2.5 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
        <WidgetExpandableCard
          label="Income"
          value={formatMoney(income)}
          subtitle={incomeSubtitle}
          pill={{ text: "MTD" }}
          expandedContent={
            <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
              <IncomeDetailWidget
                selectedMonthTransactions={selectedMonthTransactions}
                lastMonthTransactions={lastMonthTransactions}
                selectedMonthDate={selectedMonthDate}
              />
            </Suspense>
          }
          title="Income Details"
          description="Detailed breakdown of your income for this month"
          variant="flow"
        />

        <div className="hidden md:grid text-muted-foreground text-xs justify-center select-none font-mono mx-2">
          →
        </div>

        <WidgetExpandableCard
          label="Expenses"
          value={formatMoney(expenses)}
          subtitle={expensesSubtitle}
          pill={{ text: "MTD" }}
          expandedContent={
            <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
              <ExpensesDetailWidget
                selectedMonthTransactions={selectedMonthTransactions}
                lastMonthTransactions={lastMonthTransactions}
                selectedMonthDate={selectedMonthDate}
              />
            </Suspense>
          }
          title="Expenses Details"
          description="Detailed breakdown of your expenses for this month"
          variant="flow"
        />

        <div className="hidden md:grid text-muted-foreground text-xs justify-center select-none font-mono mx-2">
          →
        </div>

        <WidgetExpandableCard
          label="Net cash flow"
          value={
            <span
              className={cn(
                isPositive ? "text-sentiment-positive" : "text-sentiment-negative"
              )}
            >
              {isPositive ? "+" : ""}
              {formatMoney(netCashFlow)}
            </span>
          }
          subtitle={netSubtitle || defaultNetSubtitle}
          pill={{
            text: isPositive ? "Positive" : "Negative",
            variant: isPositive ? "positive" : "negative",
          }}
          expandedContent={
            <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
              <NetCashFlowWidget
                chartTransactions={chartTransactions}
                currentIncome={income}
                currentExpenses={expenses}
                currentNetCashFlow={netCashFlow}
                selectedMonthDate={selectedMonthDate}
              />
            </Suspense>
          }
          title="Net Cash Flow Analysis"
          description="Trends and insights about your cash flow"
          variant="flow"
        />
      </div>

      <div className="flex gap-2.5 flex-wrap text-muted-foreground text-xs pt-3">
        <span className="border border-border px-2 py-1.5 rounded-full">
          Updated: today
        </span>
        <span className="border border-border px-2 py-1.5 rounded-full">
          Period: {format(selectedMonthDate, "MMM")} 1–{format(new Date(), "MMM d")}
        </span>
      </div>
    </section>
  );
}

