"use client";

import { useState, useEffect } from "react";
import { SimplifiedOnboardingDialog } from "./simplified-onboarding-dialog";
import { useSubscriptionContext } from "@/contexts/subscription-context";

interface OnboardingDialogWrapperProps {
  /**
   * Whether the onboarding dialog should be shown
   * This is calculated on the server using OnboardingDecisionService
   * Single source of truth for this decision
   */
  shouldShow: boolean;
  /**
   * Initial onboarding status for display purposes
   * Used to show progress in the dialog
   */
  initialStatus?: {
    hasPersonalData: boolean;
    hasExpectedIncome: boolean;
    hasPlan: boolean;
    completedCount: number;
    totalCount: number;
  };
}

/**
 * OnboardingDialogWrapper
 * 
 * Pure presentation component - no business logic
 * All decisions are made on the server via OnboardingDecisionService
 * 
 * Responsibilities:
 * - Render dialog based on shouldShow prop
 * - Handle dialog open/close state
 * - Trigger subscription refresh on completion
 */
export function OnboardingDialogWrapper({ shouldShow, initialStatus }: OnboardingDialogWrapperProps) {
  const [open, setOpen] = useState(shouldShow);
  const { refetch } = useSubscriptionContext();

  // Update open state when shouldShow changes
  useEffect(() => {
    setOpen(shouldShow);
  }, [shouldShow]);

  function handleComplete() {
    setOpen(false);
    // Trigger subscription refresh event to update Context
    // This ensures subscription state is updated immediately after onboarding
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('onboarding-completed'));
    }
    // Refetch subscription from Context to ensure state is updated
    refetch();
    // Note: Onboarding completion is now stored in household settings, so no complex cache invalidation needed
  }

  return (
    <SimplifiedOnboardingDialog
      open={open}
      onOpenChange={setOpen}
      onComplete={handleComplete}
    />
  );
}
