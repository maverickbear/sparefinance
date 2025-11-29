"use server";

import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { 
  getUserSubscriptionData,
  checkTransactionLimit,
  checkAccountLimit,
  type LimitCheckResult
} from "@/lib/api/subscription";

// Re-export LimitCheckResult from unified API
export type { LimitCheckResult } from "@/lib/api/subscription";

export interface BillingLimitsResult {
  transactionLimit: LimitCheckResult;
  accountLimit: LimitCheckResult;
}

/**
 * Get billing limits (transaction and account limits)
 * This is a Server Action that replaces the /api/billing/limits route
 * Uses unified subscription API
 */
export async function getBillingLimitsAction(): Promise<BillingLimitsResult | null> {
  try {
    const supabase = await createServerClient();
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return null;
    }

    // Use unified API - both checks use the same cached subscription data
    const [transactionLimit, accountLimit] = await Promise.all([
      checkTransactionLimit(authUser.id),
      checkAccountLimit(authUser.id),
    ]);

    return {
      transactionLimit,
      accountLimit,
    };
  } catch (error) {
    console.error("Error fetching limits:", error);
    return null;
  }
}

// Helper functions removed - now using unified API functions directly

