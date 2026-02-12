"use server";

import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { makeSubscriptionsService } from "@/src/application/subscriptions/subscriptions.factory";
import type { BaseLimitCheckResult } from "@/src/domain/subscriptions/subscriptions.types";

export interface BillingLimitsResult {
  transactionLimit: BaseLimitCheckResult;
  accountLimit: BaseLimitCheckResult;
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

    // Use Application Service - both checks use the same cached subscription data
    const subscriptionsService = makeSubscriptionsService();
    const [transactionLimit, accountLimit] = await Promise.all([
      subscriptionsService.checkTransactionLimit(authUser.id),
      subscriptionsService.checkAccountLimit(authUser.id),
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

