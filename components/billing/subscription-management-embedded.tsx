"use client";

import { useState, useEffect } from "react";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Subscription, Plan } from "@/src/domain/subscriptions/subscriptions.validations";
import { format } from "date-fns";
import { CreditCard, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";
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

interface SubscriptionManagementEmbeddedProps {
  subscription: Subscription | null;
  plan: Plan | null;
  interval?: "month" | "year" | null;
  householdInfo?: UserHouseholdInfo | null;
  onSubscriptionUpdated?: () => void;
}

export function SubscriptionManagementEmbedded({
  subscription,
  plan,
  interval,
  householdInfo: initialHouseholdInfo,
  onSubscriptionUpdated,
}: SubscriptionManagementEmbeddedProps) {
  const breakpoint = useBreakpoint();
  const isMobile = !breakpoint || breakpoint === "xs" || breakpoint === "sm" || breakpoint === "md";
  const [loading, setLoading] = useState(false);
  const [householdInfo, setHouseholdInfo] = useState<UserHouseholdInfo | null>(initialHouseholdInfo ?? null);
  const { toast } = useToast();

  useEffect(() => {
    if (initialHouseholdInfo !== undefined) {
      setHouseholdInfo(initialHouseholdInfo);
      return;
    }
    
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
  }, [initialHouseholdInfo]);

  async function handleOpenStripePortal() {
    try {
      setLoading(true);
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      });

      const data = await response.json();

      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to open Stripe portal",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error opening portal:", error);
      toast({
        title: "Error",
        description: "Failed to open Stripe portal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  if (!subscription || !plan) {
    return (
      <Card className="border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscription
          </CardTitle>
          <CardDescription>You don't have an active subscription. Please select a plan to continue.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const price = subscription.currentPeriodStart && subscription.currentPeriodEnd
    ? (interval === "year" ? plan.priceYearly / 12 : plan.priceMonthly)
    : 0;
  const isCancelled = subscription.cancelAtPeriodEnd || subscription.status === "cancelled";
  const isFullyCancelled = subscription.status === "cancelled";

  return (
    <>
      <Card className="border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {plan.name.charAt(0).toUpperCase() + plan.name.slice(1)} Plan
              </CardTitle>
              <CardDescription className="mt-1">
                {interval === "year" 
                  ? "Yearly Subscription"
                  : interval === "month"
                  ? "Monthly Subscription"
                  : "Subscription"}
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
          {(() => {
            let dateToShow: Date | null = null;
            let label = "";
            let isValidDate = false;

            if (subscription.status === "trialing" && subscription.trialEndDate) {
              dateToShow = new Date(subscription.trialEndDate);
              label = "Your trial period ends on";
              isValidDate = !isNaN(dateToShow.getTime()) && dateToShow.getFullYear() > 1970;
            } else if (subscription.currentPeriodEnd) {
              dateToShow = new Date(subscription.currentPeriodEnd);
              isValidDate = !isNaN(dateToShow.getTime()) && dateToShow.getFullYear() > 1970;
              
              if (isValidDate) {
                if (isFullyCancelled) {
                  label = "Access ended on";
                } else if (isCancelled) {
                  label = "Subscription ends on";
                } else {
                  label = "Renews on";
                }
              }
            }

            if (dateToShow && isValidDate) {
              return (
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="font-medium">
                    {format(dateToShow, "PPP")}
                  </p>
                </div>
              );
            }

            if (isFullyCancelled) {
              return (
                <div>
                  <p className="text-sm text-muted-foreground">Subscription Status</p>
                  <p className="font-medium text-muted-foreground">Cancelled</p>
                </div>
              );
            }

            return null;
          })()}

          {isCancelled && (
            <Alert variant={isFullyCancelled ? "default" : "destructive"}>
              <AlertDescription>
                {isFullyCancelled ? (
                  <>
                    <strong>Subscription Cancelled:</strong> Your subscription is cancelled. You can still view your data, but you cannot add, edit, or remove information. To reactivate your subscription and regain full functionality, click the button below.
                  </>
                ) : (
                  <>
                    <strong>Subscription Will Be Cancelled:</strong> Your subscription will be cancelled on{" "}
                    {subscription.currentPeriodEnd
                      ? format(new Date(subscription.currentPeriodEnd), "PPP")
                      : "the end of your billing period"}
                    . You can reactivate it anytime.
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          {subscription.status === "past_due" && (
            <Alert variant="destructive">
              <AlertDescription>
                <strong>Payment Failed:</strong> Please update your payment method to continue using the service.
              </AlertDescription>
            </Alert>
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
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleOpenStripePortal}
                disabled={loading}
                variant="outline"
                size={isMobile ? "small" : "medium"}
                className="w-full md:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Manage Subscription
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

