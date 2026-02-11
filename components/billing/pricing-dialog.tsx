"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProUpgradeDialog } from "@/components/billing/pro-upgrade-dialog";
import { useToast } from "@/components/toast-provider";
import { CheckCircle2, Loader2, RotateCcw, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

export type PricingDialogSubscriptionStatus = "no_subscription" | "cancelled" | "past_due" | "unpaid" | null;

interface PricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionStatus?: PricingDialogSubscriptionStatus;
  currentPlanId?: string;
  currentInterval?: "month" | "year" | null;
  onTrialStarted?: () => void;
}

export function PricingDialog({
  open,
  onOpenChange,
  subscriptionStatus,
  currentPlanId,
  currentInterval,
  onTrialStarted,
}: PricingDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [trialStarted, setTrialStarted] = useState(false);
  const [showPlanSelector, setShowPlanSelector] = useState(false);

  const needsReactivation = subscriptionStatus === "cancelled" || subscriptionStatus === "past_due" || subscriptionStatus === "unpaid";
  const showProUpgradeDialog = !subscriptionStatus || subscriptionStatus === "no_subscription" || showPlanSelector;
  const canClose = false; // Legacy dialog: cannot close until user subscribes or reactivates

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setTrialStarted(false);
      setShowPlanSelector(false);
    }
  }, [open]);

  async function handleSelectPlan(planId: string, interval: "month" | "year") {
    setLoading(true);
    try {
      const response = await fetch("/api/billing/checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId, interval }),
      });

      const data = await response.json();

      if (response.ok && data.url) {
        window.location.href = data.url;
        return;
      }

      toast({
        title: "Error",
        description: data.error || "Failed to start checkout",
        variant: "destructive",
      });
    } catch (error) {
      console.error("Error starting checkout:", error);
      toast({
        title: "Error",
        description: "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleManageSubscription() {
    setPortalLoading(true);
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await response.json();
      if (response.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      toast({
        title: "Error",
        description: data.error || "Failed to open subscription management",
        variant: "destructive",
      });
    } catch (error) {
      console.error("Error opening portal:", error);
      toast({
        title: "Error",
        description: "Failed to open subscription management. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPortalLoading(false);
    }
  }

  function handleClose(open: boolean) {
    // Allow close only when user clicks "Get Started" after trial started; otherwise block
    if (trialStarted || !open) {
      onOpenChange(open);
    }
  }

  const getReactivationTitle = () => {
    if (subscriptionStatus === "cancelled") return "Reactivate your subscription";
    if (subscriptionStatus === "past_due") return "Payment past due";
    if (subscriptionStatus === "unpaid") return "Payment required";
    return "Subscription action needed";
  };

  const getReactivationDescription = () => {
    if (subscriptionStatus === "cancelled") {
      return "Your subscription has been cancelled. Reactivate it to regain full access, or choose a new plan below.";
    }
    if (subscriptionStatus === "past_due") {
      return "Your payment is past due. Update your payment method to avoid losing access, or choose a new plan.";
    }
    if (subscriptionStatus === "unpaid") {
      return "Your subscription is unpaid. Update your payment method to continue, or choose a new plan below.";
    }
    return "";
  };

  // Custom two-column upgrade dialog (no plan or "choose new plan" from reactivation)
  if (showProUpgradeDialog && !trialStarted) {
    return (
      <ProUpgradeDialog
        open={open}
        onOpenChange={onOpenChange}
        subscriptionStatus={subscriptionStatus ?? "no_subscription"}
        currentPlanId={currentPlanId}
        currentInterval={currentInterval}
        onSelectPlan={handleSelectPlan}
        onManageSubscription={handleManageSubscription}
        canClose={needsReactivation}
        loading={loading}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-4xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => {
          if (!canClose) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (!canClose) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {trialStarted ? "Trial Active!" : getReactivationTitle()}
          </DialogTitle>
          <DialogDescription>
            {trialStarted
              ? "Your 30-day free trial has been activated. Enjoy full access to all features!"
              : getReactivationDescription()}
          </DialogDescription>
        </DialogHeader>

        {trialStarted ? (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
            <h3 className="text-2xl font-semibold mb-2">Trial Active!</h3>
            <p className="text-muted-foreground text-center mb-6">
              Your 30-day free trial has started. You now have full access to all features.
            </p>
            <Button onClick={() => handleClose(false)}>Get Started</Button>
          </div>
        ) : (
          <div className="flex flex-col items-center py-8 px-4 gap-6">
            <Button
              onClick={handleManageSubscription}
              disabled={portalLoading}
              size="large"
              className="w-full sm:w-auto"
            >
              {portalLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading...
                </>
              ) : subscriptionStatus === "past_due" || subscriptionStatus === "unpaid" ? (
                <>
                  <CreditCard className="mr-2 h-5 w-5" />
                  Update payment method
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-5 w-5" />
                  Manage subscription
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPlanSelector(true)}
              className="text-muted-foreground"
            >
              Choose a new plan instead
            </Button>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Starting your trial...</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

