"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlanBadge } from "@/components/common/plan-badge";
import { Subscription, Plan } from "@/src/domain/subscriptions/subscriptions.validations";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";

interface UserHouseholdInfo {
  isOwner: boolean;
  isMember: boolean;
  ownerId?: string;
  ownerName?: string;
}

interface SubscriptionCardProps {
  subscription: Subscription | null;
  plan: Plan | null;
  onSubscriptionUpdated?: () => void;
}

export function SubscriptionCard({ subscription, plan, onSubscriptionUpdated }: SubscriptionCardProps) {
  const [loading, setLoading] = useState(false);
  const [householdInfo, setHouseholdInfo] = useState<UserHouseholdInfo | null>(null);

  useEffect(() => {
    async function loadHouseholdInfo() {
      try {
        const response = await fetch("/api/household/info");
        if (response.ok) {
          const data = await response.json();
          setHouseholdInfo(data);
        }
      } catch (error) {
        console.error("Error loading household info:", error);
      }
    }

    loadHouseholdInfo();
  }, []);

  async function handleManageSubscription() {
    try {
      setLoading(true);
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      });

      const data = await response.json();

      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        console.error("Failed to create portal session:", data.error);
      }
    } catch (error) {
      console.error("Error opening portal:", error);
    } finally {
      setLoading(false);
    }
  }

  if (!subscription || !plan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Active Subscription</CardTitle>
          <CardDescription>Please select a plan to continue</CardDescription>
        </CardHeader>
      </Card>
    );
  }
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
              <PlanBadge plan={plan.name as "essential" | "pro"} />
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
        {(subscription.currentPeriodEnd || subscription.trialEndDate) && (
          <div>
            <p className="text-sm text-muted-foreground">
              {subscription.status === "trialing"
                ? "Your trial period ends in"
                : "Current period ends"}
            </p>
            <p className="font-medium">
              {format(
                new Date(
                  subscription.status === "trialing" && subscription.trialEndDate
                    ? subscription.trialEndDate
                    : subscription.currentPeriodEnd!
                ),
                "PPP"
              )}
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

        {householdInfo?.isMember && !householdInfo?.isOwner && (
          <Alert>
            <AlertDescription>
              {householdInfo.ownerName 
                ? `You are viewing the subscription managed by ${householdInfo.ownerName}. Only the account owner can manage the subscription.`
                : "You are viewing the subscription as a household member. Only the account owner can manage the subscription."}
            </AlertDescription>
          </Alert>
        )}

        {(!householdInfo?.isMember || householdInfo?.isOwner) && (
          <Button onClick={handleManageSubscription} disabled={loading} className="w-full">
            {loading ? "Loading..." : "Manage Subscription"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

