"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/components/common/money";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export function SubscriptionsWidget({
  subscriptions,
}: SubscriptionsWidgetProps) {
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
        <div className="max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Service</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSubscriptions.map((subscription) => {
                  const frequencyLabel = billingFrequencyLabels[subscription.billingFrequency] || subscription.billingFrequency;

                  return (
                    <TableRow
                      key={subscription.id}
                      className={cn(
                        !subscription.isActive && "opacity-75"
                      )}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {subscription.serviceLogo && (
                            <img
                              src={subscription.serviceLogo}
                              alt={subscription.serviceName}
                              className="h-6 w-6 object-contain rounded flex-shrink-0"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          )}
                          <div className="flex flex-col min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">
                              {subscription.serviceName}
                            </div>
                            {subscription.description && (
                              <div className="text-xs text-muted-foreground truncate">
                                {subscription.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {frequencyLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {subscription.plan ? (
                          <span className="text-sm text-muted-foreground">
                            {subscription.plan.planName}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-sm font-semibold tabular-nums">
                          <span className={cn(
                            subscription.isActive 
                              ? "text-red-600 dark:text-red-400" 
                              : "text-muted-foreground"
                          )}>
                            {formatMoney(subscription.amount)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

