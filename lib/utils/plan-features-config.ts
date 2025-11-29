import { planFeaturesSchema } from "@/src/domain/subscriptions/subscriptions.validations";
import { getDefaultFeatures } from "./plan-features";
import type { PlanFeatures } from "@/src/domain/subscriptions/subscriptions.validations";

/**
 * Get all feature keys from the schema
 * This ensures we always have all features, even if new ones are added
 */
export function getAllFeatureKeys(): (keyof PlanFeatures)[] {
  // Extract keys from the schema shape
  return Object.keys(planFeaturesSchema.shape) as (keyof PlanFeatures)[];
}

/**
 * Get feature display configuration
 * Maps feature keys to human-readable labels and determines if they're limits or boolean features
 */
export interface FeatureConfig {
  key: keyof PlanFeatures;
  label: string;
  type: "limit" | "boolean";
  description?: string;
}

export function getFeatureConfigs(): FeatureConfig[] {
  const keys = getAllFeatureKeys();
  
  // Map of feature keys to their display labels
  const labelMap: Record<keyof PlanFeatures, string> = {
    maxTransactions: "Max Transactions",
    maxAccounts: "Max Accounts",
    hasInvestments: "Investment Tracking",
    hasAdvancedReports: "Advanced Reports",
    hasCsvExport: "CSV Export",
    hasCsvImport: "CSV Import",
    hasDebts: "Debt Tracking",
    hasGoals: "Goals Tracking",
    hasBankIntegration: "Bank Integration",
    hasHousehold: "Household Members",
    hasBudgets: "Budgets",
    hasReceiptScanner: "Receipt Scanner",
  };

  return keys.map((key) => {
    const isLimit = key === "maxTransactions" || key === "maxAccounts";
    return {
      key,
      label: labelMap[key] || key,
      type: isLimit ? "limit" : "boolean",
      description: isLimit 
        ? "Use -1 for unlimited" 
        : undefined,
    };
  });
}


