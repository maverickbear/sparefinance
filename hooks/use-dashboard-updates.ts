"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface CheckUpdatesResponse {
  hasUpdates: boolean;
  currentHash: string;
  timestamp: string | null;
}

/**
 * Hook to silently poll for dashboard data updates
 * When updates are detected, it triggers a router refresh to reload data
 */
export function useDashboardUpdates(enabled: boolean = true) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);
  const lastCheckRef = useRef<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);
  const mountTimeRef = useRef<number>(Date.now());
  const isInitialCheckRef = useRef(true);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const checkUpdates = async () => {
      // Don't check if already refreshing
      if (isRefreshingRef.current) {
        return;
      }

      // CRITICAL: Prevent refresh during initial load period (first 10 seconds)
      // This prevents unnecessary refreshes right after page load
      const timeSinceMount = Date.now() - mountTimeRef.current;
      const MIN_TIME_BEFORE_REFRESH = 10000; // 10 seconds
      
      if (timeSinceMount < MIN_TIME_BEFORE_REFRESH) {
        console.debug(`[Dashboard Updates] Skipping refresh - too soon after mount (${Math.round(timeSinceMount / 1000)}s)`);
        // Still update lastCheck timestamp to establish baseline, but don't refresh
        if (isInitialCheckRef.current) {
          try {
            const response = await fetch("/api/dashboard/check-updates", {
              method: "GET",
              cache: "no-store",
            });
            if (response.ok) {
              const data: CheckUpdatesResponse = await response.json();
              if (data.timestamp) {
                lastCheckRef.current = data.timestamp;
                isInitialCheckRef.current = false;
              }
            }
          } catch (error) {
            console.error("[Dashboard Updates] Error on initial check:", error);
          }
        }
        return;
      }

      try {
        setIsChecking(true);
        const url = lastCheckRef.current
          ? `/api/dashboard/check-updates?lastCheck=${encodeURIComponent(lastCheckRef.current)}`
          : "/api/dashboard/check-updates";

        const response = await fetch(url, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data: CheckUpdatesResponse = await response.json();

        // Update last check timestamp
        if (data.timestamp) {
          lastCheckRef.current = data.timestamp;
          isInitialCheckRef.current = false;
        } else if (!lastCheckRef.current) {
          // First check - use current time
          lastCheckRef.current = new Date().toISOString();
          isInitialCheckRef.current = false;
        }

        // If updates detected, refresh the router
        // Add protection against excessive refreshes
        if (data.hasUpdates) {
          // Check if we're already refreshing or just refreshed recently
          if (isRefreshingRef.current) {
            console.debug("[Dashboard Updates] Already refreshing, skipping");
            return;
          }
          
          isRefreshingRef.current = true;
          // Small delay to ensure backend has finished processing
          setTimeout(() => {
            router.refresh();
            // Reset refreshing flag after a delay
            setTimeout(() => {
              isRefreshingRef.current = false;
            }, 5000); // Increased to 5 seconds to prevent rapid successive refreshes
          }, 100);
        }
      } catch (error) {
        console.error("[Dashboard Updates] Error checking updates:", error);
      } finally {
        setIsChecking(false);
      }
    };

    // Initial check after a longer delay (to avoid checking immediately on mount)
    // Increased to 5 seconds to give page time to fully load
    const initialTimeout = setTimeout(() => {
      checkUpdates();
    }, 5000);

    // Poll every 300 seconds (5 minutes) - increased since manual refresh button is available
    intervalRef.current = setInterval(() => {
      checkUpdates();
    }, 300000);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, router]);

  return { isChecking };
}

