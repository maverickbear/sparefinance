import { PlanFeatures, Plan } from "@/src/domain/subscriptions/subscriptions.validations";

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
    hasCsvImport: false,
    hasDebts: true,
    hasGoals: true,
    hasBankIntegration: false,
    hasHousehold: false,
    hasBudgets: false,
    hasReceiptScanner: false,
  };
}

/**
 * Merge plan features with defaults to ensure all features are present
 * This handles cases where new features are added to the schema but don't exist in the database yet
 */
export function mergeFeaturesWithDefaults(
  dbFeatures: Partial<PlanFeatures>
): PlanFeatures {
  const defaults = getDefaultFeatures();
  return { ...defaults, ...dbFeatures };
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

/**
 * Normalize a feature value to a boolean
 * Handles cases where values come as strings "true"/"false" from JSONB
 * This is a safety function to ensure consistent boolean checks throughout the app
 */
export function normalizeFeatureValue(value: any): boolean {
  return value === true || value === "true";
}

