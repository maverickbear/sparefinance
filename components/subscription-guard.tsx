"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { PricingDialog } from "@/components/billing/pricing-dialog";
import { getLandingPlan, clearLandingPlan } from "@/lib/constants/landing-plan";

interface SubscriptionGuardProps {
  shouldOpenModal: boolean;
  reason?: "no_subscription" | "trial_expired" | "subscription_inactive";
  currentPlanId?: string;
  currentInterval?: "month" | "year" | null;
  subscriptionStatus?: "no_subscription" | "cancelled" | "past_due" | "unpaid" | null;
}

/**
 * Component that opens pricing dialog when subscription is required.
 * If user came from landing with a pre-selected plan (monthly/yearly), redirects straight to Stripe checkout.
 */
export function SubscriptionGuard({
  shouldOpenModal,
  reason,
  currentPlanId,
  currentInterval,
  subscriptionStatus: propSubscriptionStatus,
}: SubscriptionGuardProps) {
  const searchParams = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const redirectAttempted = useRef(false);

  useEffect(() => {
    // Check if modal should be opened from query params (for direct navigation)
    const openFromQuery = searchParams.get("openPricingModal") === "true";
    const trialExpired = searchParams.get("trial_expired") === "true";

    // Don't open dialog if trial expired - allow user to view system
    if (reason === "trial_expired" || trialExpired) {
      return;
    }

    // When user has no subscription and pre-selected plan on landing, redirect to Stripe once
    if (
      shouldOpenModal &&
      reason === "no_subscription" &&
      !redirectAttempted.current
    ) {
      const landing = getLandingPlan();
      if (landing?.planId && landing?.interval) {
        redirectAttempted.current = true;
        clearLandingPlan();
        fetch("/api/billing/checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: landing.planId,
            interval: landing.interval,
            returnUrl: "/subscription/success",
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.url && typeof data.url === "string") {
              window.location.href = data.url;
              return;
            }
            setDialogOpen(true);
          })
          .catch(() => setDialogOpen(true));
        return;
      }
    }

    // Open pricing dialog when layout decided (cancelled, past_due, unpaid) or URL asks for it
    if (shouldOpenModal || openFromQuery) {
      setDialogOpen(true);
    } else {
      setDialogOpen(false);
    }
  }, [shouldOpenModal, searchParams, reason, propSubscriptionStatus]);

  function handleTrialStarted() {
    // Dialog will handle page reload
    setDialogOpen(false);
  }

  return (
    <PricingDialog
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      subscriptionStatus={propSubscriptionStatus || null}
      currentPlanId={currentPlanId}
      currentInterval={currentInterval}
      onTrialStarted={handleTrialStarted}
    />
  );
}

