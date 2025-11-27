"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

interface ConnectionStatus {
  hasConnections: boolean;
  connectionCount: number;
  accountCount: number;
  institutions: Array<{
    id: string;
    name: string | null;
    logo: string | null;
    accountCount: number;
  }>;
}

// Global state to share connection status across all component instances
// This prevents duplicate API calls when multiple ConnectBankButton components mount
let globalConnectionStatus: ConnectionStatus | null = null;
let globalLoadingPromise: Promise<ConnectionStatus | null> | null = null;
let globalLastFetch = 0;
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes (matches API cache)

/**
 * Hook to get Plaid connection status
 * Shares state across all component instances to avoid duplicate API calls
 */
export function usePlaidConnectionStatus() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(globalConnectionStatus);
  const [loading, setLoading] = useState(false);
  const fetchingRef = useRef(false);

  const fetchConnectionStatus = useCallback(async (force = false) => {
    // Prevent duplicate requests
    if (fetchingRef.current && !force) {
      // Wait for existing request
      if (globalLoadingPromise) {
        const result = await globalLoadingPromise;
        if (result) {
          setConnectionStatus(result);
        }
      }
      return;
    }

    // Check if we have fresh cached data
    const now = Date.now();
    if (!force && globalConnectionStatus && (now - globalLastFetch) < CACHE_DURATION) {
      setConnectionStatus(globalConnectionStatus);
      return;
    }

    try {
      fetchingRef.current = true;
      setLoading(true);

      // Reuse existing promise if available
      if (globalLoadingPromise && !force) {
        const result = await globalLoadingPromise;
        if (result) {
          globalConnectionStatus = result;
          setConnectionStatus(result);
          return;
        }
      }

      // Create new fetch promise
      const fetchPromise = fetch('/api/plaid/connection-status')
        .then(async (response) => {
          if (response.ok) {
            const data = await response.json();
            globalConnectionStatus = data;
            globalLastFetch = Date.now();
            return data;
          }
          return null;
        })
        .catch((error) => {
          console.error('Error fetching connection status:', error);
          return null;
        })
        .finally(() => {
          fetchingRef.current = false;
          setLoading(false);
          globalLoadingPromise = null;
        });

      globalLoadingPromise = fetchPromise;
      const result = await fetchPromise;
      
      if (result) {
        setConnectionStatus(result);
      }
    } catch (error) {
      console.error('Error fetching connection status:', error);
      fetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch on mount if we don't have cached data
    if (!globalConnectionStatus) {
      fetchConnectionStatus();
    } else {
      // Use cached data immediately
      setConnectionStatus(globalConnectionStatus);
    }
  }, [fetchConnectionStatus]);

  return {
    connectionStatus,
    loading,
    refresh: () => fetchConnectionStatus(true),
  };
}

