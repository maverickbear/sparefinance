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

  console.log("[SUBSCRIPTION-GUARD] Component rendered:", { 
    shouldOpenModal, 
    reason
  });

  useEffect(() => {
    console.log("[SUBSCRIPTION-GUARD] useEffect triggered:", { 
      shouldOpenModal, 
      reason 
    });
    
    // Check if modal should be opened from query params (for direct navigation)
    const openFromQuery = searchParams.get("openPricingModal") === "true";
    const trialExpired = searchParams.get("trial_expired") === "true";

    console.log("[SUBSCRIPTION-GUARD] Conditions check:", { 
      shouldOpenModal, 
      openFromQuery, 
      trialExpired
    });

    // Don't redirect if trial expired - allow user to view system
    if (reason === "trial_expired" || trialExpired) {
      console.log("[SUBSCRIPTION-GUARD] Trial expired - not redirecting, allowing user to view system");
      return;
    }

    if (shouldOpenModal || openFromQuery) {
      console.log("[SUBSCRIPTION-GUARD] Redirecting to pricing page:", { 
        shouldOpenModal, 
        openFromQuery, 
        reason 
      });
      
      router.push("/pricing");
    } else {
      console.log("[SUBSCRIPTION-GUARD] No redirect needed - conditions not met");
    }
  }, [shouldOpenModal, router, searchParams, reason]);

  return null;
}

