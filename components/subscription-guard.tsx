"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

interface SubscriptionGuardProps {
  shouldOpenModal: boolean;
  reason?: "no_subscription" | "trial_expired" | "subscription_inactive";
}

/**
 * Component that redirects to pricing page when subscription is required
 */
export function SubscriptionGuard({ 
  shouldOpenModal, 
  reason 
}: SubscriptionGuardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if modal should be opened from query params (for direct navigation)
    const openFromQuery = searchParams.get("openPricingModal") === "true";
    const trialExpired = searchParams.get("trial_expired") === "true";

    // Don't redirect if trial expired - allow user to view system
    if (reason === "trial_expired" || trialExpired) {
      return;
    }

    if (shouldOpenModal || openFromQuery) {
      router.push("/pricing");
    }
  }, [shouldOpenModal, router, searchParams, reason]);

  return null;
}

