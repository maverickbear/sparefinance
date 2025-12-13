"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { formatMoney } from "@/components/common/money";

interface UserSubscription {
  id: string;
  serviceName: string;
  amount: number;
  description: string | null;
  billingFrequency: "monthly" | "weekly" | "biweekly" | "semimonthly" | "daily";
  billingDay: number | null;
  isActive: boolean;
  firstBillingDate: string;
  createdAt: string;
  User: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  Account: {
    id: string;
    name: string;
  } | null;
  Subcategory: {
    id: string;
    name: string;
    logo: string | null;
  } | null;
  serviceLogo?: string | null; // Logo from SubscriptionService table
}

interface UserSubscriptionsTableProps {
  subscriptions: UserSubscription[];
  loading?: boolean;
}

export function UserSubscriptionsTable({
  subscriptions,
  loading,
}: UserSubscriptionsTableProps) {
  const billingFrequencyLabels: Record<string, string> = {
    monthly: "Monthly",
    biweekly: "Biweekly",
    weekly: "Weekly",
    semimonthly: "Semimonthly",
    daily: "Daily",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No user subscriptions found
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Frequency</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>First Billing</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscriptions.map((subscription) => {
            const frequencyLabel = billingFrequencyLabels[subscription.billingFrequency] || subscription.billingFrequency;
            
            return (
              <TableRow key={subscription.id} className={!subscription.isActive ? "opacity-75" : ""}>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{subscription.User?.name || "N/A"}</span>
                    <span className="text-xs text-muted-foreground">{subscription.User?.email || "N/A"}</span>
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {subscription.serviceLogo && (
                      <img
                        src={subscription.serviceLogo}
                        alt={subscription.serviceName}
                        className="h-6 w-6 object-contain rounded flex-shrink-0"
                        onError={(e) => {
                          // Hide image if it fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="truncate">{subscription.serviceName}</span>
                      {subscription.description && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {subscription.description}
                        </span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-semibold">
                  {formatMoney(subscription.amount)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {frequencyLabel}
                    {subscription.billingDay && ` - Day ${subscription.billingDay}`}
                  </Badge>
                </TableCell>
                <TableCell>
                  {subscription.Account?.name || "N/A"}
                </TableCell>
                <TableCell>
                  {subscription.Subcategory?.name || "—"}
                </TableCell>
                <TableCell>
                  {subscription.isActive ? (
                    <Badge variant="outline" className="border-green-500 dark:border-green-400 text-green-600 dark:text-green-400">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-sentiment-warning dark:border-sentiment-warning text-sentiment-warning dark:text-sentiment-warning">
                      Paused
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {(() => {
                    if (!subscription.firstBillingDate) return "—";
                    const date = new Date(subscription.firstBillingDate);
                    return isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
                  })()}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(subscription.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

