"use client";

import { useMemo } from "react";
import { formatMoney } from "@/components/common/money";
import { SimplifiedCard } from "./simplified-card";
import { format, differenceInDays } from "date-fns";
import { calculateBudgetStatus } from "@/lib/utils/budget-utils";
import type { UpcomingTransaction } from "@/src/domain/transactions/transactions.types";
import type { BudgetWithRelations } from "@/src/domain/budgets/budgets.types";
import type { FinancialHealthData } from "@/src/application/shared/financial-health";

interface PlanningSectionProps {
  upcomingTransactions: UpcomingTransaction[];
  budgets: BudgetWithRelations[];
  financialHealth: FinancialHealthData | null;
}

export function PlanningSection({
  upcomingTransactions,
  budgets,
  financialHealth,
}: PlanningSectionProps) {
  // Calculate upcoming payments total and next payment
  const upcomingPaymentsData = useMemo(() => {
    const expenses = upcomingTransactions.filter((t) => t.type === "expense");
    const total = expenses.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
    
    // Find next payment
    const sorted = [...expenses].sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date);
      const dateB = b.date instanceof Date ? b.date : new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });
    
    const nextPayment = sorted[0];
    let nextPaymentText = "No upcoming payments";
    let daysUntil = null;
    
    if (nextPayment) {
      const nextDate = nextPayment.date instanceof Date 
        ? nextPayment.date 
        : new Date(nextPayment.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      nextDate.setHours(0, 0, 0, 0);
      
      daysUntil = differenceInDays(nextDate, today);
      const amount = formatMoney(Math.abs(nextPayment.amount || 0));
      const description = nextPayment.description || 
        nextPayment.category?.name || 
        nextPayment.subcategory?.name || 
        "Payment";
      
      if (daysUntil === 0) {
        nextPaymentText = `Today: ${description} (${amount})`;
      } else if (daysUntil === 1) {
        nextPaymentText = `Tomorrow: ${description} (${amount})`;
      } else if (daysUntil > 0) {
        nextPaymentText = `${description} (${amount}) due in ${daysUntil} days.`;
      } else {
        nextPaymentText = `${description} (${amount}) was due ${Math.abs(daysUntil)} days ago.`;
      }
    }
    
    return {
      total,
      count: expenses.length,
      nextPayment: nextPaymentText,
    };
  }, [upcomingTransactions]);

  // Calculate budget status
  const budgetStatus = useMemo(() => {
    const budgetsWithStatus = budgets.map((budget) => {
      const actualSpend = budget.actualSpend || 0;
      const amount = budget.amount || 0;
      const { status } = calculateBudgetStatus(amount, actualSpend);
      return status;
    });
    
    const overCount = budgetsWithStatus.filter((s) => s === "over").length;
    const warningCount = budgetsWithStatus.filter((s) => s === "warning").length;
    const totalAtRisk = overCount + warningCount;
    
    // Get names of over/warning budgets
    const atRiskBudgets = budgets
      .map((budget, idx) => ({
        name: budget.displayName || budget.category?.name || "Unknown",
        status: budgetsWithStatus[idx],
      }))
      .filter((b) => b.status === "over" || b.status === "warning")
      .slice(0, 2)
      .map((b) => b.name);
    
    let subtitle = "All budgets are on track.";
    if (totalAtRisk > 0) {
      if (atRiskBudgets.length > 0) {
        subtitle = `${atRiskBudgets.join(" and ")} ${atRiskBudgets.length === 1 ? "is" : "are"} trending high.`;
      } else {
        subtitle = `${totalAtRisk} ${totalAtRisk === 1 ? "budget is" : "budgets are"} trending high.`;
      }
    }
    
    return {
      overCount,
      warningCount,
      totalAtRisk,
      subtitle,
    };
  }, [budgets]);

  // Get emergency fund months
  const emergencyFundMonths = financialHealth?.emergencyFundMonths ?? 0;
  const recommendedMonths = 6;
  
  const getEmergencyFundLabel = (months: number): { text: string; variant: "default" | "positive" | "warning" | "negative" } => {
    if (months >= recommendedMonths) return { text: "Stable", variant: "positive" };
    if (months >= recommendedMonths / 2) return { text: "Moderate", variant: "default" };
    if (months > 0) return { text: "Low", variant: "warning" };
    return { text: "None", variant: "negative" };
  };

  const emergencyFundLabel = getEmergencyFundLabel(emergencyFundMonths);

  return (
    <section
      className="rounded-[var(--radius)] p-0 mt-3.5"
      aria-label="Planning and risk"
    >
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="m-0 text-2xl font-semibold text-foreground">
          What's coming up
        </h2>
        <div className="text-muted-foreground text-xs">Next 30 days</div>
      </div>

      <div className="grid gap-3.5 grid-cols-1 md:grid-cols-3">
        <SimplifiedCard
          label="Upcoming payments"
          value={formatMoney(upcomingPaymentsData.total)}
          subtitle={upcomingPaymentsData.nextPayment}
          pill={{ 
            text: `${upcomingPaymentsData.count} ${upcomingPaymentsData.count === 1 ? "item" : "items"}` 
          }}
        />

        <SimplifiedCard
          label="Budget status"
          value={budgetStatus.totalAtRisk > 0 ? `${budgetStatus.totalAtRisk} over` : "On track"}
          subtitle={budgetStatus.subtitle}
          pill={budgetStatus.totalAtRisk > 0 ? { text: "Warning", variant: "warning" } : { text: "Good", variant: "positive" }}
        />

        <SimplifiedCard
          label="Emergency fund"
          value={`${emergencyFundMonths.toFixed(1)} mo`}
          subtitle={`Goal: ${recommendedMonths}–${recommendedMonths + 2} months coverage.`}
          pill={emergencyFundLabel}
        />
      </div>
    </section>
  );
}

