"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlanSelector } from "@/components/billing/plan-selector";
import { Plan, Subscription } from "@/lib/validations/plan";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface ManageSubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: Subscription | null;
  plan: Plan | null;
  onSubscriptionUpdated?: () => void;
}

export function ManageSubscriptionModal({
  open,
  onOpenChange,
  subscription,
  plan,
  onSubscriptionUpdated,
}: ManageSubscriptionModalProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState<string | undefined>();

  useEffect(() => {
    if (open) {
      loadPlans();
    }
  }, [open]);

  useEffect(() => {
    if (plan) {
      setCurrentPlanId(plan.id);
    }
  }, [plan]);

  async function loadPlans() {
    try {
      setLoading(true);
      const response = await fetch("/api/billing/plans");
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans);
        if (data.currentPlanId) {
          setCurrentPlanId(data.currentPlanId);
        }
      }
    } catch (error) {
      console.error("Error loading plans:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectPlan(planId: string, interval: "month" | "year") {
    if (!subscription || !plan) {
      return;
    }

    // If selecting the same plan, do nothing
    if (planId === plan.id) {
      return;
    }

    try {
      setSelecting(true);
      setError(null);
      setSuccess(null);

      // If downgrading to free, use the update subscription API
      if (planId === "free") {
        const response = await fetch("/api/stripe/update-subscription", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ planId, interval }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setSuccess(data.message || "Subscription will be cancelled at the end of the current period");
          // Reload subscription data
          if (onSubscriptionUpdated) {
            onSubscriptionUpdated();
          }
          // Close modal after a short delay
          setTimeout(() => {
            onOpenChange(false);
          }, 2000);
        } else {
          setError(data.error || "Failed to update subscription");
        }
        return;
      }

      // For upgrades or changes to other paid plans
      const response = await fetch("/api/stripe/update-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId, interval }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(data.message || "Subscription updated successfully");
        // Reload subscription data
        if (onSubscriptionUpdated) {
          onSubscriptionUpdated();
        }
        // Close modal after a short delay
        setTimeout(() => {
          onOpenChange(false);
        }, 2000);
      } else {
        setError(data.error || "Failed to update subscription");
      }
    } catch (error) {
      console.error("Error selecting plan:", error);
      setError("An error occurred. Please try again.");
    } finally {
      setSelecting(false);
    }
  }

  async function handleCancelSubscription() {
    try {
      setLoading(true);
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Failed to create portal session");
      }
    } catch (error) {
      console.error("Error opening portal:", error);
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!subscription || !plan) {
    return null;
  }

  const isFree = plan.name === "free";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Subscription</DialogTitle>
          <DialogDescription>
            Upgrade, downgrade, or cancel your subscription
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Subscription Info */}
          <div className="rounded-[12px] border p-4 bg-muted/50">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Current Plan</p>
                  <p className="text-2xl font-bold capitalize">{plan.name}</p>
                </div>
                {subscription.currentPeriodEnd && (
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Current period ends</p>
                    <p className="font-medium">
                      {format(new Date(subscription.currentPeriodEnd), "PPP")}
                    </p>
                  </div>
                )}
              </div>
              {subscription.cancelAtPeriodEnd && (
                <div className="rounded-[12px] bg-yellow-50 dark:bg-yellow-900/20 p-3 text-sm text-yellow-800 dark:text-yellow-200 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Subscription will be cancelled</p>
                    <p className="text-xs mt-1">
                      Your subscription will be cancelled at the end of the current period on{" "}
                      {subscription.currentPeriodEnd 
                        ? format(new Date(subscription.currentPeriodEnd), "PPP")
                        : "the end of the billing cycle"}.
                      After that, you'll be moved to the Free plan.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Success Message */}
          {success && (
            <div className="rounded-[12px] bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-800 dark:text-green-200 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>{success}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-[12px] bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-200 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Plan Selector */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading plans...
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-semibold mb-4">Change Plan</h3>
              <PlanSelector
                plans={plans}
                currentPlanId={currentPlanId}
                onSelectPlan={handleSelectPlan}
                loading={selecting}
                showComparison={false}
              />
            </div>
          )}

          {/* Important Notes */}
          <div className="rounded-[12px] bg-blue-50 dark:bg-blue-900/20 p-4 text-sm text-blue-800 dark:text-blue-200 space-y-2">
            <p className="font-medium">Important Information:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <strong>Upgrades:</strong> Changes take effect immediately. You'll be charged a prorated amount.
              </li>
              <li>
                <strong>Downgrades:</strong> Changes will take effect at the end of your current billing period. 
                You'll continue to have access to your current plan features until then.
              </li>
              <li>
                <strong>Cancellation:</strong> Your subscription will remain active until the end of the current period. 
                After that, you'll be moved to the Free plan.
              </li>
            </ul>
          </div>

          {/* Cancel Subscription Button */}
          {!isFree && (
            <div className="pt-4 border-t">
              <Button
                variant="destructive"
                onClick={handleCancelSubscription}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Loading..." : "Cancel Subscription"}
              </Button>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                You'll be redirected to Stripe to manage your cancellation
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

