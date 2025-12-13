"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/components/common/money";
import { format } from "date-fns";
import type { UserServiceSubscription } from "@/src/domain/subscriptions/subscriptions.types";
import type { TransactionWithRelations } from "@/src/domain/transactions/transactions.types";
import type { GoalWithCalculations } from "@/src/domain/goals/goals.types";

interface SubscriptionsRecurringGoalsWidgetProps {
  subscriptions: UserServiceSubscription[];
  recurringPayments: TransactionWithRelations[];
  goals: GoalWithCalculations[];
}

export function SubscriptionsRecurringGoalsWidget({
  subscriptions,
  recurringPayments,
  goals,
}: SubscriptionsRecurringGoalsWidgetProps) {
  // Calculate subscriptions total
  const subscriptionsTotal = useMemo(() => {
    return subscriptions.reduce((sum, sub) => {
      const amount = sub.amount || 0;
      const frequency = sub.billingFrequency || "monthly";
      
      // Convert to monthly
      let monthlyAmount = amount;
      if (frequency === "weekly") {
        monthlyAmount = amount * 4.33;
      } else if (frequency === "biweekly") {
        monthlyAmount = amount * 2.17;
      } else if (frequency === "semimonthly") {
        monthlyAmount = amount * 2;
      } else if (frequency === "daily") {
        monthlyAmount = amount * 30;
      }
      // "monthly" is already monthly, no conversion needed
      
      return sum + monthlyAmount;
    }, 0);
  }, [subscriptions]);

  // Count new subscriptions this month
  const newSubscriptionsCount = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    return subscriptions.filter(sub => {
      if (!sub.createdAt) return false;
      const created = new Date(sub.createdAt);
      return created.getMonth() === currentMonth && created.getFullYear() === currentYear;
    }).length;
  }, [subscriptions]);

  // Get last recurring payment change
  const lastRecurringChange = useMemo(() => {
    if (recurringPayments.length === 0) return null;
    
    const sorted = [...recurringPayments].sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(0);
      const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
    
    return sorted[0];
  }, [recurringPayments]);

  // Calculate goals progress
  const activeGoals = useMemo(() => {
    return goals.filter(g => !g.isCompleted && !g.isPaused);
  }, [goals]);

  const goalsProgress = useMemo(() => {
    if (activeGoals.length === 0) return null;
    
    // Find emergency fund goal
    const emergencyFund = activeGoals.find(g => 
      g.name?.toLowerCase().includes("emergency") || 
      g.name?.toLowerCase().includes("fund")
    );
    
    // Find other goals
    const otherGoals = activeGoals.filter(g => 
      !g.name?.toLowerCase().includes("emergency") && 
      !g.name?.toLowerCase().includes("fund")
    );
    
    return {
      emergencyFund: emergencyFund ? {
        name: emergencyFund.name || "Emergency fund",
        progress: emergencyFund.progressPct || 0,
      } : null,
      otherGoals: otherGoals.length > 0 ? {
        count: otherGoals.length,
        example: otherGoals[0]?.name || "Goal",
        progress: otherGoals[0]?.progressPct || 0,
      } : null,
    };
  }, [activeGoals]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Subscriptions, recurring & goals</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Subscriptions */}
          <div>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-sm font-medium text-foreground">Subscriptions</span>
              <span className="text-sm text-foreground tabular-nums">
                {formatMoney(subscriptionsTotal)} / month
              </span>
            </div>
            {newSubscriptionsCount > 0 && (
              <div className="text-xs text-muted-foreground">
                {newSubscriptionsCount} new {newSubscriptionsCount === 1 ? "subscription" : "subscriptions"} detected this month.
              </div>
            )}
          </div>

          {/* Recurring Payments */}
          <div>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-sm font-medium text-foreground">Recurring payments</span>
              <span className="text-sm text-foreground">
                {recurringPayments.length} active
              </span>
            </div>
            {lastRecurringChange && (
              <div className="text-xs text-muted-foreground">
                Last change: {lastRecurringChange.description || "Recurring payment"} updated.
              </div>
            )}
          </div>

          {/* Savings Goals */}
          <div>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-sm font-medium text-foreground">Savings goals</span>
              <span className="text-sm text-foreground">
                {activeGoals.length} in progress
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {goalsProgress?.emergencyFund && (
                <span>
                  {goalsProgress.emergencyFund.name} at {goalsProgress.emergencyFund.progress.toFixed(0)}%
                </span>
              )}
              {goalsProgress?.emergencyFund && goalsProgress?.otherGoals && " • "}
              {goalsProgress?.otherGoals && (
                <span>
                  {goalsProgress.otherGoals.example} {goalsProgress.otherGoals.progress.toFixed(0)}% funded.
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-start gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-foreground">
              Suggestion
            </span>
            <span className="text-muted-foreground flex-1">
              Cancel unused subscriptions to boost your savings rate.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

