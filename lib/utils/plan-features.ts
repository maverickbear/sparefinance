import { PlanFeatures, Plan } from "@/lib/validations/plan";

/**
 * Get default plan features (free plan limits)
 */
export function getDefaultFeatures(): PlanFeatures {
  return {
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
}

/**
 * Resolve plan features with defaults
 * Ensures all PlanFeatures fields are defined (no undefined)
 * Merges plan features with defaults for consistency
 */
export function resolvePlanFeatures(plan: Plan | null): PlanFeatures {
  if (!plan) {
    return getDefaultFeatures();
  }
  // Merge plan features with defaults to ensure all fields are defined
  return { ...getDefaultFeatures(), ...plan.features };
}

