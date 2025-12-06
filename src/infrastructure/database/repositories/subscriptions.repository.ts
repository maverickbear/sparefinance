/**
 * Subscriptions Repository
 * Data access layer for subscriptions - only handles database operations
 * No business logic here
 */

import { createServerClient, createServiceRoleClient } from "../supabase-server";
import { logger } from "@/src/infrastructure/utils/logger";

export interface SubscriptionRow {
  id: string;
  userId: string | null;
  householdId: string | null;
  planId: string;
  status: "active" | "trialing" | "cancelled" | "past_due" | "unpaid";
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndDate: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlanRow {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  features: any; // JSONB field
  stripePriceIdMonthly: string | null;
  stripePriceIdYearly: string | null;
  stripeProductId: string | null;
  createdAt: string;
  updatedAt: string;
}

export class SubscriptionsRepository {
  /**
   * Find subscription by household ID
   */
  async findByHouseholdId(householdId: string): Promise<SubscriptionRow | null> {
    const supabase = await createServerClient();

    const { data: subscriptions, error } = await supabase
      .from("Subscription")
      .select("*")
      .eq("householdId", householdId)
      .in("status", ["active", "trialing", "cancelled"])
      .order("createdAt", { ascending: false })
      .limit(10);

    if (error) {
      // Permission denied (42501) is expected when RLS policies block access
      // This can happen if the user doesn't have access to the household or subscription
      if (error.code === "42501") {
        logger.debug("[SubscriptionsRepository] Permission denied fetching subscription by householdId (expected during onboarding or if user doesn't have access):", { householdId });
      } else {
        logger.error("[SubscriptionsRepository] Error fetching subscription by householdId:", error);
      }
      return null;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return null;
    }

    // Prioritize: active/trialing > cancelled, then by createdAt (newest first)
    const sorted = subscriptions.sort((a, b) => {
      const aPriority = (a.status === "active" || a.status === "trialing") ? 0 : 1;
      const bPriority = (b.status === "active" || b.status === "trialing") ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return sorted[0] as SubscriptionRow;
  }

  /**
   * Find subscription by user ID
   */
  async findByUserId(userId: string): Promise<SubscriptionRow | null> {
    // Validate userId
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      logger.error("[SubscriptionsRepository] Invalid userId provided to findByUserId:", { userId, type: typeof userId });
      return null;
    }

    const supabase = await createServerClient();

    const { data: subscriptions, error } = await supabase
      .from("Subscription")
      .select("*")
      .eq("userId", userId)
      .in("status", ["active", "trialing", "cancelled"])
      .order("createdAt", { ascending: false })
      .limit(10);

    if (error) {
      // Permission denied (42501) - try using service role client as fallback
      // This can happen immediately after subscription creation when RLS hasn't propagated
      if (error.code === "42501") {
        logger.debug("[SubscriptionsRepository] Permission denied fetching subscription by userId, trying service role client:", { userId });
        
        try {
          const { createServiceRoleClient } = await import("@/src/infrastructure/database/supabase-server");
          const serviceRoleClient = createServiceRoleClient();
          
          const { data: serviceSubscriptions, error: serviceError } = await serviceRoleClient
            .from("Subscription")
            .select("*")
            .eq("userId", userId)
            .in("status", ["active", "trialing", "cancelled"])
            .order("createdAt", { ascending: false })
            .limit(10);
          
          if (serviceError) {
            logger.error("[SubscriptionsRepository] Error fetching subscription by userId with service role:", serviceError);
            return null;
          }
          
          if (!serviceSubscriptions || serviceSubscriptions.length === 0) {
            return null;
          }
          
          // Prioritize: active/trialing > cancelled, then by createdAt (newest first)
          const sorted = serviceSubscriptions.sort((a, b) => {
            const aPriority = (a.status === "active" || a.status === "trialing") ? 0 : 1;
            const bPriority = (b.status === "active" || b.status === "trialing") ? 0 : 1;
            if (aPriority !== bPriority) return aPriority - bPriority;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          
          logger.debug("[SubscriptionsRepository] Found subscription using service role client:", {
            subscriptionId: sorted[0].id,
            status: sorted[0].status,
            householdId: sorted[0].householdId,
          });
          
          return sorted[0] as SubscriptionRow;
        } catch (serviceErr) {
          logger.error("[SubscriptionsRepository] Error using service role client:", serviceErr);
          return null;
        }
      } else {
        logger.error("[SubscriptionsRepository] Error fetching subscription by userId:", error);
        return null;
      }
    }

    if (!subscriptions || subscriptions.length === 0) {
      return null;
    }

    // Prioritize: active/trialing > cancelled, then by createdAt (newest first)
    const sorted = subscriptions.sort((a, b) => {
      const aPriority = (a.status === "active" || a.status === "trialing") ? 0 : 1;
      const bPriority = (b.status === "active" || b.status === "trialing") ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return sorted[0] as SubscriptionRow;
  }

  /**
   * Find all plans
   */
  async findAllPlans(): Promise<PlanRow[]> {
    const supabase = await createServerClient();

    const { data: plans, error } = await supabase
      .from("Plan")
      .select("*")
      .order("priceMonthly", { ascending: true });

    if (error) {
      // Check if the error is due to HTML response (misconfigured Supabase URL)
      const errorMessage = error.message || "";
      if (errorMessage.includes("<html>") || 
          errorMessage.includes("500 Internal Server Error") ||
          errorMessage.includes("cloudflare") ||
          errorMessage.includes("Unexpected token '<'")) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "not set";
        logger.error("[SubscriptionsRepository] Supabase URL appears misconfigured:", {
          error: error.message,
          supabaseUrl: supabaseUrl.substring(0, 50) + "...",
          suggestion: "NEXT_PUBLIC_SUPABASE_URL should point to your Supabase project (should end with .supabase.co), not your app domain",
        });
      } else {
        logger.error("[SubscriptionsRepository] Error fetching plans:", error);
      }
      return [];
    }

    return (plans || []) as PlanRow[];
  }

  /**
   * Find plan by ID
   */
  async findPlanById(planId: string): Promise<PlanRow | null> {
    const supabase = await createServerClient();

    const { data: plan, error } = await supabase
      .from("Plan")
      .select("*")
      .eq("id", planId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error("[SubscriptionsRepository] Error fetching plan:", error);
      return null;
    }

    return plan as PlanRow;
  }

  /**
   * Get user subscription cache from User table
   * 
   * CRITICAL: When called from within "use cache" functions, this method
   * must use the service role client directly to avoid accessing cookies()
   * which is not allowed inside cached functions.
   */
  async getUserSubscriptionCache(userId: string, useServiceRole: boolean = false): Promise<{
    effectivePlanId: string | null;
    effectiveSubscriptionStatus: string | null;
    effectiveSubscriptionId: string | null;
    subscriptionUpdatedAt: string | null;
  } | null> {
    // Validate userId
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      logger.error("[SubscriptionsRepository] Invalid userId provided to getUserSubscriptionCache:", { userId, type: typeof userId });
      return null;
    }

    // If explicitly requested or if we're in a cache context, use service role client directly
    // This avoids trying to access cookies() which is not allowed inside "use cache"
    let supabase;
    if (useServiceRole) {
      logger.debug("[SubscriptionsRepository] Using service role client for cache lookup (explicit flag):", { userId });
      supabase = createServiceRoleClient();
    } else {
      // Try to use regular client first, but fall back to service role client
      // if we're inside a cached function (can't access cookies) or if RLS blocks access
      try {
        supabase = await createServerClient();
      } catch (error: any) {
        // If we can't access cookies (e.g., inside "use cache"), use service role client
        // This is safe because we're only reading cached subscription data
        const errorMessage = error?.message || '';
        const errorString = String(error || '');
        
        const isCacheError = 
          errorMessage.includes('use cache') || 
          errorMessage.includes('unstable_cache') || 
          errorMessage.includes('Dynamic data sources') ||
          errorMessage.includes('cookies() inside') ||
          errorString.includes('use cache') ||
          errorString.includes('unstable_cache') ||
          errorString.includes('Dynamic data sources');
        
        if (isCacheError) {
          logger.debug("[SubscriptionsRepository] Using service role client for cache lookup (inside cached function):", { userId });
          supabase = createServiceRoleClient();
        } else {
          throw error;
        }
      }
    }

    // Try query with regular client first
    let { data: user, error } = await supabase
      .from("User")
      .select("effectivePlanId, effectiveSubscriptionStatus, effectiveSubscriptionId, subscriptionUpdatedAt")
      .eq("id", userId)
      .maybeSingle();

    // If we get a permission denied error, try with service role client
    // This can happen when called from a cached function where createServerClient()
    // returns an unauthenticated client that can't pass RLS
    if (error && error.code === "42501") {
      logger.debug("[SubscriptionsRepository] Permission denied with regular client, trying service role client:", { userId });
      const serviceRoleSupabase = createServiceRoleClient();
      const retryResult = await serviceRoleSupabase
        .from("User")
        .select("effectivePlanId, effectiveSubscriptionStatus, effectiveSubscriptionId, subscriptionUpdatedAt")
        .eq("id", userId)
        .maybeSingle();
      
      user = retryResult.data;
      error = retryResult.error;
    }

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found" - that's fine, return null
      // Other errors should be logged
      if (error.code === "42501") {
        logger.debug("[SubscriptionsRepository] Permission denied fetching user subscription cache (expected during onboarding):", { userId });
      } else {
        logger.error("[SubscriptionsRepository] Error fetching user subscription cache:", error);
      }
      return null;
    }

    return user || null;
  }

  /**
   * Get active household ID for user
   */
  async getActiveHouseholdId(userId: string): Promise<string | null> {
    const supabase = await createServerClient();

    const { data: activeHousehold } = await supabase
      .from("UserActiveHousehold")
      .select("householdId")
      .eq("userId", userId)
      .maybeSingle();

    if (activeHousehold?.householdId) {
      return activeHousehold.householdId;
    }

    // Fallback to default household
    const { data: defaultMember } = await supabase
      .from("HouseholdMember")
      .select("householdId")
      .eq("userId", userId)
      .eq("isDefault", true)
      .eq("status", "active")
      .maybeSingle();

    return defaultMember?.householdId || null;
  }

  /**
   * Get household owner ID
   */
  async getHouseholdOwnerId(householdId: string): Promise<string | null> {
    const supabase = await createServerClient();

    const { data: household } = await supabase
      .from("Household")
      .select("createdBy")
      .eq("id", householdId)
      .maybeSingle();

    return household?.createdBy || null;
  }

  /**
   * Find subscription by ID
   */
  async findById(id: string): Promise<SubscriptionRow | null> {
    const supabase = await createServerClient();

    const { data: subscription, error } = await supabase
      .from("Subscription")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      
      // Permission denied (42501) - try using service role client as fallback
      // This can happen immediately after subscription creation when RLS hasn't propagated
      if (error.code === "42501") {
        logger.debug("[SubscriptionsRepository] Permission denied fetching subscription by ID, trying service role client:", { id });
        
        try {
          const { createServiceRoleClient } = await import("@/src/infrastructure/database/supabase-server");
          const serviceRoleClient = createServiceRoleClient();
          
          const { data: serviceSubscription, error: serviceError } = await serviceRoleClient
            .from("Subscription")
            .select("*")
            .eq("id", id)
            .maybeSingle();
          
          if (serviceError) {
            if (serviceError.code === 'PGRST116') {
              return null; // Not found
            }
            logger.error("[SubscriptionsRepository] Error fetching subscription by ID with service role:", serviceError);
            return null;
          }
          
          logger.debug("[SubscriptionsRepository] Found subscription using service role client:", {
            subscriptionId: serviceSubscription?.id,
            status: serviceSubscription?.status,
            householdId: serviceSubscription?.householdId,
          });
          
          return serviceSubscription as SubscriptionRow | null;
        } catch (serviceErr) {
          logger.error("[SubscriptionsRepository] Error using service role client:", serviceErr);
          return null;
        }
      } else {
        logger.error("[SubscriptionsRepository] Error fetching subscription by ID:", error);
        return null;
      }
    }

    return subscription as SubscriptionRow | null;
  }

  /**
   * Get user monthly transaction usage
   */
  async getUserMonthlyUsage(userId: string, month: Date): Promise<number> {
    const supabase = await createServerClient();
    
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
    const monthDateStr = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}-${String(startOfMonth.getDate()).padStart(2, '0')}`;
    
    // Try to get from user_monthly_usage table first
    const { data: usage, error: usageError } = await supabase
      .from("user_monthly_usage")
      .select("transactions_count")
      .eq("user_id", userId)
      .eq("month_date", monthDateStr)
      .maybeSingle();

    const hasError = usageError && (usageError as { code?: string }).code !== 'PGRST116';
    if (!usage || hasError) {
      // Fallback to counting transactions directly
      const { count } = await supabase
        .from("Transaction")
        .select("*", { count: "exact", head: true })
        .eq("userId", userId)
        .gte("date", startOfMonth.toISOString())
        .lte("date", endOfMonth.toISOString());

      return count || 0;
    }

    return usage.transactions_count || 0;
  }

  /**
   * Get user account count (including shared accounts via AccountOwner)
   */
  async getUserAccountCount(userId: string): Promise<number> {
    const supabase = await createServerClient();
    
    const [accountOwnersResult, directAccountsResult] = await Promise.all([
      supabase
        .from("AccountOwner")
        .select("accountId")
        .eq("ownerId", userId),
      supabase
        .from("Account")
        .select("id")
        .eq("userId", userId),
    ]);

    const { data: accountOwners } = accountOwnersResult;
    const { data: directAccounts } = directAccountsResult;

    const ownedAccountIds = accountOwners?.map(ao => ao.accountId) || [];
    const accountIds = new Set<string>();
    
    directAccounts?.forEach(acc => accountIds.add(acc.id));

    if (ownedAccountIds.length > 0) {
      const { data: ownedAccountsData } = await supabase
        .from("Account")
        .select("id")
        .in("id", ownedAccountIds);

      ownedAccountsData?.forEach(acc => accountIds.add(acc.id));
    }

    return accountIds.size;
  }

  /**
   * Update subscription
   */
  async update(
    id: string,
    data: Partial<{
      status: "active" | "trialing" | "cancelled" | "past_due" | "unpaid";
      updatedAt: string;
    }>
  ): Promise<void> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("Subscription")
      .update(data)
      .eq("id", id);

    if (error) {
      logger.error("[SubscriptionsRepository] Error updating subscription:", error);
      throw new Error(`Failed to update subscription: ${error.message}`);
    }
  }
}

