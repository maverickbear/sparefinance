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

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const checkUpdates = async () => {
      // Don't check if already refreshing
      if (isRefreshingRef.current) {
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
        } else if (!lastCheckRef.current) {
          // First check - use current time
          lastCheckRef.current = new Date().toISOString();
        }

        // If updates detected, refresh the router
        if (data.hasUpdates) {
          isRefreshingRef.current = true;
          // Small delay to ensure backend has finished processing
          setTimeout(() => {
            router.refresh();
            // Reset refreshing flag after a delay
            setTimeout(() => {
              isRefreshingRef.current = false;
            }, 2000);
          }, 100);
        }
      } catch (error) {
        console.error("[Dashboard Updates] Error checking updates:", error);
      } finally {
        setIsChecking(false);
      }
    };

    // Initial check after a short delay (to avoid checking immediately on mount)
    const initialTimeout = setTimeout(() => {
      checkUpdates();
    }, 2000);

    // Poll every 10 seconds
    intervalRef.current = setInterval(() => {
      checkUpdates();
    }, 10000);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, router]);

  return { isChecking };
}

