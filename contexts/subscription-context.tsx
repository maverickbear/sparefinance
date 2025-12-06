"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { logger } from "@/lib/utils/logger";
import type { Subscription, Plan, PlanFeatures } from "@/src/domain/subscriptions/subscriptions.validations";
import { getDefaultFeatures } from "@/lib/utils/plan-features";

interface SubscriptionContextValue {
  subscription: Subscription | null;
  plan: Plan | null;
  limits: PlanFeatures;
  checking: boolean;
  refetch: () => Promise<void>;
  // Helper methods for common checks
  isActive: () => boolean;
  isTrialing: () => boolean;
  hasSubscription: () => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

interface InitialData {
  subscription: Subscription | null;
  plan: Plan | null;
}

interface SubscriptionProviderProps {
  children: ReactNode;
  initialData?: InitialData;
}


export function SubscriptionProvider({ children, initialData }: SubscriptionProviderProps) {
  const log = logger.withPrefix("SUBSCRIPTION-CONTEXT");
  
  // Initialize state from server data if provided
  const [subscription, setSubscription] = useState<Subscription | null>(
    initialData?.subscription ?? null
  );
  const [plan, setPlan] = useState<Plan | null>(initialData?.plan ?? null);
  const [limits, setLimits] = useState<PlanFeatures>(
    initialData?.plan?.features ?? getDefaultFeatures()
  );
  const [checking, setChecking] = useState(false);
  
  const checkingRef = useRef(false);
  // Track if we have initial data to avoid immediate refetch on mount
  const hasInitialDataRef = useRef(!!initialData);
  const lastFetchRef = useRef<number>(initialData ? Date.now() : 0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update limits when plan changes
  // Use plan.features directly from database - the database is the source of truth
  useEffect(() => {
    if (plan?.features) {
      setLimits(plan.features);
    } else {
      setLimits(getDefaultFeatures());
    }
  }, [plan]);

  const fetchSubscription = useCallback(async (): Promise<{ subscription: Subscription | null; plan: Plan | null }> => {
    try {
      const response = await fetch("/api/billing/subscription");
      
      if (!response.ok) {
        if (response.status === 401) {
          log.log("User not authenticated");
            return {
              subscription: null,
              plan: null,
            };
        }
        throw new Error(`Failed to fetch subscription: ${response.status}`);
      }

      const data = await response.json();
      const result = {
        subscription: data.subscription ?? null,
        plan: data.plan ?? null,
      };
      
      return {
        subscription: result.subscription ?? null,
        plan: result.plan ?? null,
      };
    } catch (error) {
      log.error("Error fetching subscription:", error);
      return { subscription: null, plan: null };
    }
  }, [log]);

  const refetch = useCallback(async () => {
    if (checkingRef.current) {
      log.log("Already fetching, skipping");
      return;
    }

    checkingRef.current = true;
    setChecking(true);
    lastFetchRef.current = Date.now();

    try {
      const { subscription: newSubscription, plan: newPlan } = await fetchSubscription();
      setSubscription(newSubscription);
      setPlan(newPlan);
    } catch (error) {
      log.error("Error in refetch:", error);
    } finally {
      setChecking(false);
      checkingRef.current = false;
    }
  }, [fetchSubscription, log]);


  // Listen for onboarding completion event to refresh subscription
  useEffect(() => {
    const handleOnboardingCompleted = () => {
      log.log("Onboarding completed event received, refreshing subscription...");
      // Force immediate refetch when onboarding completes
      refetch();
    };

    window.addEventListener('onboarding-completed', handleOnboardingCompleted);

    return () => {
      window.removeEventListener('onboarding-completed', handleOnboardingCompleted);
    };
  }, [refetch, log]);

  // Check subscription status when app regains focus
  // This handles cases where subscription changes outside the app (e.g., App Store cancellation)
  useEffect(() => {
    const handleFocus = () => {
      const timeSinceLastFetch = Date.now() - lastFetchRef.current;
      // Only refetch if it's been at least 1 minute since last fetch
      // This prevents excessive refetches when user rapidly switches tabs
      if (timeSinceLastFetch > 60000) {
        log.log("App regained focus, checking subscription status...");
        refetch();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const timeSinceLastFetch = Date.now() - lastFetchRef.current;
        // Only refetch if it's been at least 1 minute since last fetch
        if (timeSinceLastFetch > 60000) {
          log.log("Page became visible, checking subscription status...");
          refetch();
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refetch, log]);

  // Set up polling every 5 minutes
  // Only starts polling if we have initial data (from SSR) or have fetched before
  // Does NOT do immediate refetch on mount if we already have initialData
  useEffect(() => {
    // If we don't have initial data and haven't fetched, don't poll
    if (!hasInitialDataRef.current && lastFetchRef.current === 0) {
      return;
    }

    const POLLING_INTERVAL = 5 * 60 * 1000; // 5 minutes

    // Start polling interval - first refetch will happen after 5 minutes
    // (not immediately on mount if we have initialData)
    const interval = setInterval(() => {
      const timeSinceLastFetch = Date.now() - lastFetchRef.current;
      // Only poll if it's been at least 5 minutes since last fetch
      if (timeSinceLastFetch >= POLLING_INTERVAL) {
        log.log("Polling interval reached, refetching...");
        refetch();
      }
    }, POLLING_INTERVAL);

    pollingIntervalRef.current = interval;

    return () => {
      clearInterval(interval);
    };
  }, [refetch, log]);

  // Helper methods for common subscription checks
  const isActive = useCallback(() => {
    return subscription?.status === "active";
  }, [subscription]);

  const isTrialing = useCallback(() => {
    return subscription?.status === "trialing";
  }, [subscription]);

  const hasSubscription = useCallback(() => {
    return subscription !== null;
  }, [subscription]);

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        plan,
        limits,
        checking,
        refetch,
        isActive,
        isTrialing,
        hasSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscriptionContext() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error("useSubscriptionContext must be used within SubscriptionProvider");
  }
  return context;
}

/**
 * Safe version of useSubscriptionContext that returns null values when not within provider
 * Useful for components that may be used on public pages (e.g., landing page demos)
 */
export function useSubscriptionSafe() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    // Return safe defaults when not within provider
    return {
      subscription: null,
      plan: null,
      limits: getDefaultFeatures(),
      checking: false,
      refetch: async () => {},
      isActive: () => false,
      isTrialing: () => false,
      hasSubscription: () => false,
    };
  }
  return context;
}
