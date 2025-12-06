/**
 * Subscription Selectors
 * 
 * Hooks that provide specific subscription data to components
 * These selectors prevent unnecessary re-renders by subscribing only to needed data
 * 
 * Best Practice: Components should use these selectors instead of useSubscriptionContext()
 * to prevent re-renders when unrelated subscription data changes
 */

import { useMemo } from "react";
import { useSubscriptionContext } from "@/contexts/subscription-context";
import type { PlanFeatures } from "@/src/domain/subscriptions/subscriptions.validations";

/**
 * Check if user has an active subscription
 * Only re-renders when subscription status changes to/from active
 */
export function useHasActiveSubscription(): boolean {
  const { subscription } = useSubscriptionContext();
  return useMemo(() => subscription?.status === "active", [subscription?.status]);
}

/**
 * Check if user has a trialing subscription
 * Only re-renders when subscription status changes to/from trialing
 */
export function useIsTrialing(): boolean {
  const { subscription } = useSubscriptionContext();
  return useMemo(() => subscription?.status === "trialing", [subscription?.status]);
}

/**
 * Check if user has any subscription (active, trialing, cancelled, etc.)
 * Only re-renders when subscription existence changes
 */
export function useHasSubscription(): boolean {
  const { subscription } = useSubscriptionContext();
  return useMemo(() => subscription !== null, [subscription]);
}

/**
 * Get subscription limits/features
 * Only re-renders when plan features change
 */
export function useSubscriptionLimits(): PlanFeatures {
  const { limits } = useSubscriptionContext();
  return useMemo(() => limits, [limits]);
}

/**
 * Check if user can access a specific feature
 * Only re-renders when the specific feature's limit changes
 * 
 * @param feature - Feature name to check (e.g., "transactions", "accounts")
 * @returns boolean - true if user can access the feature
 */
export function useCanAccessFeature(feature: string): boolean {
  const { limits } = useSubscriptionContext();
  return useMemo(() => {
    // Check if feature exists in limits and is enabled
    const featureLimit = (limits as any)[feature];
    if (featureLimit === undefined) {
      // Feature not in limits, default to true (no restriction)
      return true;
    }
    // If it's a number, check if it's greater than 0 or -1 (unlimited)
    if (typeof featureLimit === "number") {
      return featureLimit > 0 || featureLimit === -1;
    }
    // If it's a boolean, return it directly
    if (typeof featureLimit === "boolean") {
      return featureLimit;
    }
    // Default to true if type is unknown
    return true;
  }, [limits, feature]);
}

