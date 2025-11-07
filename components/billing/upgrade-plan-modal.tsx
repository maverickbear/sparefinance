"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlanSelector } from "@/components/billing/plan-selector";
import { Plan } from "@/lib/validations/plan";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface UpgradePlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlanId?: string;
  onSuccess?: () => void;
  preloadedPlans?: Plan[];
}

export function UpgradePlanModal({ 
  open, 
  onOpenChange, 
  currentPlanId,
  onSuccess,
  preloadedPlans = []
}: UpgradePlanModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(!preloadedPlans.length);
  const [plans, setPlans] = useState<Plan[]>(preloadedPlans);
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    // If we have preloaded plans, use them immediately
    if (preloadedPlans.length > 0) {
      setPlans(preloadedPlans);
      setLoading(false);
      return;
    }

    // Otherwise, load plans when modal opens
    if (open) {
      loadPlans();
    }
  }, [open, preloadedPlans]);

  async function loadPlans() {
    try {
      setLoading(true);

      // Get plans
      const plansResponse = await fetch("/api/billing/plans");
      if (plansResponse.ok) {
        const plansData = await plansResponse.json();
        setPlans(plansData.plans);
      }
    } catch (error) {
      console.error("Error loading plans:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectPlan(planId: string, interval: "month" | "year") {
    try {
      setSelecting(true);

      // If selecting the same plan, just close the modal
      if (planId === currentPlanId) {
        onOpenChange(false);
        return;
      }

      // Check if user has an active subscription
      const subscriptionResponse = await fetch("/api/billing/subscription");
      const subscriptionData = subscriptionResponse.ok 
        ? await subscriptionResponse.json() 
        : null;

      const hasActiveSubscription = subscriptionData?.subscription?.stripeSubscriptionId;

      if (planId === "free") {
        // If user has a paid subscription, cancel it
        if (hasActiveSubscription) {
          const response = await fetch("/api/stripe/update-subscription", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ planId: "free" }),
          });

          const data = await response.json();

          if (response.ok && data.success) {
            onOpenChange(false);
            if (onSuccess) {
              onSuccess();
            } else {
              window.location.reload();
            }
          } else {
            console.error("Failed to downgrade to free plan:", data.error);
            alert(data.error || "Failed to downgrade plan. Please try again.");
          }
        } else {
          // Setup free plan directly
          const response = await fetch("/api/billing/setup-free", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });

          const data = await response.json();

          if (response.ok && data.success) {
            onOpenChange(false);
            if (onSuccess) {
              onSuccess();
            } else {
              window.location.reload();
            }
          } else {
            console.error("Failed to setup free plan:", data.error);
            alert(data.error || "Failed to setup free plan. Please try again.");
          }
        }
      } else {
        // Paid plan
        if (hasActiveSubscription) {
          // Update existing subscription
          const response = await fetch("/api/stripe/update-subscription", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ planId, interval }),
          });

          const data = await response.json();

          if (response.ok && data.success) {
            onOpenChange(false);
            if (onSuccess) {
              onSuccess();
            } else {
              window.location.reload();
            }
          } else {
            console.error("Failed to update subscription:", data.error);
            alert(data.error || "Failed to update subscription. Please try again.");
          }
        } else {
          // Create new checkout session
          const response = await fetch("/api/stripe/checkout", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ planId, interval }),
          });

          const data = await response.json();

          if (data.url) {
            // Redirect to Stripe Checkout
            window.location.href = data.url;
          } else {
            console.error("Failed to create checkout session:", data.error);
            alert("Failed to create checkout session. Please try again.");
          }
        }
      }
    } catch (error) {
      console.error("Error selecting plan:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setSelecting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Choose Your Plan</DialogTitle>
          <DialogDescription className="text-base">
            Select a plan to upgrade your subscription. You can change or cancel at any time.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="py-4">
            <PlanSelector
              plans={plans}
              currentPlanId={currentPlanId}
              onSelectPlan={handleSelectPlan}
              loading={selecting}
              showComparison={false}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

