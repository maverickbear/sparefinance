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
  invalidateCache: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

// Global cache to prevent duplicate calls across all component instances
const globalSubscriptionCache = {
  promise: null as Promise<SubscriptionData> | null,
  data: null as SubscriptionData | null,
  timestamp: 0,
  TTL: 5 * 60 * 1000, // 5 minutes
};

// localStorage key for persistent cache
const STORAGE_KEY = 'spare_subscription_cache';
const STORAGE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper functions for localStorage cache
function getStoredCache(): { data: SubscriptionData; timestamp: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    const now = Date.now();
    if (now - parsed.timestamp < STORAGE_TTL) {
      return parsed;
    }
    // Cache expired, remove it
    localStorage.removeItem(STORAGE_KEY);
    return null;
  } catch (error) {
    // Invalid cache, remove it
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function setStoredCache(data: SubscriptionData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch (error) {
    // Ignore localStorage errors (quota exceeded, etc.)
    console.warn('Failed to store subscription cache:', error);
  }
}

/**
 * Invalidate client-side subscription cache
 * Call this after subscription is created/updated to force fresh data fetch
 */
export function invalidateClientSubscriptionCache(): void {
  if (typeof window === 'undefined') return;
  
  // Clear global cache
  globalSubscriptionCache.data = null;
  globalSubscriptionCache.timestamp = 0;
  globalSubscriptionCache.promise = null;
  
  // Clear localStorage cache
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear localStorage cache:', error);
  }
  
  logger.withPrefix("SUBSCRIPTION-CONTEXT").log("Client subscription cache invalidated");
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  
  // Initialize state from localStorage immediately (synchronous)
  // Use a function to ensure this only runs once during initialization
  const getInitialState = () => {
    if (typeof window === 'undefined') {
      return { data: { hasSubscription: false }, checking: true, timestamp: 0 };
    }
    const cached = getStoredCache();
    if (cached) {
      // Initialize global cache immediately
      if (!globalSubscriptionCache.data) {
        globalSubscriptionCache.data = cached.data;
        globalSubscriptionCache.timestamp = cached.timestamp;
      }
      return { data: cached.data, checking: false, timestamp: cached.timestamp };
    }
    return { data: { hasSubscription: false }, checking: true, timestamp: 0 };
  };

  const initialState = getInitialState();
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData>(initialState.data);
  const [checking, setChecking] = useState(initialState.checking);
  const checkingRef = useRef(false);
  const lastCheckTimeRef = useRef(initialState.timestamp);
  const initializedRef = useRef(!!initialState.data.hasSubscription || initialState.timestamp > 0);

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

    // Check localStorage cache
    const storedCache = getStoredCache();
    if (storedCache) {
      log.log("Using localStorage cached subscription data");
      // Update global cache from localStorage
      globalSubscriptionCache.data = storedCache.data;
      globalSubscriptionCache.timestamp = storedCache.timestamp;
      return storedCache.data;
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
        // Use cache: 'no-store' to bypass browser cache and ensure fresh data
        const response = await fetch("/api/billing/subscription", {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        
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

        // Update caches
        globalSubscriptionCache.data = result;
        globalSubscriptionCache.timestamp = now;
        globalSubscriptionCache.promise = null;
        setStoredCache(result);

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
    const now = Date.now();
    lastCheckTimeRef.current = now;

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
    // Skip subscription check for public pages and API routes immediately
    if (isApiRoute || isPublicPage) {
      // Don't even log for API routes to reduce noise
      if (!isApiRoute) {
        log.log("Skipping subscription check for public page");
      }
      setChecking(false);
      if (isApiRoute) {
        // For API routes, don't touch subscription data
        return;
      }
      setSubscriptionData({ hasSubscription: false });
      return;
    }

    log.log("useEffect triggered:", {
      pathname,
      isPublicPage,
      lastCheckTime: lastCheckTimeRef.current,
      timeSinceLastCheck: Date.now() - lastCheckTimeRef.current,
      hasGlobalCache: !!globalSubscriptionCache.data,
    });

    // Check if we need to verify subscription based on time, not pathname
    const now = Date.now();
    const timeSinceLastCheck = now - lastCheckTimeRef.current;
    const MIN_CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutes minimum between checks
    
    // If we have valid cache and checked recently, skip verification
    const hasValidCache = globalSubscriptionCache.data && 
      (now - globalSubscriptionCache.timestamp) < globalSubscriptionCache.TTL;
    
    // Also check localStorage cache if global cache is missing or expired
    if (!hasValidCache) {
      const storedCache = getStoredCache();
      if (storedCache) {
        log.log("Using localStorage cache, updating global cache");
        globalSubscriptionCache.data = storedCache.data;
        globalSubscriptionCache.timestamp = storedCache.timestamp;
        setSubscriptionData(storedCache.data);
        setChecking(false);
        initializedRef.current = true;
        lastCheckTimeRef.current = storedCache.timestamp;
        return;
      }
    }
    
    // If we have valid cache and checked recently, skip verification
    if (hasValidCache && timeSinceLastCheck < MIN_CHECK_INTERVAL && !checkingRef.current) {
      log.log("Using cached data, skipping check (checked recently)");
      setSubscriptionData(globalSubscriptionCache.data);
      setChecking(false);
      initializedRef.current = true;
      return;
    }
    
    // If cache is valid but we haven't checked in a while, still use cache but don't block
    if (hasValidCache && timeSinceLastCheck >= MIN_CHECK_INTERVAL && !checkingRef.current) {
      log.log("Using cached data (stale but valid), will refresh in background");
      setSubscriptionData(globalSubscriptionCache.data);
      setChecking(false);
      initializedRef.current = true;
      // Refresh in background without blocking
      checkSubscription().catch(() => {
        // Ignore errors in background refresh
      });
      return;
    }

    // For protected routes, check subscription if needed
    const isProtectedRoute = !isSelectPlanPage && !isWelcomePage;
    
    if (isProtectedRoute) {
      // If we're on a dashboard route, show nav optimistically while checking
      if (isDashboardRoute) {
        log.log("Dashboard route detected, showing nav optimistically");
        // Only update optimistically if we don't have data yet
        if (!globalSubscriptionCache.data) {
          setSubscriptionData(prev => ({ ...prev, hasSubscription: true }));
        }
        if (!checkingRef.current && !hasValidCache) {
          setChecking(true);
        }
      }
      
      // Check subscription if needed (not checking and cache is stale or missing)
      if (!checkingRef.current && (!hasValidCache || timeSinceLastCheck >= MIN_CHECK_INTERVAL)) {
        log.log("Checking subscription (cache stale or missing)");
        checkSubscription();
        initializedRef.current = true;
      } else if (hasValidCache) {
        log.log("Using valid cache, skipping check");
        setSubscriptionData(globalSubscriptionCache.data);
        setChecking(false);
        initializedRef.current = true;
      } else {
        log.log("Already checking subscription, skipping");
        if (!isDashboardRoute) {
          setChecking(false);
        }
      }
    } else {
      // For select-plan and welcome pages, we still check subscription but don't block
      if (!checkingRef.current && (!hasValidCache || timeSinceLastCheck >= MIN_CHECK_INTERVAL)) {
        log.log("Checking subscription for select-plan/welcome page");
        checkSubscription();
        initializedRef.current = true;
      } else if (hasValidCache) {
        log.log("Using valid cache, skipping check");
        setSubscriptionData(globalSubscriptionCache.data);
        setChecking(false);
        initializedRef.current = true;
      } else {
        log.log("Already checking, skipping");
        setChecking(false);
      }
    }
  }, [pathname, isApiRoute, isPublicPage, isSelectPlanPage, isWelcomePage, isDashboardRoute, checkSubscription, log]);

  // Initialize hasSubscription optimistically for dashboard routes
  useEffect(() => {
    if (isDashboardRoute && !checkingRef.current) {
      setSubscriptionData(prev => ({ ...prev, hasSubscription: true }));
    }
  }, [isDashboardRoute]);

  const invalidateCache = useCallback(() => {
    invalidateClientSubscriptionCache();
    // Force a refetch by resetting state
    setSubscriptionData({ hasSubscription: false });
    setChecking(true);
    // Trigger a new check
    checkSubscription();
  }, [checkSubscription]);

  return (
    <SubscriptionContext.Provider
      value={{
        ...subscriptionData,
        checking,
        refetch: checkSubscription,
        invalidateCache,
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

