"use client";

import { createContext, useContext, ReactNode } from "react";
import { PlanFeatures } from "@/lib/validations/plan";
import { useSubscriptionContext } from "./subscription-context";
import { logger } from "@/lib/utils/logger";

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
  hasBankIntegration: false,
  hasHousehold: false,
};

export function PlanLimitsProvider({ children }: { children: ReactNode }) {
  // Use subscription context instead of making separate API calls
  const { limits: subscriptionLimits, checking } = useSubscriptionContext();

  // Use limits from subscription context if available, otherwise use defaults
  // Ensure type safety by casting to PlanFeatures
  const limits: PlanFeatures = (subscriptionLimits as PlanFeatures) || defaultLimits;

  return (
    <PlanLimitsContext.Provider
      value={{
        limits,
        loading: checking,
        error: null,
        refetch: async () => {
          // Refetch is handled by subscription context
        },
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
    logger.warn("usePlanLimitsContext called outside PlanLimitsProvider, using defaults");
    return {
      limits: defaultLimits,
      loading: false,
      error: null,
      refetch: async () => {},
    };
  }
  return context;
}

