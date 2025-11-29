"use client";

import { useEffect, useState, useRef } from "react";
import type { HistoricalDataPoint, PortfolioSummary } from "@/lib/api/portfolio";

interface PortfolioData {
  summary: PortfolioSummary | null;
  holdings: any[];
  accounts: any[];
  historical: HistoricalDataPoint[];
}

interface UsePortfolioDataOptions {
  days?: number;
  enabled?: boolean;
}

// Global cache to share data between components
const portfolioDataCache = new Map<string, {
  data: PortfolioData;
  timestamp: number;
  promise?: Promise<PortfolioData>;
}>();

const CACHE_TTL = 5000; // 5 seconds cache
const REQUEST_DEDUP_WINDOW = 2000; // 2 seconds deduplication window

function cleanCache() {
  const now = Date.now();
  for (const [key, value] of portfolioDataCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      portfolioDataCache.delete(key);
    }
  }
}

export function usePortfolioData(options: UsePortfolioDataOptions = {}) {
  const { days = 30, enabled = true } = options;
  const [data, setData] = useState<PortfolioData>({
    summary: null,
    holdings: [],
    accounts: [],
    historical: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    // Clean expired cache entries periodically
    if (Math.random() < 0.1) {
      cleanCache();
    }

    const cacheKey = `portfolio:${days}`;
    const cached = portfolioDataCache.get(cacheKey);
    const now = Date.now();

    // Check if we have valid cached data
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      setData(cached.data);
      setIsLoading(false);
      return;
    }

    // Check if there's an in-flight request we can reuse
    if (cached?.promise) {
      console.log(`[usePortfolioData] Reusing in-flight request for ${cacheKey}`);
      cached.promise
        .then((result) => {
          setData(result);
          setIsLoading(false);
        })
        .catch((err) => {
          setError(err);
          setIsLoading(false);
        });
      return;
    }

    async function loadPortfolioData() {
      try {
        setIsLoading(true);
        setError(null);

        // Check if user is authenticated
        const response = await fetch("/api/v2/user");
        if (!response.ok) {
          setIsLoading(false);
          return;
        }
        
        const { user } = await response.json();
        if (!user) {
          setIsLoading(false);
          return;
        }

        // Create abort controller for cleanup
        abortControllerRef.current = new AbortController();

        // Check again if another component started the request while we were setting up
        // This double-check prevents race conditions when multiple components mount simultaneously
        const doubleCheckCache = portfolioDataCache.get(cacheKey);
        if (doubleCheckCache?.promise) {
          console.log(`[usePortfolioData] Reusing existing promise for ${cacheKey} (double-check)`);
          const result = await doubleCheckCache.promise;
          if (!abortControllerRef.current.signal.aborted) {
            setData(result);
          }
          return;
        }

        // Create new request promise
        console.log(`[usePortfolioData] Creating new request for ${cacheKey}`);
        const requestPromise = fetch(`/api/portfolio/all?days=${days}`, {
          cache: 'no-store',
          signal: abortControllerRef.current.signal,
        })
          .then(async (res) => {
            if (res.status === 401) {
              console.warn("[usePortfolioData] Unauthorized");
              return null;
            }

            if (res.status === 403) {
              console.warn("[usePortfolioData] Access denied");
              return null;
            }

            if (!res.ok) {
              const errorText = await res.text();
              throw new Error(`API error: ${res.status} ${errorText}`);
            }

            return res.json();
          })
          .then((allData) => {
            if (!allData) {
              return {
                summary: null,
                holdings: [],
                accounts: [],
                historical: [],
              };
            }

            const result: PortfolioData = {
              summary: allData.summary || null,
              holdings: Array.isArray(allData.holdings) ? allData.holdings : [],
              accounts: Array.isArray(allData.accounts) ? allData.accounts : [],
              historical: Array.isArray(allData.historical) ? allData.historical : [],
            };

            // Store result in cache
            portfolioDataCache.set(cacheKey, {
              data: result,
              timestamp: Date.now(),
            });

            return result;
          });

        // Store promise in cache IMMEDIATELY (synchronously) to prevent race conditions
        // This ensures that if multiple components mount simultaneously, they all reuse the same request
        portfolioDataCache.set(cacheKey, {
          data: doubleCheckCache?.data || {
            summary: null,
            holdings: [],
            accounts: [],
            historical: [],
          },
          timestamp: now,
          promise: requestPromise,
        });

        const result = await requestPromise;

        // Clear promise from cache after completion
        const currentCache = portfolioDataCache.get(cacheKey);
        if (currentCache) {
          currentCache.promise = undefined;
        }

        if (!abortControllerRef.current.signal.aborted) {
          setData(result);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // Request was aborted, ignore
          return;
        }
        console.error("[usePortfolioData] Error loading portfolio data:", err);
        setError(err);
      } finally {
        if (!abortControllerRef.current?.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadPortfolioData();

    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [days, enabled]);

  return { data, isLoading, error };
}

