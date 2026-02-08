"use client";

import { useEffect, useRef } from "react";
import { useDashboardSnapshot } from "@/src/presentation/contexts/dashboard-snapshot-context";

/** Light polling: version check every 2 minutes (no router.refresh). */
const POLLING_INTERVAL_MS = 120000;
const INITIAL_DELAY_MS = 15000;

/**
 * Polls dashboard version and refetches only when version changed.
 * Uses snapshot context (version check → conditional refetch). No router.refresh().
 * Must be used inside DashboardSnapshotProvider (e.g. on dashboard page).
 */
export function useDashboardUpdates(enabled: boolean = true) {
  const { refresh } = useDashboardSnapshot();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    initialTimeoutRef.current = setTimeout(() => {
      refresh();
    }, INITIAL_DELAY_MS);

    intervalRef.current = setInterval(() => {
      refresh();
    }, POLLING_INTERVAL_MS);

    return () => {
      if (initialTimeoutRef.current) clearTimeout(initialTimeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, refresh]);

  return {};
}
