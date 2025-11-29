"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
  const router = useRouter();
  const pathname = usePathname();
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

  useEffect(() => {
    // Only set up subscriptions on dashboard page
    if (pathname !== "/dashboard") {
      // Cleanup if navigating away from dashboard
      if (subscriptionRef.current) {
        console.log(`[DashboardRealtime-${instanceIdRef.current}] Cleaning up subscription (navigated away)`);
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // CRITICAL FIX: Prevent multiple subscriptions from being created
    if (subscriptionRef.current || isSubscribingRef.current) {
      console.log(`[DashboardRealtime-${instanceIdRef.current}] Subscription already exists or in progress, skipping`);
      return;
    }

    // Debounce refresh calls to avoid too many refreshes
    // OPTIMIZED: Reduced from 2000ms to 800ms to improve responsiveness while still preventing excessive refreshes
    let refreshTimeout: NodeJS.Timeout | null = null;
    const scheduleRefresh = async () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      refreshTimeout = setTimeout(async () => {
        // Only refresh the router - cache invalidation is handled by revalidateTag in API functions
        // This avoids invalidating cache on initial page load
        router.refresh();
      }, 800); // Debounce for 800ms (reduced from 2000ms for better UX)
    };

    // Performance logging for monitoring outliers
    const logPerformance = (operation: string, duration: number) => {
      if (duration > CIRCUIT_BREAKER_CONFIG.SLOW_OPERATION_THRESHOLD) {
        // Log as info instead of warn - network operations can take time
        // Only warn if it's truly slow (>1s for subscription setup)
        console.info(`[DashboardRealtime] ${operation} took ${duration.toFixed(2)}ms`);
      } else if (duration > 500) {
        // Log as debug for moderate delays (500ms-1000ms)
        console.debug(`[DashboardRealtime] ${operation} took ${duration.toFixed(2)}ms`);
      }
    };

    // Circuit breaker check
    const checkCircuitBreaker = (): boolean => {
      const now = Date.now();
      const breaker = circuitBreakerRef.current;

      // Reset circuit breaker if timeout has passed
      if (breaker.isOpen && now - breaker.lastFailureTime > CIRCUIT_BREAKER_CONFIG.TIMEOUT) {
        breaker.isOpen = false;
        breaker.consecutiveFailures = 0;
        console.info("[DashboardRealtime] Circuit breaker reset");
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
        console.warn("[DashboardRealtime] Circuit breaker opened - falling back to polling");
      }
    };

    // Record success in circuit breaker
    const recordSuccess = () => {
      const breaker = circuitBreakerRef.current;
      if (breaker.consecutiveFailures > 0) {
        breaker.consecutiveFailures = Math.max(0, breaker.consecutiveFailures - 1);
      }
    };

    // OPTIMIZED: Hybrid approach - Polling for Goal (less critical, change less frequently)
    // Budget now uses Realtime for immediate updates when created
    // This reduces load on Realtime system while ensuring critical data updates immediately
    const startPolling = () => {
      pollingIntervalRef.current = setInterval(() => {
        scheduleRefresh();
      }, POLLING_INTERVAL);
    };

    // OPTIMIZED: Lazy loading - wait 1 second before creating subscriptions
    // This improves initial page load performance
    // CRITICAL FIX: Store timeout ref to prevent multiple executions
    subscriptionTimeoutRef.current = setTimeout(() => {
      // Double-check that we're still on dashboard and no subscription exists
      if (pathname !== "/dashboard" || subscriptionRef.current || isSubscribingRef.current) {
        console.log(`[DashboardRealtime-${instanceIdRef.current}] Aborting subscription creation (conditions changed)`);
        return;
      }

      isSubscribingRef.current = true;
      console.log(`[DashboardRealtime-${instanceIdRef.current}] Creating Realtime subscription...`);

      // Check circuit breaker before creating subscriptions
      if (checkCircuitBreaker()) {
        console.info(`[DashboardRealtime-${instanceIdRef.current}] Circuit breaker is open, using polling only`);
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
              table: "Transaction",
            },
            () => {
              recordSuccess();
              scheduleRefresh();
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "Account",
            },
            () => {
              recordSuccess();
              scheduleRefresh();
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "Budget",
            },
            () => {
              recordSuccess();
              scheduleRefresh();
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "UserServiceSubscription",
            },
            () => {
              recordSuccess();
              scheduleRefresh();
            }
          )
          .subscribe((status) => {
            const duration = performance.now() - startTime;
            logPerformance("Subscription setup", duration);
            isSubscribingRef.current = false;

            if (status === "SUBSCRIBED") {
              recordSuccess();
              console.info(`[DashboardRealtime-${instanceIdRef.current}] Realtime subscriptions active for Transaction, Account, Budget, and UserServiceSubscription (took ${duration.toFixed(2)}ms)`);
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              recordFailure();
              console.warn(`[DashboardRealtime-${instanceIdRef.current}] Subscription error: ${status}, falling back to polling`);
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
        console.error(`[DashboardRealtime-${instanceIdRef.current}] Error setting up subscriptions:`, error);
        // Fallback to polling on error
        startPolling();
      }
    }, 1000); // Wait 1 second before creating subscriptions

    // Start polling for Goal (after delay)
    // CRITICAL FIX: Only start polling if not already running
    if (!pollingIntervalRef.current) {
      pollingTimeoutRef.current = setTimeout(() => {
        if (pathname === "/dashboard" && !subscriptionRef.current) {
          console.log(`[DashboardRealtime-${instanceIdRef.current}] Starting polling for Goal`);
          startPolling();
        }
      }, 1000);
    }

    // Cleanup subscriptions on unmount or dependency change
    return () => {
      console.log(`[DashboardRealtime-${instanceIdRef.current}] Cleanup triggered`);
      
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
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
  }, [router, pathname]);

  // This component doesn't render anything
  return null;
}

