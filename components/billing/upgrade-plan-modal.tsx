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

      // Check if user has an active paid subscription
      if (hasActiveSubscription) {
        // User has a paid subscription, redirect to Stripe Portal for plan changes
        const portalResponse = await fetch("/api/stripe/portal", {
          method: "POST",
        });

        const portalData = await portalResponse.json();

        if (portalData.url) {
          window.location.href = portalData.url;
        } else {
          console.error("Failed to create portal session:", portalData.error);
          alert(portalData.error || "Failed to open subscription management. Please try again.");
        }
      } else {
        // User doesn't have a paid subscription, start trial
        const trialResponse = await fetch("/api/billing/start-trial", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ planId }),
        });

        const trialData = await trialResponse.json();

        if (trialResponse.ok && trialData.success) {
          // Trial started successfully
          onOpenChange(false);
          if (onSuccess) {
            onSuccess();
          } else {
            window.location.reload();
          }
        } else {
          console.error("Failed to start trial:", trialData.error);
          alert(trialData.error || "Failed to start trial. Please try again.");
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
      <DialogContent className="sm:max-w-6xl sm:max-h-[90vh] flex flex-col !p-0 !gap-0">
        <DialogHeader>
          <DialogTitle className="text-2xl">Choose Your Plan</DialogTitle>
          <DialogDescription className="text-base">
            Select a plan to upgrade your subscription. You can change or cancel at any time.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <PlanSelector
              plans={plans}
              currentPlanId={currentPlanId}
              onSelectPlan={handleSelectPlan}
              loading={selecting}
              showComparison={false}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

