"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { logger } from "@/lib/utils/logger";
import type { Subscription, PlanFeatures } from "@/lib/validations/plan";

interface SubscriptionData {
  hasSubscription: boolean;
  currentPlanId?: string;
  subscription?: Subscription | null;
  limits?: PlanFeatures;
}

interface SubscriptionContextValue extends SubscriptionData {
  checking: boolean;
  refetch: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

// Global cache to prevent duplicate calls across all component instances
const globalSubscriptionCache = {
  promise: null as Promise<SubscriptionData> | null,
  data: null as SubscriptionData | null,
  timestamp: 0,
  TTL: 30 * 1000, // 30 seconds
};

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData>({
    hasSubscription: false,
  });
  const [checking, setChecking] = useState(true);
  const checkingRef = useRef(false);
  const lastCheckedPathnameRef = useRef<string | null>(null);

  const log = useMemo(() => logger.withPrefix("SUBSCRIPTION-CONTEXT"), []);

  // Determine if it's a public page
  const isApiRoute = pathname?.startsWith("/api");
  const isAuthPage = pathname?.startsWith("/auth");
  const isAcceptPage = pathname?.startsWith("/members/accept");
  const isSelectPlanPage = pathname === "/select-plan";
  const isWelcomePage = pathname === "/welcome";
  const isLandingPage = pathname === "/";
  const isPricingPage = pathname === "/pricing";
  const isPrivacyPolicyPage = pathname === "/privacy-policy";
  const isTermsOfServicePage = pathname === "/terms-of-service";
  const isFAQPage = pathname === "/faq";
  const isPublicPage = isAuthPage || isAcceptPage || isLandingPage || isPricingPage || isPrivacyPolicyPage || isTermsOfServicePage || isFAQPage;
  const isDashboardRoute = !isPublicPage && !isApiRoute && !isSelectPlanPage && !isWelcomePage;

  const fetchSubscription = useCallback(async (): Promise<SubscriptionData> => {
    // Check global cache first
    const now = Date.now();
    if (globalSubscriptionCache.data && (now - globalSubscriptionCache.timestamp) < globalSubscriptionCache.TTL) {
      log.log("Using cached subscription data");
      return globalSubscriptionCache.data;
    }

    // If there's an in-flight request, reuse it
    if (globalSubscriptionCache.promise) {
      log.log("Reusing in-flight subscription request");
      return await globalSubscriptionCache.promise;
    }

    // Create new request
    log.log("Fetching subscription data");
    const promise = (async () => {
      try {
        const response = await fetch("/api/billing/subscription");
        
        if (!response.ok) {
          if (response.status === 401) {
            log.log("User not authenticated");
            return { hasSubscription: false };
          }
          throw new Error(`Failed to fetch subscription: ${response.status}`);
        }

        const data = await response.json();
        const result: SubscriptionData = {
          hasSubscription: !!data.subscription,
          currentPlanId: data.subscription?.planId,
          subscription: data.subscription,
          limits: data.limits,
        };

        // Update cache
        globalSubscriptionCache.data = result;
        globalSubscriptionCache.timestamp = now;
        globalSubscriptionCache.promise = null;

        return result;
      } catch (error) {
        log.error("Error fetching subscription:", error);
        globalSubscriptionCache.promise = null;
        return { hasSubscription: false };
      }
    })();

    globalSubscriptionCache.promise = promise;
    return await promise;
  }, [log]);

  const checkSubscription = useCallback(async () => {
    // Prevent concurrent calls
    if (checkingRef.current) {
      log.log("Already checking, skipping");
      return;
    }

    log.log("Starting subscription check");
    checkingRef.current = true;
    const currentPathname = pathname;
    lastCheckedPathnameRef.current = currentPathname;

    try {
      const data = await fetchSubscription();
      
      setSubscriptionData(data);
      setChecking(false);

      // Handle redirects based on subscription status
      if (data.hasSubscription) {
        if (isSelectPlanPage && pathname === currentPathname) {
          log.log("User has subscription, redirecting from select-plan to dashboard");
          router.push("/dashboard");
        }
      } else {
        // No subscription - modal will open automatically via SubscriptionGuard
        // No need to redirect, just let the ProtectedLayout handle it
        if (isSelectPlanPage && pathname === currentPathname) {
          log.log("No subscription, redirecting from select-plan to dashboard (modal will open)");
          router.push("/dashboard");
        }
      }
    } catch (error) {
      log.error("Error checking subscription:", error);
      setSubscriptionData({ hasSubscription: false });
      setChecking(false);
    } finally {
      checkingRef.current = false;
    }
  }, [pathname, router, isPublicPage, isSelectPlanPage, isWelcomePage, fetchSubscription, log]);

  useEffect(() => {
    log.log("useEffect triggered:", {
      pathname,
      isPublicPage,
      lastCheckedPathname: lastCheckedPathnameRef.current,
    });

    // Skip subscription check for public pages and API routes
    if (isApiRoute || isPublicPage) {
      log.log("Skipping subscription check for public page or API route");
      setChecking(false);
      setSubscriptionData({ hasSubscription: false });
      lastCheckedPathnameRef.current = pathname;
      return;
    }

    // If we already checked for this pathname, skip
    if (lastCheckedPathnameRef.current === pathname && !checkingRef.current) {
      log.log("Already checked for this pathname, skipping");
      setChecking(false);
      return;
    }

    // For protected routes, check subscription immediately
    const isProtectedRoute = !isSelectPlanPage && !isWelcomePage;
    
    if (isProtectedRoute) {
      // If we're on a dashboard route, show nav optimistically while checking
      if (isDashboardRoute) {
        log.log("Dashboard route detected, showing nav optimistically");
        setSubscriptionData(prev => ({ ...prev, hasSubscription: true })); // Optimistic update
        if (!checkingRef.current) {
          setChecking(true);
        }
      }
      
      // Check subscription immediately
      if (!checkingRef.current) {
        log.log("Checking subscription immediately");
        checkSubscription();
      } else {
        log.log("Already checking subscription, skipping");
        if (!isDashboardRoute) {
          setChecking(false);
        }
      }
    } else {
      // For select-plan and welcome pages, we still check subscription but don't block
      if (lastCheckedPathnameRef.current !== pathname && !checkingRef.current) {
        log.log("Checking subscription for select-plan/welcome page");
        checkSubscription();
      } else {
        log.log("Already checking or checked for this pathname, skipping");
        setChecking(false);
      }
    }
  }, [pathname, isApiRoute, isPublicPage, isSelectPlanPage, isWelcomePage, isDashboardRoute, checkSubscription]);

  // Initialize hasSubscription optimistically for dashboard routes
  useEffect(() => {
    if (isDashboardRoute && !checkingRef.current) {
      setSubscriptionData(prev => ({ ...prev, hasSubscription: true }));
    }
  }, [isDashboardRoute]);

  return (
    <SubscriptionContext.Provider
      value={{
        ...subscriptionData,
        checking,
        refetch: checkSubscription,
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

