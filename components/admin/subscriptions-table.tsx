"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Edit, Calendar } from "lucide-react";
import { format } from "date-fns";

export interface AdminSubscription {
  id: string;
  userId: string;
  planId: string;
  status: "active" | "cancelled" | "past_due" | "trialing";
  trialStartDate: string | null;
  trialEndDate: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string | null;
  plan: {
    id: string;
    name: string;
    priceMonthly: number;
    priceYearly: number;
  } | null;
}

interface SubscriptionsTableProps {
  subscriptions: AdminSubscription[];
  loading?: boolean;
  onEditTrial: (subscription: AdminSubscription) => void;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge className="bg-sentiment-positive">Active</Badge>;
    case "trialing":
      return <Badge className="bg-interactive-primary">Trialing</Badge>;
    case "cancelled":
      return <Badge variant="destructive">Cancelled</Badge>;
    case "past_due":
      return <Badge variant="destructive">Past Due</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  try {
    return format(new Date(dateString), "MMM dd, yyyy HH:mm");
  } catch {
    return dateString;
  }
}

function calculateDaysRemaining(trialEndDate: string | null | undefined): number | null {
  if (!trialEndDate) return null;
  try {
    const endDate = new Date(trialEndDate);
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  } catch {
    return null;
  }
}

export function SubscriptionsTable({
  subscriptions: initialSubscriptions,
  loading: initialLoading,
  onEditTrial,
}: SubscriptionsTableProps) {
  const subscriptions = initialSubscriptions;
  const loading = initialLoading;

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
        No subscriptions found
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User ID</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Trial Start</TableHead>
            <TableHead>Trial End</TableHead>
            <TableHead>Days Left</TableHead>
            <TableHead>Period End</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscriptions.map((subscription) => {
            const daysLeft = calculateDaysRemaining(subscription.trialEndDate);
            const isTrialing = subscription.status === "trialing";
            
            return (
              <TableRow key={subscription.id}>
                <TableCell className="font-mono text-xs">
                  {subscription.userId.substring(0, 8)}...
                </TableCell>
                <TableCell>
                  {subscription.plan ? (
                    <Badge variant="outline">{subscription.plan.name}</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {getStatusBadge(subscription.status)}
                </TableCell>
                <TableCell className="text-sm">
                  {formatDate(subscription.trialStartDate)}
                </TableCell>
                <TableCell className="text-sm">
                  {formatDate(subscription.trialEndDate)}
                </TableCell>
                <TableCell>
                  {isTrialing && daysLeft !== null ? (
                    <Badge variant={daysLeft <= 1 ? "destructive" : "secondary"}>
                      {daysLeft} days
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {formatDate(subscription.currentPeriodEnd)}
                </TableCell>
                <TableCell className="text-right">
                  {isTrialing && (
                    <Button
                      variant="ghost"
                      size="small"
                      onClick={() => onEditTrial(subscription)}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Edit Trial
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

