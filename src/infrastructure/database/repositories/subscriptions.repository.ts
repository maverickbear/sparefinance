/**
 * Subscriptions Repository
 * 
 * ⚠️ IMPORTANT: This repository handles SPARE FINANCE APP subscriptions (billing)
 * NOT external service subscriptions. For external services, see UserSubscriptionsRepository.
 * 
 * Data access layer for app subscriptions (app_plans, app_subscriptions) - only handles database operations
 * No business logic here
 */

import { createServerClient, createServiceRoleClient } from "../supabase-server";
import { logger } from "@/src/infrastructure/utils/logger";

export interface SubscriptionRow {
  id: string;
  user_id: string | null;
  household_id: string | null;
  plan_id: string;
  status: "active" | "trialing" | "cancelled" | "past_due" | "unpaid";
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end_date: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlanRow {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  features: Record<string, unknown>; // JSONB field - validated to PlanFeatures in application layer
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  stripe_product_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Apply Stripe test/sandbox ID overrides when env vars are set (localhost only).
 * In production these vars are not set, so the database (live IDs) is used.
 */
function applyStripeTestOverrides(plan: PlanRow): PlanRow {
  if (plan.id !== "pro") return plan;
  const productId = process.env.STRIPE_TEST_PRODUCT_ID_PRO;
  const priceMonthly = process.env.STRIPE_TEST_PRICE_ID_MONTHLY_PRO;
  const priceYearly = process.env.STRIPE_TEST_PRICE_ID_YEARLY_PRO;
  if (!productId || !priceMonthly || !priceYearly) return plan;
  return {
    ...plan,
    stripe_product_id: productId,
    stripe_price_id_monthly: priceMonthly,
    stripe_price_id_yearly: priceYearly,
  };
}

export class SubscriptionsRepository {
  /**
   * Find subscription by household ID
   */
  async findByHouseholdId(householdId: string, useServiceRole: boolean = false): Promise<SubscriptionRow | null> {
    let supabase;
    if (useServiceRole) {
      supabase = createServiceRoleClient();
    } else {
      try {
        supabase = await createServerClient();
      } catch (error: any) {
        // If createServerClient fails (e.g., in cache context), fallback to service role
        const errorMessage = error?.message || '';
        const errorString = String(error || '');
        const isCacheError = errorMessage.includes('use cache') || errorMessage.includes('unstable_cache') || errorMessage.includes('Dynamic data sources') || errorMessage.includes('cookies() inside') || errorString.includes('use cache') || errorString.includes('unstable_cache') || errorString.includes('Dynamic data sources');
        if (isCacheError) {
          supabase = createServiceRoleClient();
        } else {
          throw error;
        }
      }
    }

    const { data: subscriptions, error } = await supabase
      .from("app_subscriptions")
      .select("*")
      .eq("household_id", householdId)
      .in("status", ["active", "trialing", "cancelled"])
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      // Permission denied (42501) - try using service role client as fallback if not already using it
      // This can happen if the user doesn't have access to the household or subscription
      if (error.code === "42501" && !useServiceRole) {
        try {
          const serviceRoleClient = createServiceRoleClient();
          
          const { data: serviceSubscriptions, error: serviceError } = await serviceRoleClient
            .from("app_subscriptions")
            .select("*")
            .eq("household_id", householdId)
            .in("status", ["active", "trialing", "cancelled"])
            .order("created_at", { ascending: false })
            .limit(10);
          
          if (serviceError) {
            logger.error("[SubscriptionsRepository] Error fetching subscription by householdId with service role:", serviceError);
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
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
          
          return sorted[0] as SubscriptionRow;
        } catch (serviceErr) {
          logger.error("[SubscriptionsRepository] Error using service role client:", serviceErr);
          return null;
        }
      } else if (error.code === "42501") {
        logger.debug("[SubscriptionsRepository] Permission denied fetching subscription by householdId (expected during onboarding or if user doesn't have access):", { householdId });
      } else {
        logger.error("[SubscriptionsRepository] Error fetching subscription by householdId:", error);
      }
      return null;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return null;
    }

    // Prioritize: active/trialing > cancelled, then by created_at (newest first)
    // FIX: Use snake_case column name (created_at) not camelCase (createdAt)
    const sorted = subscriptions.sort((a, b) => {
      const aPriority = (a.status === "active" || a.status === "trialing") ? 0 : 1;
      const bPriority = (b.status === "active" || b.status === "trialing") ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return sorted[0] as SubscriptionRow;
  }

  /**
   * Find subscription by user ID
   */
  async findByUserId(userId: string, useServiceRole: boolean = false): Promise<SubscriptionRow | null> {
    // Validate userId
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      logger.error("[SubscriptionsRepository] Invalid userId provided to findByUserId:", { userId, type: typeof userId });
      return null;
    }

    let supabase;
    if (useServiceRole) {
      supabase = createServiceRoleClient();
    } else {
      try {
        supabase = await createServerClient();
      } catch (error: any) {
        // If createServerClient fails (e.g., in cache context), fallback to service role
        const errorMessage = error?.message || '';
        const errorString = String(error || '');
        const isCacheError = errorMessage.includes('use cache') || errorMessage.includes('unstable_cache') || errorMessage.includes('Dynamic data sources') || errorMessage.includes('cookies() inside') || errorString.includes('use cache') || errorString.includes('unstable_cache') || errorString.includes('Dynamic data sources');
        if (isCacheError) {
          supabase = createServiceRoleClient();
        } else {
          throw error;
        }
      }
    }

    const { data: subscriptions, error } = await supabase
      .from("app_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["active", "trialing", "cancelled"])
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      // Permission denied (42501) - try using service role client as fallback if not already using it
      // This can happen immediately after subscription creation when RLS hasn't propagated
      if (error.code === "42501" && !useServiceRole) {
        try {
          const { createServiceRoleClient } = await import("@/src/infrastructure/database/supabase-server");
          const serviceRoleClient = createServiceRoleClient();
          
          const { data: serviceSubscriptions, error: serviceError } = await serviceRoleClient
            .from("app_subscriptions")
            .select("*")
            .eq("user_id", userId)
            .in("status", ["active", "trialing", "cancelled"])
            .order("created_at", { ascending: false })
            .limit(10);
          
          if (serviceError) {
            logger.error("[SubscriptionsRepository] Error fetching subscription by userId with service role:", serviceError);
            return null;
          }
          
          if (!serviceSubscriptions || serviceSubscriptions.length === 0) {
            return null;
          }
          
          // Prioritize: active/trialing > cancelled, then by created_at (newest first)
          const sorted = serviceSubscriptions.sort((a, b) => {
            const aPriority = (a.status === "active" || a.status === "trialing") ? 0 : 1;
            const bPriority = (b.status === "active" || b.status === "trialing") ? 0 : 1;
            if (aPriority !== bPriority) return aPriority - bPriority;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
          
          return sorted[0] as SubscriptionRow;
        } catch (serviceErr) {
          logger.error("[SubscriptionsRepository] Error using service role client:", serviceErr);
          return null;
        }
      } else {
        return null;
      }
    }

    if (!subscriptions || subscriptions.length === 0) {
      return null;
    }

    // Prioritize: active/trialing > cancelled, then by created_at (newest first)
    const sorted = subscriptions.sort((a, b) => {
      const aPriority = (a.status === "active" || a.status === "trialing") ? 0 : 1;
      const bPriority = (b.status === "active" || b.status === "trialing") ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return sorted[0] as SubscriptionRow;
  }

  /**
   * Find all plans
   */
  async findAllPlans(): Promise<PlanRow[]> {
    try {
      const supabase = await createServerClient();

      const { data: plans, error } = await supabase
        .from("app_plans")
        .select("*")
        .order("price_monthly", { ascending: true });

      if (error) {
        // Check if the error is due to HTML response (misconfigured Supabase URL)
        const errorMessage = error.message || "";
        if (errorMessage.includes("<html>") || 
            errorMessage.includes("500 Internal Server Error") ||
            errorMessage.includes("cloudflare") ||
            errorMessage.includes("Unexpected token '<'")) {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "not set";
          console.error("[SubscriptionsRepository] Supabase URL appears misconfigured:", {
            error: error.message,
            supabaseUrl: supabaseUrl.substring(0, 50) + "...",
            suggestion: "NEXT_PUBLIC_SUPABASE_URL should point to your Supabase project (should end with .supabase.co), not your app domain",
          });
        } else {
          console.error("[SubscriptionsRepository] Error fetching plans:", error);
        }
        return [];
      }

      const rows = (plans || []) as PlanRow[];
      return rows.map(applyStripeTestOverrides);
    } catch (error) {
      // Catch any unexpected errors during build/prerender
      console.error("[SubscriptionsRepository] Error fetching plans:", error);
      return [];
    }
  }

  /**
   * Find plan by ID
   * 
   * CRITICAL: When called from within "use cache" functions, this method
   * should use the service role client to avoid accessing cookies()
   * which is not allowed inside cached functions.
   */
  async findPlanById(planId: string, useServiceRole: boolean = false): Promise<PlanRow | null> {
    // If explicitly requested or if we're in a cache context, use service role client
    // This avoids trying to access cookies() which is not allowed inside "use cache"
    let supabase;
    if (useServiceRole) {
      supabase = createServiceRoleClient();
    } else {
      // Try to use regular client first, but fall back to service role client
      // if we're inside a cached function (can't access cookies) or if RLS blocks access
      try {
        supabase = await createServerClient();
      } catch (error: any) {
        // If we can't access cookies (e.g., inside "use cache"), use service role client
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
          supabase = createServiceRoleClient();
        } else {
          throw error;
        }
      }
    }

    const { data: plan, error } = await supabase
      .from("app_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      // If we get a permission denied error, try with service role client
      if (error.code === "42501" && !useServiceRole) {
        const serviceRoleSupabase = createServiceRoleClient();
        const { data: planData, error: serviceError } = await serviceRoleSupabase
          .from("app_plans")
          .select("*")
          .eq("id", planId)
          .single();
        
        if (serviceError) {
          if (serviceError.code === 'PGRST116') {
            return null;
          }
          logger.error("[SubscriptionsRepository] Error fetching plan with service role client:", serviceError);
          return null;
        }
        
        return applyStripeTestOverrides(planData as PlanRow);
      }
      logger.error("[SubscriptionsRepository] Error fetching plan:", error);
      return null;
    }

    return applyStripeTestOverrides(plan as PlanRow);
  }

  /**
   * Get user subscription cache from User table
   * 
   * CRITICAL: When called from within "use cache" functions, this method
   * must use the service role client directly to avoid accessing cookies()
   * which is not allowed inside cached functions.
   */
  async getUserSubscriptionCache(userId: string, useServiceRole: boolean = false): Promise<{
    effective_plan_id: string | null;
    effective_subscription_status: string | null;
    effective_subscription_id: string | null;
    subscription_updated_at: string | null;
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
          supabase = createServiceRoleClient();
        } else {
          throw error;
        }
      }
    }

    // Try query with regular client first
    let { data: user, error } = await supabase
      .from("users")
      .select("effective_plan_id, effective_subscription_status, effective_subscription_id, subscription_updated_at")
      .eq("id", userId)
      .maybeSingle();

    // If we get a permission denied error, try with service role client
    // This can happen when called from a cached function where createServerClient()
    // returns an unauthenticated client that can't pass RLS
    if (error && error.code === "42501") {
      const serviceRoleSupabase = createServiceRoleClient();
      const retryResult = await serviceRoleSupabase
        .from("users")
        .select("effective_plan_id, effective_subscription_status, effective_subscription_id, subscription_updated_at")
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
  async getActiveHouseholdId(userId: string, useServiceRole: boolean = false): Promise<string | null> {
    let supabase;
    if (useServiceRole) {
      supabase = createServiceRoleClient();
    } else {
      try {
        supabase = await createServerClient();
      } catch (error: any) {
        // If createServerClient fails (e.g., in cache context), fallback to service role
        const errorMessage = error?.message || '';
        const errorString = String(error || '');
        const isCacheError = errorMessage.includes('use cache') || errorMessage.includes('unstable_cache') || errorMessage.includes('Dynamic data sources') || errorMessage.includes('cookies() inside') || errorString.includes('use cache') || errorString.includes('unstable_cache') || errorString.includes('Dynamic data sources');
        if (isCacheError) {
          supabase = createServiceRoleClient();
        } else {
          throw error;
        }
      }
    }

    const { data: activeHousehold, error: activeHouseholdError } = await supabase
      .from("system_user_active_households")
      .select("household_id")
      .eq("user_id", userId)
      .maybeSingle();

    // If RLS error and not using service role, try with service role
    if (activeHouseholdError && activeHouseholdError.code === "42501" && !useServiceRole) {
      const serviceRoleSupabase = createServiceRoleClient();
      const { data: serviceActiveHousehold } = await serviceRoleSupabase
        .from("system_user_active_households")
        .select("household_id")
        .eq("user_id", userId)
        .maybeSingle();
      
      if (serviceActiveHousehold?.household_id) {
        return serviceActiveHousehold.household_id;
      }
    } else if (activeHousehold?.household_id) {
      return activeHousehold.household_id;
    }

    // Fallback to default household
    const { data: defaultMember, error: defaultMemberError } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", userId)
      .eq("is_default", true)
      .eq("status", "active")
      .maybeSingle();

    // If RLS error and not using service role, try with service role
    if (defaultMemberError && defaultMemberError.code === "42501" && !useServiceRole) {
      const serviceRoleSupabase = createServiceRoleClient();
      const { data: serviceDefaultMember } = await serviceRoleSupabase
        .from("household_members")
        .select("household_id")
        .eq("user_id", userId)
        .eq("is_default", true)
        .eq("status", "active")
        .maybeSingle();
      
      return serviceDefaultMember?.household_id || null;
    }

    return defaultMember?.household_id || null;
  }

  /**
   * Get household owner ID
   */
  async getHouseholdOwnerId(householdId: string, useServiceRole: boolean = false): Promise<string | null> {
    let supabase;
    if (useServiceRole) {
      supabase = createServiceRoleClient();
    } else {
      try {
        supabase = await createServerClient();
      } catch (error: any) {
        // If createServerClient fails (e.g., in cache context), fallback to service role
        const errorMessage = error?.message || '';
        const errorString = String(error || '');
        const isCacheError = errorMessage.includes('use cache') || errorMessage.includes('unstable_cache') || errorMessage.includes('Dynamic data sources') || errorMessage.includes('cookies() inside') || errorString.includes('use cache') || errorString.includes('unstable_cache') || errorString.includes('Dynamic data sources');
        if (isCacheError) {
          supabase = createServiceRoleClient();
        } else {
          throw error;
        }
      }
    }

    const { data: household, error } = await supabase
      .from("households")
      .select("created_by")
      .eq("id", householdId)
      .maybeSingle();

    // If RLS error and not using service role, try with service role
    if (error && error.code === "42501" && !useServiceRole) {
      const serviceRoleSupabase = createServiceRoleClient();
      const { data: serviceHousehold } = await serviceRoleSupabase
        .from("households")
        .select("created_by")
        .eq("id", householdId)
        .maybeSingle();
      
      return serviceHousehold?.created_by || null;
    }

    return household?.created_by || null;
  }

  /**
   * Find subscription by ID
   * @param useServiceRole - If true, use service role client directly (bypasses RLS)
   *                         Useful when called from cache context where cookies() can't be accessed
   */
  async findById(id: string, useServiceRole: boolean = false): Promise<SubscriptionRow | null> {
    // If explicitly requested, use service role client directly
    // This is needed when called from "use cache" functions where cookies() can't be accessed
    if (useServiceRole) {
      const serviceRoleClient = createServiceRoleClient();
      
      const { data: subscription, error } = await serviceRoleClient
        .from("app_subscriptions")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        logger.error("[SubscriptionsRepository] Error fetching subscription by ID with service role:", error);
        return null;
      }
      
      return subscription as SubscriptionRow | null;
    }

    // Try with regular client first
    const supabase = await createServerClient();

    const { data: subscription, error } = await supabase
      .from("app_subscriptions")
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
        try {
          const serviceRoleClient = createServiceRoleClient();
          
          const { data: serviceSubscription, error: serviceError } = await serviceRoleClient
            .from("app_subscriptions")
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
    
    // Try to get from system_user_monthly_usage table first
    const { data: usage, error: usageError } = await supabase
      .from("system_user_monthly_usage")
      .select("transactions_count")
      .eq("user_id", userId)
      .eq("month_date", monthDateStr)
      .maybeSingle();

    const hasError = usageError && (usageError as { code?: string }).code !== 'PGRST116';
    if (!usage || hasError) {
      // Fallback to counting transactions directly
      const { count } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
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
        .from("account_owners")
        .select("account_id")
        .eq("owner_id", userId),
      supabase
        .from("accounts")
        .select("id")
        .eq("user_id", userId),
    ]);

    const { data: accountOwners } = accountOwnersResult;
    const { data: directAccounts } = directAccountsResult;

    const ownedAccountIds = accountOwners?.map(ao => ao.account_id) || [];
    const accountIds = new Set<string>();
    
    directAccounts?.forEach(acc => accountIds.add(acc.id));

    if (ownedAccountIds.length > 0) {
      const { data: ownedAccountsData } = await supabase
        .from("accounts")
        .select("id")
        .in("id", ownedAccountIds);

      ownedAccountsData?.forEach(acc => accountIds.add(acc.id));
    }

    return accountIds.size;
  }

  /**
   * Find subscription by pending email
   */
  async findByPendingEmail(email: string, useServiceRole: boolean = false): Promise<SubscriptionRow | null> {
    const supabase = useServiceRole ? createServiceRoleClient() : await createServerClient();

    const { data, error } = await supabase
      .from("app_subscriptions")
      .select("*")
      .eq("pending_email", email.toLowerCase())
      .is("user_id", null)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error("[SubscriptionsRepository] Error finding subscription by pending email:", error);
      return null;
    }

    return data as SubscriptionRow | null;
  }

  /**
   * Find subscription by Stripe customer ID
   */
  async findByStripeCustomerId(customerId: string, useServiceRole: boolean = false): Promise<SubscriptionRow | null> {
    const supabase = useServiceRole ? createServiceRoleClient() : await createServerClient();

    const { data, error } = await supabase
      .from("app_subscriptions")
      .select("*")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error("[SubscriptionsRepository] Error finding subscription by customer ID:", error);
      return null;
    }

    return data as SubscriptionRow | null;
  }

  /**
   * Find subscription by Stripe subscription ID
   */
  async findByStripeSubscriptionId(stripeSubscriptionId: string, useServiceRole: boolean = false): Promise<SubscriptionRow | null> {
    const supabase = useServiceRole ? createServiceRoleClient() : await createServerClient();

    const { data, error } = await supabase
      .from("app_subscriptions")
      .select("*")
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error("[SubscriptionsRepository] Error finding subscription by Stripe subscription ID:", error);
      return null;
    }

    return data as SubscriptionRow | null;
  }

  /**
   * Find plan by Stripe price ID
   */
  async findPlanByPriceId(priceId: string, useServiceRole: boolean = false): Promise<PlanRow | null> {
    const supabase = useServiceRole ? createServiceRoleClient() : await createServerClient();

    const { data, error } = await supabase
      .from("app_plans")
      .select("*")
      .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error("[SubscriptionsRepository] Error finding plan by price ID:", error);
      return null;
    }

    return data as PlanRow | null;
  }

  /**
   * Create subscription
   */
  async create(data: {
    id: string;
    userId: string;
    householdId: string;
    planId: string;
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    status: "active" | "trialing" | "cancelled" | "past_due" | "unpaid";
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    trialStartDate?: string | null;
    trialEndDate?: string | null;
    pendingEmail?: string | null;
    createdAt: string;
    updatedAt: string;
  }, useServiceRole: boolean = false): Promise<SubscriptionRow> {
    const supabase = useServiceRole ? createServiceRoleClient() : await createServerClient();

    const insertData = {
      id: data.id,
      user_id: data.userId,
      household_id: data.householdId,
      plan_id: data.planId,
      stripe_subscription_id: data.stripeSubscriptionId,
      stripe_customer_id: data.stripeCustomerId,
      status: data.status,
      current_period_start: data.currentPeriodStart,
      current_period_end: data.currentPeriodEnd,
      cancel_at_period_end: data.cancelAtPeriodEnd,
      trial_start_date: data.trialStartDate || null,
      trial_end_date: data.trialEndDate || null,
      pending_email: data.pendingEmail || null,
      created_at: data.createdAt,
      updated_at: data.updatedAt,
    };

    const { data: subscription, error } = await supabase
      .from("app_subscriptions")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      logger.error("[SubscriptionsRepository] Error creating subscription:", error);
      throw new Error(`Failed to create subscription: ${error.message}`);
    }

    return subscription as SubscriptionRow;
  }

  /**
   * Update subscription
   */
  async update(
    id: string,
    data: Partial<{
      userId: string;
      householdId: string;
      planId: string;
      stripeSubscriptionId: string;
      stripeCustomerId: string;
      status: "active" | "trialing" | "cancelled" | "past_due" | "unpaid";
      currentPeriodStart: string;
      currentPeriodEnd: string;
      cancelAtPeriodEnd: boolean;
      trialStartDate: string | null;
      trialEndDate: string | null;
      pendingEmail: string | null;
      updatedAt: string;
    }>,
    useServiceRole: boolean = false
  ): Promise<void> {
    const supabase = useServiceRole ? createServiceRoleClient() : await createServerClient();

    // Map camelCase to snake_case for database
    const updateData: Record<string, unknown> = {};
    if (data.userId !== undefined) updateData.user_id = data.userId;
    if (data.householdId !== undefined) updateData.household_id = data.householdId;
    if (data.planId !== undefined) updateData.plan_id = data.planId;
    if (data.stripeSubscriptionId !== undefined) updateData.stripe_subscription_id = data.stripeSubscriptionId;
    if (data.stripeCustomerId !== undefined) updateData.stripe_customer_id = data.stripeCustomerId;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.currentPeriodStart !== undefined) updateData.current_period_start = data.currentPeriodStart;
    if (data.currentPeriodEnd !== undefined) updateData.current_period_end = data.currentPeriodEnd;
    if (data.cancelAtPeriodEnd !== undefined) updateData.cancel_at_period_end = data.cancelAtPeriodEnd;
    if (data.trialStartDate !== undefined) updateData.trial_start_date = data.trialStartDate;
    if (data.trialEndDate !== undefined) updateData.trial_end_date = data.trialEndDate;
    if (data.pendingEmail !== undefined) updateData.pending_email = data.pendingEmail;
    if (data.updatedAt !== undefined) updateData.updated_at = data.updatedAt;

    const { error } = await supabase
      .from("app_subscriptions")
      .update(updateData)
      .eq("id", id);

    if (error) {
      logger.error("[SubscriptionsRepository] Error updating subscription:", error);
      throw new Error(`Failed to update subscription: ${error.message}`);
    }
  }

  /**
   * Delete subscription
   */
  async delete(id: string, useServiceRole: boolean = false): Promise<void> {
    const supabase = useServiceRole ? createServiceRoleClient() : await createServerClient();

    const { error } = await supabase
      .from("app_subscriptions")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("[SubscriptionsRepository] Error deleting subscription:", error);
      throw new Error(`Failed to delete subscription: ${error.message}`);
    }
  }
}

