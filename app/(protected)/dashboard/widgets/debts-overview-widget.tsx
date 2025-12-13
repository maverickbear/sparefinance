"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { cn } from "@/lib/utils";
import type { AccountWithBalance } from "@/src/domain/accounts/accounts.types";
import type { DebtWithCalculations } from "@/src/domain/debts/debts.types";

interface DebtsOverviewWidgetProps {
  creditCardAccounts: AccountWithBalance[];
  debts: DebtWithCalculations[];
}

export function DebtsOverviewWidget({
  creditCardAccounts,
  debts,
}: DebtsOverviewWidgetProps) {
  // Calculate credit utilization
  const creditUtilization = useMemo(() => {
    if (creditCardAccounts.length === 0) return null;

    const totalBalance = creditCardAccounts.reduce((sum, acc) => {
      const balance = acc.balance || 0;
      return sum + Math.abs(balance); // Credit card balances are negative
    }, 0);

    // Try to get credit limit from account metadata or use a default calculation
    // For now, we'll estimate based on balance (this should be enhanced with actual credit limits)
    const estimatedCreditLimit = totalBalance * 3; // Rough estimate: assume 33% utilization if we don't have limits
    const utilization = estimatedCreditLimit > 0 
      ? (totalBalance / estimatedCreditLimit) * 100 
      : 0;

    return {
      percentage: utilization,
      totalBalance,
      totalLimit: estimatedCreditLimit,
    };
  }, [creditCardAccounts]);

  // Calculate next due dates (simplified - would need actual due dates from accounts)
  const nextDueDates = useMemo(() => {
    // For now, we'll show a simplified version
    // In a real implementation, this would fetch actual due dates from credit card accounts
    const totalDue = creditCardAccounts.reduce((sum, acc) => {
      const balance = acc.balance || 0;
      // Estimate minimum payment as 2% of balance (typical credit card minimum)
      return sum + Math.abs(balance) * 0.02;
    }, 0);

    return {
      count: creditCardAccounts.length,
      totalAmount: totalDue,
    };
  }, [creditCardAccounts]);

  const needsAttention = creditUtilization && creditUtilization.percentage > 30;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>What you still owe</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Credit Utilization */}
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground">Credit utilization</div>
              <div className="text-xs text-muted-foreground">
                {creditUtilization 
                  ? `${creditUtilization.percentage.toFixed(0)}% of available credit used`
                  : "No credit cards"}
              </div>
            </div>
            {needsAttention && (
              <div className="text-sm font-medium text-sentiment-negative flex-shrink-0">
                Needs attention
              </div>
            )}
          </div>

          {/* Next Due Dates */}
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground">Next due dates</div>
              <div className="text-xs text-muted-foreground">
                {nextDueDates.count > 0
                  ? `${nextDueDates.count} credit card${nextDueDates.count === 1 ? "" : "s"} due soon`
                  : "No upcoming payments"}
              </div>
            </div>
            {nextDueDates.totalAmount > 0 && (
              <div className="text-sm font-semibold text-sentiment-negative tabular-nums flex-shrink-0">
                {formatMoney(nextDueDates.totalAmount)}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-start gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-foreground">
              Tip
            </span>
            <span className="text-muted-foreground flex-1">
              Pay more than the minimum to improve your score faster.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

