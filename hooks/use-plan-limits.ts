"use client";

import { usePlanLimitsContext } from "@/contexts/plan-limits-context";
import { PlanFeatures } from "@/lib/validations/plan";

interface PlanLimitsData {
  limits: PlanFeatures;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to get current user's plan limits
 * Uses shared context to avoid multiple API calls
 */
export function usePlanLimits(): PlanLimitsData {
  const { limits, loading, error } = usePlanLimitsContext();
  return { limits, loading, error };
}

