import { PlanFeatures } from "@/lib/validations/plan";

export interface PlanError {
  code: string;
  message: string;
  feature?: string;
  currentPlan?: string;
  requiredPlan?: string;
  upgradeUrl?: string;
}

/**
 * Error codes for plan-related errors
 */
export enum PlanErrorCode {
  TRANSACTION_LIMIT_REACHED = "TRANSACTION_LIMIT_REACHED",
  ACCOUNT_LIMIT_REACHED = "ACCOUNT_LIMIT_REACHED",
  FEATURE_NOT_AVAILABLE = "FEATURE_NOT_AVAILABLE",
  HOUSEHOLD_MEMBERS_NOT_AVAILABLE = "HOUSEHOLD_MEMBERS_NOT_AVAILABLE",
}

/**
 * Get user-friendly error message for plan errors
 */
export function getPlanErrorMessage(
  code: PlanErrorCode,
  options?: {
    feature?: string;
    currentPlan?: string;
    limit?: number;
    current?: number;
  }
): string {
  switch (code) {
    case PlanErrorCode.TRANSACTION_LIMIT_REACHED:
      return `You've reached your monthly transaction limit (${options?.limit || 50}). Upgrade your plan to continue adding transactions.`;
    
    case PlanErrorCode.ACCOUNT_LIMIT_REACHED:
      return `You've reached your account limit (${options?.limit || 2}). Upgrade your plan to add more accounts.`;
    
    case PlanErrorCode.FEATURE_NOT_AVAILABLE:
      const featureName = options?.feature || "This feature";
      return `${featureName} is not available in your current plan. Upgrade to access this feature.`;
    
    case PlanErrorCode.HOUSEHOLD_MEMBERS_NOT_AVAILABLE:
      return "Household members are not available in the Free plan. Upgrade to Basic or Premium to add family members.";
    
    default:
      return "This action is not available in your current plan. Please upgrade to continue.";
  }
}

/**
 * Get suggested plan for upgrade based on feature
 */
export function getSuggestedPlan(feature: keyof PlanFeatures): "basic" | "premium" {
  // Most features require Basic plan
  if (feature === "hasInvestments" || feature === "hasAdvancedReports" || feature === "hasCsvExport") {
    return "basic";
  }
  
  // For unlimited features, suggest Premium
  return "premium";
}

/**
 * Create a standardized plan error object
 */
export function createPlanError(
  code: PlanErrorCode,
  options?: {
    feature?: string;
    currentPlan?: string;
    limit?: number;
    current?: number;
  }
): PlanError {
  const requiredPlan = options?.feature ? getSuggestedPlan(options.feature as keyof PlanFeatures) : "basic";
  
  return {
    code,
    message: getPlanErrorMessage(code, options),
    feature: options?.feature,
    currentPlan: options?.currentPlan || "free",
    requiredPlan,
    upgradeUrl: `/pricing?upgrade=${requiredPlan}`,
  };
}

/**
 * Check if an error is a plan-related error
 */
export function isPlanError(error: unknown): error is PlanError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as any).code === "string" &&
    Object.values(PlanErrorCode).includes((error as any).code as PlanErrorCode)
  );
}

