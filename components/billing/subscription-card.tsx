"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlanBadge } from "@/components/common/plan-badge";
import { Subscription, Plan } from "@/lib/validations/plan";
import { format } from "date-fns";
import { useState } from "react";
import { ManageSubscriptionModal } from "@/components/billing/manage-subscription-modal";

interface SubscriptionCardProps {
  subscription: Subscription | null;
  plan: Plan | null;
  onSubscriptionUpdated?: () => void;
}

export function SubscriptionCard({ subscription, plan, onSubscriptionUpdated }: SubscriptionCardProps) {
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  function handleManageSubscription() {
    setModalOpen(true);
  }

  if (!subscription || !plan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Active Subscription</CardTitle>
          <CardDescription>You're currently on the free plan</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const isFree = plan.name === "free";
  const price = subscription.currentPeriodStart && subscription.currentPeriodEnd
    ? plan.priceMonthly
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Current Plan
              <PlanBadge plan={plan.name} />
            </CardTitle>
            <CardDescription className="mt-1">
              {plan.name.charAt(0).toUpperCase() + plan.name.slice(1)} plan
            </CardDescription>
          </div>
          {price > 0 && (
            <div className="text-right">
              <div className="text-2xl font-bold">${price.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">per month</div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {subscription.currentPeriodEnd && (
          <div>
            <p className="text-sm text-muted-foreground">Current period ends</p>
            <p className="font-medium">
              {format(new Date(subscription.currentPeriodEnd), "PPP")}
            </p>
          </div>
        )}

        {subscription.cancelAtPeriodEnd && (
          <div className="rounded-[12px] bg-yellow-50 dark:bg-yellow-900/20 p-3 text-sm text-yellow-800 dark:text-yellow-200">
            Your subscription will be cancelled at the end of the current period.
          </div>
        )}

        {subscription.status === "past_due" && (
          <div className="rounded-[12px] bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-200">
            Your subscription payment failed. Please update your payment method.
          </div>
        )}

        {!isFree && (
          <Button onClick={handleManageSubscription} disabled={loading} className="w-full">
            {loading ? "Loading..." : "Manage Subscription"}
          </Button>
        )}
      </CardContent>

      {!isFree && (
        <ManageSubscriptionModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          subscription={subscription}
          plan={plan}
          onSubscriptionUpdated={onSubscriptionUpdated}
        />
      )}
    </Card>
  );
}

