"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useDashboardSnapshot } from "@/src/presentation/contexts/dashboard-snapshot-context";

/**
 * Component that sets up real-time subscriptions for dashboard data
 * Automatically refreshes the dashboard when transactions, budgets, goals, or accounts change
 * 
 * OPTIMIZED: 
 * - Consolidated subscriptions into a single channel (reduces realtime.list_changes calls)
 * - Increased debouncing from 500ms to 2000ms (reduces refresh frequency)
 * - Added lazy loading delay (1s) before creating subscriptions (improves initial load)
 * - Hybrid approach: Realtime for Transaction/Account/Budget/UserServiceSubscription, Polling for Goal
 * - Circuit breaker with fallback to polling
 * - Performance logging for monitoring outliers
 */

// Circuit breaker configuration
const CIRCUIT_BREAKER_CONFIG = {
  MAX_FAILURES: 5,
  TIMEOUT: 60000, // 1 minute
  SLOW_OPERATION_THRESHOLD: 1000, // 1000ms (1 second) - realistic threshold for network operations
};

// Polling configuration for less critical data
const POLLING_INTERVAL = 300000; // 300 seconds (5 minutes) - increased since manual refresh button is available

export function DashboardRealtime() {
  const pathname = usePathname();
  const { markStale } = useDashboardSnapshot();
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSubscribingRef = useRef(false);
  const instanceIdRef = useRef(Math.random().toString(36).substring(7));
  const circuitBreakerRef = useRef({
    consecutiveFailures: 0,
    lastFailureTime: 0,
    isOpen: false,
  });
  const markStaleDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (pathname !== "/dashboard") {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    if (subscriptionRef.current || isSubscribingRef.current) {
      return;
    }

    /** Realtime only marks snapshot stale; next version check (poll or Refresh) will refetch. */
    const scheduleMarkStale = () => {
      if (markStaleDebounceRef.current) clearTimeout(markStaleDebounceRef.current);
      markStaleDebounceRef.current = setTimeout(() => {
        markStale();
        markStaleDebounceRef.current = null;
      }, 2000);
    };

    // Performance logging disabled
    const logPerformance = (operation: string, duration: number) => {
      // Logging removed for cleaner console
    };

    // Circuit breaker check
    const checkCircuitBreaker = (): boolean => {
      const now = Date.now();
      const breaker = circuitBreakerRef.current;

      // Reset circuit breaker if timeout has passed
      if (breaker.isOpen && now - breaker.lastFailureTime > CIRCUIT_BREAKER_CONFIG.TIMEOUT) {
        breaker.isOpen = false;
        breaker.consecutiveFailures = 0;
        return false;
      }

      return breaker.isOpen;
    };

    // Record failure in circuit breaker
    const recordFailure = () => {
      const breaker = circuitBreakerRef.current;
      breaker.consecutiveFailures++;
      breaker.lastFailureTime = Date.now();

      if (breaker.consecutiveFailures >= CIRCUIT_BREAKER_CONFIG.MAX_FAILURES) {
        breaker.isOpen = true;
      }
    };

    // Record success in circuit breaker
    const recordSuccess = () => {
      const breaker = circuitBreakerRef.current;
      if (breaker.consecutiveFailures > 0) {
        breaker.consecutiveFailures = Math.max(0, breaker.consecutiveFailures - 1);
      }
    };

    const startPolling = () => {
      pollingIntervalRef.current = setInterval(() => {
        markStale();
      }, POLLING_INTERVAL);
    };

    // OPTIMIZED: Lazy loading - wait 1 second before creating subscriptions
    // This improves initial page load performance
    // CRITICAL FIX: Store timeout ref to prevent multiple executions
    subscriptionTimeoutRef.current = setTimeout(() => {
      // Double-check that we're still on dashboard and no subscription exists
      if (pathname !== "/dashboard" || subscriptionRef.current || isSubscribingRef.current) {
        return;
      }

      isSubscribingRef.current = true;

      // Check circuit breaker before creating subscriptions
      if (checkCircuitBreaker()) {
        isSubscribingRef.current = false;
        startPolling();
        return;
      }

      const startTime = performance.now();

      try {
        // OPTIMIZED: Consolidate critical subscriptions into a single channel
        // Transaction, Account, Budget, and UserServiceSubscription use Realtime (change frequently or need immediate updates)
        // Goal uses polling (change less frequently)
        subscriptionRef.current = supabase
          .channel(`dashboard-critical-${instanceIdRef.current}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "transactions",
            },
            () => {
              recordSuccess();
              scheduleMarkStale();
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "accounts",
            },
            () => {
              recordSuccess();
              scheduleMarkStale();
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "budgets",
            },
            () => {
              recordSuccess();
              scheduleMarkStale();
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "user_subscriptions",
            },
            () => {
              recordSuccess();
              scheduleMarkStale();
            }
          )
          .subscribe((status) => {
            const duration = performance.now() - startTime;
            logPerformance("Subscription setup", duration);
            isSubscribingRef.current = false;

            if (status === "SUBSCRIBED") {
              recordSuccess();
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              recordFailure();
              // Cleanup failed subscription
              if (subscriptionRef.current) {
                supabase.removeChannel(subscriptionRef.current);
                subscriptionRef.current = null;
              }
              // Fallback to polling if Realtime fails
              startPolling();
            }
          });
      } catch (error) {
        isSubscribingRef.current = false;
        recordFailure();
        // Error handling - logging removed
        // Fallback to polling on error
        startPolling();
      }
    }, 1000); // Wait 1 second before creating subscriptions

    // Start polling for Goal (after delay)
    // CRITICAL FIX: Only start polling if not already running
    if (!pollingIntervalRef.current) {
      pollingTimeoutRef.current = setTimeout(() => {
        if (pathname === "/dashboard" && !subscriptionRef.current) {
          startPolling();
        }
      }, 1000);
    }

    const cleanup = () => {
      if (markStaleDebounceRef.current) {
        clearTimeout(markStaleDebounceRef.current);
        markStaleDebounceRef.current = null;
      }
      // Clear timeouts
      if (subscriptionTimeoutRef.current) {
        clearTimeout(subscriptionTimeoutRef.current);
        subscriptionTimeoutRef.current = null;
      }
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
      
      // Cleanup subscription if it was created
      if (subscriptionRef.current) {
        console.log(`[DashboardRealtime-${instanceIdRef.current}] Removing subscription`);
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }

      // Cleanup polling interval
      if (pollingIntervalRef.current) {
        console.log(`[DashboardRealtime-${instanceIdRef.current}] Clearing polling interval`);
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      // Reset subscribing flag
      isSubscribingRef.current = false;
    };

    // Handle pagehide event for back/forward cache compatibility
    // This ensures WebSocket connections are closed before the page is cached
    const handlePageHide = (event: PageTransitionEvent) => {
      // If the page is being cached (back/forward navigation), cleanup WebSockets
      if (event.persisted) {
        cleanup();
      }
    };

    // Add pagehide listener for back/forward cache compatibility
    window.addEventListener('pagehide', handlePageHide);

    // Cleanup subscriptions on unmount or dependency change
    return () => {
      cleanup();
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [pathname, markStale]);

  // This component doesn't render anything
  return null;
}

