"use server";

import { createServerClient } from "@/lib/supabase-server";
import { 
  checkTransactionLimit, 
  checkAccountLimit, 
  checkFeatureAccess,
  getUserSubscriptionData 
} from "./subscription";
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
 * Now uses user_monthly_usage table for fast limit checking (no COUNT(*) queries)
 * This function only READS from user_monthly_usage - it does NOT update counters
 * Counter updates are handled by SQL functions that create transactions atomically
 */
export async function guardTransactionLimit(
  userId: string,
  month?: Date
): Promise<GuardResult> {
  try {
    // Get subscription data using unified API
    const { limits, plan } = await getUserSubscriptionData(userId);
    
    // Unlimited transactions
    if (limits.maxTransactions === -1) {
      return { allowed: true };
    }

    const supabase = await createServerClient();
    
    // Calculate month_date (first day of month) - work directly with date, no toISOString()
    const checkMonth = month || new Date();
    const monthDate = new Date(checkMonth.getFullYear(), checkMonth.getMonth(), 1);
    const monthDateStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-${String(monthDate.getDate()).padStart(2, '0')}`;

    // Read from user_monthly_usage (fast lookup, no COUNT)
    const { data: usage, error } = await supabase
      .from("user_monthly_usage")
      .select("transactions_count")
      .eq("user_id", userId)
      .eq("month_date", monthDateStr)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error("Error checking transaction limit:", error);
      // Fallback: if table doesn't exist or error, do COUNT for historical data
      const { count } = await supabase
        .from("Transaction")
        .select("*", { count: "exact", head: true })
        .eq("userId", userId)
        .gte("date", monthDateStr)
        .lte("date", `${checkMonth.getFullYear()}-${String(checkMonth.getMonth() + 1).padStart(2, '0')}-${new Date(checkMonth.getFullYear(), checkMonth.getMonth() + 1, 0).getDate()}`);
      
      const current = count || 0;
      const allowed = current < limits.maxTransactions;
      
      if (!allowed) {
        return {
          allowed: false,
          error: createPlanError(PlanErrorCode.TRANSACTION_LIMIT_REACHED, {
            limit: limits.maxTransactions,
            current,
            currentPlan: plan?.name,
          }),
        };
      }
      
      return { allowed: true };
    }

    const current = usage?.transactions_count || 0;
    const allowed = current < limits.maxTransactions;
    
    if (!allowed) {
      return {
        allowed: false,
        error: createPlanError(PlanErrorCode.TRANSACTION_LIMIT_REACHED, {
          limit: limits.maxTransactions,
          current,
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
    // Get subscription data using unified API
    const { limits, plan } = await getUserSubscriptionData(userId);
    
    // Unlimited accounts
    if (limits.maxAccounts === -1) {
      return { allowed: true };
    }

    const supabase = await createServerClient();
    
    // Count current accounts
    const { count, error } = await supabase
      .from("Account")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("Error checking account limit:", error);
      return {
        allowed: false,
        error: createPlanError(PlanErrorCode.ACCOUNT_LIMIT_REACHED),
      };
    }

    const current = count || 0;
    const allowed = current < limits.maxAccounts;
    
    if (!allowed) {
      return {
        allowed: false,
        error: createPlanError(PlanErrorCode.ACCOUNT_LIMIT_REACHED, {
          limit: limits.maxAccounts,
          current,
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
    // Check if user is super_admin - super_admin can always invite members
    const supabase = await createServerClient();
    const { data: user } = await supabase
      .from("User")
      .select("role")
      .eq("id", userId)
      .single();

    if (user?.role === "super_admin") {
      return { allowed: true };
    }

    // Use guardFeatureAccess to check hasHousehold feature (Pro-only)
    return await guardFeatureAccess(userId, "hasHousehold");
  } catch (error) {
    console.error("Error in guardHouseholdMembers:", error);
    return {
      allowed: false,
      error: createPlanError(PlanErrorCode.HOUSEHOLD_MEMBERS_NOT_AVAILABLE),
    };
  }
}

/**
 * Guard bank integration - validates if user has access to bank integration feature
 */
export async function guardBankIntegration(userId: string): Promise<GuardResult> {
  try {
    const hasAccess = await checkFeatureAccess(userId, 'hasBankIntegration');
    
    if (!hasAccess) {
      return {
        allowed: false,
        error: createPlanError(PlanErrorCode.FEATURE_NOT_AVAILABLE, {
          feature: 'hasBankIntegration',
        }),
      };
    }
    
    return { allowed: true };
  } catch (error) {
    console.error("Error in guardBankIntegration:", error);
    return {
      allowed: false,
      error: createPlanError(PlanErrorCode.FEATURE_NOT_AVAILABLE, {
        feature: 'hasBankIntegration',
      }),
    };
  }
}

/**
 * Get current user ID from session
 * Also verifies that the user exists in the User table
 * If user doesn't exist, logs out and returns null
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }
    
    // Verify user exists in User table
    const { data: userData, error: userError } = await supabase
      .from("User")
      .select("id")
      .eq("id", user.id)
      .single();

    // If user doesn't exist in User table, logout and return null
    if (userError || !userData) {
      console.warn(`[getCurrentUserId] User ${user.id} authenticated but not found in User table. Logging out.`);
      
      // Logout to clear session
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.error("[getCurrentUserId] Error signing out:", signOutError);
      }
      
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

