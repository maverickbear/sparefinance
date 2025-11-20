"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/components/common/money";
import { cn } from "@/lib/utils";
import type { UserServiceSubscription } from "@/lib/api/user-subscriptions-client";

interface SubscriptionsWidgetProps {
  subscriptions: UserServiceSubscription[];
}

const billingFrequencyLabels: Record<string, string> = {
  monthly: "Monthly",
  biweekly: "Biweekly",
  weekly: "Weekly",
  semimonthly: "Semimonthly",
  daily: "Daily",
};

const dayOfWeekLabels: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

export function SubscriptionsWidget({
  subscriptions,
}: SubscriptionsWidgetProps) {
  // Debug log
  if (typeof window !== 'undefined') {
    console.log('[SubscriptionsWidget] Received subscriptions:', subscriptions);
  }

  // Sort by active status first, then by service name
  const sortedSubscriptions = useMemo(() => {
    return [...subscriptions].sort((a, b) => {
      // Active subscriptions first
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }
      // Then sort by service name
      return a.serviceName.localeCompare(b.serviceName);
    });
  }, [subscriptions]);

  const activeSubscriptions = sortedSubscriptions.filter((s) => s.isActive);
  const pausedSubscriptions = sortedSubscriptions.filter((s) => !s.isActive);

  const getBillingDayLabel = (subscription: UserServiceSubscription) => {
    if (!subscription.billingDay) return null;
    
    if (subscription.billingFrequency === "monthly" || subscription.billingFrequency === "semimonthly") {
      return `Day ${subscription.billingDay}`;
    } else if (subscription.billingFrequency === "weekly" || subscription.billingFrequency === "biweekly") {
      return dayOfWeekLabels[subscription.billingDay] || `Day ${subscription.billingDay}`;
    }
    return null;
  };

  const totalMonthlyAmount = useMemo(() => {
    return sortedSubscriptions
      .filter((s) => s.isActive)
      .reduce((sum, sub) => {
        let monthlyAmount = sub.amount;
        // Convert to monthly equivalent
        switch (sub.billingFrequency) {
          case "weekly":
            monthlyAmount = sub.amount * 4.33; // Average weeks per month
            break;
          case "biweekly":
            monthlyAmount = sub.amount * 2.17; // Average biweeks per month
            break;
          case "semimonthly":
            monthlyAmount = sub.amount * 2;
            break;
          case "daily":
            monthlyAmount = sub.amount * 30; // Average days per month
            break;
          case "monthly":
          default:
            monthlyAmount = sub.amount;
            break;
        }
        return sum + monthlyAmount;
      }, 0);
  }, [sortedSubscriptions]);

  if (sortedSubscriptions.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Subscriptions</CardTitle>
          <CardDescription>Your recurring service subscriptions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              No subscriptions found
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Subscriptions</CardTitle>
            <CardDescription>
              {sortedSubscriptions.length}{" "}
              {sortedSubscriptions.length === 1
                ? "subscription"
                : "subscriptions"}
              {activeSubscriptions.length > 0 && (
                <span className="ml-2">
                  • {formatMoney(totalMonthlyAmount)}/mo
                </span>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-[600px] overflow-y-auto">
          {/* Active Subscriptions */}
          {activeSubscriptions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Active ({activeSubscriptions.length})
              </h3>
              <div className="space-y-2">
                {activeSubscriptions.map((subscription) => {
                  const frequencyLabel = billingFrequencyLabels[subscription.billingFrequency] || subscription.billingFrequency;
                  const billingDayLabel = getBillingDayLabel(subscription);

                  return (
                    <div
                      key={subscription.id}
                      className={cn(
                        "flex items-start justify-between gap-3 p-3 rounded-lg border",
                        "bg-card hover:bg-accent/50 transition-colors"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-sm font-medium text-foreground truncate">
                            {subscription.serviceName}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {frequencyLabel}
                          </Badge>
                          {billingDayLabel && (
                            <span>{billingDayLabel}</span>
                          )}
                          {subscription.subcategory && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <span className="truncate">{subscription.subcategory.name}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span className="truncate">{subscription.account?.name || "No account"}</span>
                          {subscription.description && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <span className="truncate">{subscription.description}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-base font-semibold tabular-nums text-red-600 dark:text-red-400">
                          {formatMoney(subscription.amount)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {frequencyLabel}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Paused Subscriptions */}
          {pausedSubscriptions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Paused ({pausedSubscriptions.length})
              </h3>
              <div className="space-y-2">
                {pausedSubscriptions.map((subscription) => {
                  const frequencyLabel = billingFrequencyLabels[subscription.billingFrequency] || subscription.billingFrequency;
                  const billingDayLabel = getBillingDayLabel(subscription);

                  return (
                    <div
                      key={subscription.id}
                      className={cn(
                        "flex items-start justify-between gap-3 p-3 rounded-lg border opacity-75",
                        "bg-card hover:bg-accent/50 transition-colors"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-sm font-medium text-foreground truncate">
                            {subscription.serviceName}
                          </div>
                          <Badge variant="outline" className="border-yellow-500 dark:border-yellow-400 text-yellow-600 dark:text-yellow-400 text-xs">
                            Paused
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {frequencyLabel}
                          </Badge>
                          {billingDayLabel && (
                            <span>{billingDayLabel}</span>
                          )}
                          {subscription.subcategory && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <span className="truncate">{subscription.subcategory.name}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span className="truncate">{subscription.account?.name || "No account"}</span>
                          {subscription.description && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <span className="truncate">{subscription.description}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-base font-semibold tabular-nums text-muted-foreground">
                          {formatMoney(subscription.amount)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {frequencyLabel}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

