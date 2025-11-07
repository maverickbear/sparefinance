"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { PlanFeatures } from "@/lib/validations/plan";

interface PlanLimitsContextValue {
  limits: PlanFeatures;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const PlanLimitsContext = createContext<PlanLimitsContextValue | undefined>(undefined);

const defaultLimits: PlanFeatures = {
  maxTransactions: 50,
  maxAccounts: 2,
  hasInvestments: false,
  hasAdvancedReports: false,
  hasCsvExport: false,
  hasDebts: true,
  hasGoals: true,
};

export function PlanLimitsProvider({ children }: { children: ReactNode }) {
  const [limits, setLimits] = useState<PlanFeatures>(defaultLimits);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const fetchLimits = useCallback(async () => {
    // Prevent concurrent calls
    if (fetchingRef.current) {
      console.log("[PLAN-LIMITS] Already fetching, skipping duplicate call");
      return;
    }

    try {
      fetchingRef.current = true;
      setError(null);

      const response = await fetch("/api/billing/subscription");
      if (!response.ok) {
        throw new Error("Failed to fetch subscription");
      }

      const data = await response.json();
      if (data.limits) {
        setLimits(data.limits);
      } else {
        // Fallback: use default limits
        setLimits(defaultLimits);
      }
    } catch (err) {
      console.error("Error fetching plan limits:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch limits");
      // Use default limits on error
      setLimits(defaultLimits);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchLimits();
  }, [fetchLimits]);

  return (
    <PlanLimitsContext.Provider
      value={{
        limits,
        loading,
        error,
        refetch: fetchLimits,
      }}
    >
      {children}
    </PlanLimitsContext.Provider>
  );
}

export function usePlanLimitsContext() {
  const context = useContext(PlanLimitsContext);
  if (context === undefined) {
    // Return default values if context is not available (shouldn't happen, but prevents crashes)
    console.warn("usePlanLimitsContext called outside PlanLimitsProvider, using defaults");
    return {
      limits: defaultLimits,
      loading: false,
      error: null,
      refetch: async () => {},
    };
  }
  return context;
}

