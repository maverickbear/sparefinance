"use client";

import { formatMoney } from "@/components/common/money";
import { FlowNode } from "./flow-node";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface CashFlowSectionProps {
  income: number;
  expenses: number;
  netCashFlow: number;
  selectedMonthDate: Date;
  incomeSubtitle?: string;
  expensesSubtitle?: string;
  netSubtitle?: string;
}

export function CashFlowSection({
  income,
  expenses,
  netCashFlow,
  selectedMonthDate,
  incomeSubtitle = "Includes paychecks and transfers in.",
  expensesSubtitle = "Spending + bills paid so far.",
  netSubtitle,
}: CashFlowSectionProps) {
  const isPositive = netCashFlow >= 0;
  const defaultNetSubtitle = isPositive
    ? "You're ahead this month."
    : "You're behind this month.";

  return (
    <section
      className="rounded-[var(--radius)] p-0 mt-3.5"
      aria-label="Cash flow"
    >
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="m-0 text-2xl font-semibold text-foreground">
          What's happening this month
        </h2>
        <div className="text-muted-foreground text-xs">
          Income → Expenses → Result
        </div>
      </div>

      <div className="grid gap-2.5 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
        <FlowNode
          label="Income"
          value={formatMoney(income)}
          subtitle={incomeSubtitle}
          pill={{ text: "MTD" }}
        />

        <div className="hidden md:grid text-muted-foreground text-xs justify-center select-none font-mono">
          →
        </div>

        <FlowNode
          label="Expenses"
          value={formatMoney(expenses)}
          subtitle={expensesSubtitle}
          pill={{ text: "MTD" }}
        />

        <div className="hidden md:grid text-muted-foreground text-xs justify-center select-none font-mono">
          →
        </div>

        <FlowNode
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
        />
      </div>

      <div className="flex gap-2.5 flex-wrap text-muted-foreground text-xs pt-3">
        <span className="border border-border px-2 py-1.5 rounded-full">
          Updated: today
        </span>
        <span className="border border-border px-2 py-1.5 rounded-full">
          Period: {format(selectedMonthDate, "MMM")} 1–{format(new Date(), "MMM d")}
        </span>
        <span className="underline underline-offset-[2px] cursor-pointer text-foreground flex flex-col justify-center items-start">
          View details
        </span>
      </div>
    </section>
  );
}

