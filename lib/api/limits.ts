"use server";

import { createServerClient } from "@/lib/supabase-server";
import { checkPlanLimits, getCurrentUserSubscription } from "@/lib/api/plans";
import { PlanFeatures } from "@/lib/validations/plan";

// Re-export PlanFeatures for convenience
export type { PlanFeatures } from "@/lib/validations/plan";

export interface LimitCheckResult {
  allowed: boolean;
  limit: number;
  current: number;
  message?: string;
}

export async function checkTransactionLimit(userId: string, month: Date = new Date()): Promise<LimitCheckResult> {
  try {
    const { limits } = await checkPlanLimits(userId);
    
    // Unlimited plan
    if (limits.maxTransactions === -1) {
      return {
        allowed: true,
        limit: -1,
        current: 0,
      };
    }

    const supabase = await createServerClient();
    
    // Get start and end of month
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);

    const { count, error } = await supabase
      .from("Transaction")
      .select("*", { count: "exact", head: true })
      .gte("date", startOfMonth.toISOString())
      .lte("date", endOfMonth.toISOString());

    if (error) {
      console.error("Error checking transaction limit:", error);
      return {
        allowed: false,
        limit: limits.maxTransactions,
        current: 0,
        message: "Error checking limit",
      };
    }

    const current = count || 0;
    const allowed = current < limits.maxTransactions;

    return {
      allowed,
      limit: limits.maxTransactions,
      current,
      message: allowed ? undefined : `You've reached your monthly transaction limit (${limits.maxTransactions}). Upgrade to continue.`,
    };
  } catch (error) {
    console.error("Error in checkTransactionLimit:", error);
    return {
      allowed: false,
      limit: 50,
      current: 0,
      message: "Error checking limit",
    };
  }
}

export async function checkAccountLimit(userId: string): Promise<LimitCheckResult> {
  try {
    const { limits } = await checkPlanLimits(userId);
    
    // Unlimited plan
    if (limits.maxAccounts === -1) {
      return {
        allowed: true,
        limit: -1,
        current: 0,
      };
    }

    const supabase = await createServerClient();
    
    const { count, error } = await supabase
      .from("Account")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("Error checking account limit:", error);
      return {
        allowed: false,
        limit: limits.maxAccounts,
        current: 0,
        message: "Error checking limit",
      };
    }

    const current = count || 0;
    const allowed = current < limits.maxAccounts;

    return {
      allowed,
      limit: limits.maxAccounts,
      current,
      message: allowed ? undefined : `You've reached your account limit (${limits.maxAccounts}). Upgrade to continue.`,
    };
  } catch (error) {
    console.error("Error in checkAccountLimit:", error);
    return {
      allowed: false,
      limit: 2,
      current: 0,
      message: "Error checking limit",
    };
  }
}

export async function checkFeatureAccess(userId: string, feature: keyof PlanFeatures): Promise<boolean> {
  try {
    const { limits } = await checkPlanLimits(userId);
    return limits[feature] === true;
  } catch (error) {
    console.error("Error in checkFeatureAccess:", error);
    return false;
  }
}

export async function getCurrentUserLimits(): Promise<PlanFeatures> {
  try {
    const supabase = await createServerClient();
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return getDefaultLimits();
    }

    const { limits } = await checkPlanLimits(authUser.id);
    return limits;
  } catch (error) {
    console.error("Error in getCurrentUserLimits:", error);
    return getDefaultLimits();
  }
}

function getDefaultLimits(): PlanFeatures {
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

