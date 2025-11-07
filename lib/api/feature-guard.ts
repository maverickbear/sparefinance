"use server";

import { createServerClient } from "@/lib/supabase-server";
import { checkPlanLimits } from "./plans";
import { checkTransactionLimit, checkAccountLimit, checkFeatureAccess } from "./limits";
import { PlanFeatures } from "@/lib/validations/plan";
import { PlanErrorCode, createPlanError, type PlanError } from "@/lib/utils/plan-errors";

/**
 * Guard result interface
 */
export interface GuardResult {
  allowed: boolean;
  error?: PlanError;
}

/**
 * Guard feature access - validates if user has access to a specific feature
 */
export async function guardFeatureAccess(
  userId: string,
  feature: keyof PlanFeatures
): Promise<GuardResult> {
  try {
    const hasAccess = await checkFeatureAccess(userId, feature);
    
    if (!hasAccess) {
      return {
        allowed: false,
        error: createPlanError(PlanErrorCode.FEATURE_NOT_AVAILABLE, {
          feature,
        }),
      };
    }
    
    return { allowed: true };
  } catch (error) {
    console.error("Error in guardFeatureAccess:", error);
    return {
      allowed: false,
      error: createPlanError(PlanErrorCode.FEATURE_NOT_AVAILABLE, {
        feature,
      }),
    };
  }
}

/**
 * Guard transaction limit - validates if user can create a new transaction
 */
export async function guardTransactionLimit(
  userId: string,
  month?: Date
): Promise<GuardResult> {
  try {
    const limitCheck = await checkTransactionLimit(userId, month);
    
    if (!limitCheck.allowed) {
      const { plan } = await checkPlanLimits(userId);
      
      return {
        allowed: false,
        error: createPlanError(PlanErrorCode.TRANSACTION_LIMIT_REACHED, {
          limit: limitCheck.limit,
          current: limitCheck.current,
          currentPlan: plan?.name,
        }),
      };
    }
    
    return { allowed: true };
  } catch (error) {
    console.error("Error in guardTransactionLimit:", error);
    return {
      allowed: false,
      error: createPlanError(PlanErrorCode.TRANSACTION_LIMIT_REACHED),
    };
  }
}

/**
 * Guard account limit - validates if user can create a new account
 */
export async function guardAccountLimit(userId: string): Promise<GuardResult> {
  try {
    const limitCheck = await checkAccountLimit(userId);
    
    if (!limitCheck.allowed) {
      const { plan } = await checkPlanLimits(userId);
      
      return {
        allowed: false,
        error: createPlanError(PlanErrorCode.ACCOUNT_LIMIT_REACHED, {
          limit: limitCheck.limit,
          current: limitCheck.current,
          currentPlan: plan?.name,
        }),
      };
    }
    
    return { allowed: true };
  } catch (error) {
    console.error("Error in guardAccountLimit:", error);
    return {
      allowed: false,
      error: createPlanError(PlanErrorCode.ACCOUNT_LIMIT_REACHED),
    };
  }
}

/**
 * Guard household members - validates if user can add household members
 */
export async function guardHouseholdMembers(userId: string): Promise<GuardResult> {
  try {
    const { plan } = await checkPlanLimits(userId);
    
    // Household members are only available for Basic and Premium plans
    if (!plan || plan.name === "free") {
      return {
        allowed: false,
        error: createPlanError(PlanErrorCode.HOUSEHOLD_MEMBERS_NOT_AVAILABLE, {
          currentPlan: plan?.name || "free",
        }),
      };
    }
    
    return { allowed: true };
  } catch (error) {
    console.error("Error in guardHouseholdMembers:", error);
    return {
      allowed: false,
      error: createPlanError(PlanErrorCode.HOUSEHOLD_MEMBERS_NOT_AVAILABLE),
    };
  }
}

/**
 * Get current user ID from session
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }
    
    return user.id;
  } catch (error) {
    console.error("Error getting current user ID:", error);
    return null;
  }
}

/**
 * Throw a plan error if guard fails
 */
export async function throwIfNotAllowed(result: GuardResult): Promise<void> {
  if (!result.allowed && result.error) {
    const error = new Error(result.error.message);
    (error as any).code = result.error.code;
    (error as any).planError = result.error;
    throw error;
  }
}

