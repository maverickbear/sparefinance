"use server";

/**
 * UNIFIED SUBSCRIPTION API
 * 
 * This is the SINGLE SOURCE OF TRUTH for subscription, plans, and limits.
 * All other modules should use this API instead of accessing plans/limits directly.
 * 
 * Architecture:
 * - Stripe is the source of truth for subscription management (via Portal)
 * - Database is the source of truth for plan features
 * - This API provides a unified interface to access both
 */

import { createServerClient } from "@/lib/supabase-server";
import { Plan, PlanFeatures, Subscription } from "@/lib/validations/plan";
import { logger } from "@/lib/utils/logger";
import { getDefaultFeatures } from "@/lib/utils/plan-features";

// Re-export types for convenience
export type { Subscription, Plan, PlanFeatures };

export interface SubscriptionData {
  subscription: Subscription | null;
  plan: Plan | null;
  limits: PlanFeatures;
}

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const plansCache = new Map<string, Plan>();
let plansCacheTimestamp = 0;

const subscriptionCache = new Map<string, 
  | { data: SubscriptionData; timestamp: number; type: 'result' }
  | { promise: Promise<SubscriptionData>; timestamp: number; type: 'promise' }
>();

const invalidationTimestamps = new Map<string, number>();

/**
 * Invalidate subscription cache for a user
 * Call this when subscriptions are created, updated, or deleted (e.g., from webhooks)
 */
export async function invalidateSubscriptionCache(userId: string): Promise<void> {
  subscriptionCache.delete(userId);
  invalidationTimestamps.set(userId, Date.now());
  const log = logger.withPrefix("SUBSCRIPTION");
  log.debug("Invalidated subscription cache for user:", userId);
}

/**
 * Invalidate plans cache
 * Call this when plans are updated in the database
 */
export async function invalidatePlansCache(): Promise<void> {
  plansCache.clear();
  plansCacheTimestamp = 0;
  const log = logger.withPrefix("SUBSCRIPTION");
  log.debug("Invalidated plans cache");
}

/**
 * Get all available plans
 */
export async function getPlans(): Promise<Plan[]> {
  try {
    const now = Date.now();
    if (plansCache.size === 0 || (now - plansCacheTimestamp) > CACHE_TTL) {
      await refreshPlansCache();
    }
    
    return Array.from(plansCache.values());
  } catch (error) {
    logger.error("Error fetching plans:", error);
    return [];
  }
}

/**
 * Get plan by ID
 */
export async function getPlanById(planId: string): Promise<Plan | null> {
  try {
    // Check cache first
    const cached = plansCache.get(planId);
    if (cached) {
      return cached;
    }

    // Refresh cache if needed
    const now = Date.now();
    if (plansCache.size === 0 || (now - plansCacheTimestamp) > CACHE_TTL) {
      await refreshPlansCache();
    }

    return plansCache.get(planId) || null;
  } catch (error) {
    logger.error("Error fetching plan by ID:", error);
    return null;
  }
}

/**
 * Get plan name by ID (convenience function)
 */
export async function getPlanNameById(planId: string): Promise<string | null> {
  const plan = await getPlanById(planId);
  return plan?.name || null;
}

/**
 * Get current user's subscription data (subscription + plan + limits)
 * This is the main function to use - it returns everything needed
 */
export async function getCurrentUserSubscriptionData(): Promise<SubscriptionData> {
  try {
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return {
        subscription: null,
        plan: null,
        limits: getDefaultFeatures(),
      };
    }

    return await getUserSubscriptionData(authUser.id);
  } catch (error) {
    logger.error("Error getting current user subscription data:", error);
    return {
      subscription: null,
      plan: null,
      limits: getDefaultFeatures(),
    };
  }
}

/**
 * Get subscription data for a specific user
 * Handles household member inheritance automatically
 */
export async function getUserSubscriptionData(userId: string): Promise<SubscriptionData> {
  try {
    const now = Date.now();
    const invalidationTime = invalidationTimestamps.get(userId) || 0;
    
    // Check cache
    const cached = subscriptionCache.get(userId);
    if (cached && cached.type === 'result') {
      const age = now - cached.timestamp;
      const isInvalidated = invalidationTime > cached.timestamp;
      
      if (!isInvalidated && age < CACHE_TTL) {
        return cached.data;
      }
    }

    // Check for in-flight promise
    if (cached && cached.type === 'promise') {
      const age = now - cached.timestamp;
      if (age < 10000) { // 10 seconds max for promises
        return await cached.promise;
      }
    }

    // Fetch data
    const fetchPromise = fetchUserSubscriptionData(userId)
      .then((data) => {
        subscriptionCache.set(userId, {
          data,
          timestamp: Date.now(),
          type: 'result',
        });
        return data;
      })
      .catch((error) => {
        subscriptionCache.delete(userId);
        throw error;
      });

    // Cache promise immediately to prevent concurrent calls
    subscriptionCache.set(userId, {
      promise: fetchPromise,
      timestamp: now,
      type: 'promise',
    });

    return await fetchPromise;
  } catch (error) {
    logger.error("Error getting user subscription data:", error);
    return {
      subscription: null,
      plan: null,
      limits: getDefaultFeatures(),
    };
  }
}

/**
 * Internal function to fetch subscription data from database
 */
async function fetchUserSubscriptionData(userId: string): Promise<SubscriptionData> {
  const supabase = await createServerClient();
  const log = logger.withPrefix("SUBSCRIPTION");
  
  // Check if user is a household member
  const { data: member, error: memberError } = await supabase
    .from("HouseholdMember")
    .select("ownerId, status")
    .eq("memberId", userId)
    .eq("status", "active")
    .maybeSingle();
  
  if (memberError && memberError.code !== "PGRST116") {
    log.error("Error checking household membership:", memberError);
  }

  const isMember = member !== null;
  const ownerId = member?.ownerId || null;
  
  // Only treat as household member if ownerId exists and is different from userId
  // This prevents issues where a user might have a HouseholdMember record pointing to themselves
  const isActualMember = isMember && ownerId && ownerId !== userId;
  const effectiveUserId = isActualMember ? ownerId : userId;
  
  if (isActualMember) {
    log.debug("User is household member, using owner's subscription:", { userId, ownerId });
  } else if (isMember && ownerId === userId) {
    log.warn("Invalid household member record: user is their own owner", { userId });
  }

  // Get subscription (active or trialing)
  const { data: subscription, error: subError } = await supabase
    .from("Subscription")
    .select("*")
    .eq("userId", effectiveUserId)
    .in("status", ["active", "trialing"])
    .order("createdAt", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subError && subError.code !== "PGRST116") {
    log.error("Error fetching subscription:", subError);
  }

  if (!subscription) {
    return {
      subscription: null,
      plan: null,
      limits: getDefaultFeatures(),
    };
  }

  // Validate trial if trialing
  if (subscription.status === "trialing" && subscription.trialEndDate) {
    const trialEnd = new Date(subscription.trialEndDate);
    const now = new Date();
    if (trialEnd <= now) {
      // Trial expired, but subscription still exists - return as if no subscription
      log.debug("Trial expired for subscription:", subscription.id);
      return {
        subscription: null,
        plan: null,
        limits: getDefaultFeatures(),
      };
    }
  }

  // Get plan
  const plan = await getPlanById(subscription.planId);
  if (!plan) {
    log.warn("Plan not found for subscription:", { subscriptionId: subscription.id, planId: subscription.planId });
    return {
      subscription,
      plan: null,
      limits: getDefaultFeatures(),
    };
  }

  // Use plan features directly from database (source of truth)
  return {
    subscription,
    plan,
    limits: plan.features,
  };
}

/**
 * Refresh plans cache
 */
async function refreshPlansCache(): Promise<void> {
  try {
    const supabase = await createServerClient();
    
    const { data: plans, error } = await supabase
      .from("Plan")
      .select("*")
      .order("priceMonthly", { ascending: true });

    if (error || !plans) {
      logger.error("Error fetching plans for cache:", error);
      return;
    }

    plansCache.clear();
    
    plans.forEach(plan => {
      const mappedPlan = mapPlan(plan);
      plansCache.set(mappedPlan.id, mappedPlan);
    });
    
    plansCacheTimestamp = Date.now();
  } catch (error) {
    logger.error("Error refreshing plans cache:", error);
  }
}

/**
 * Map database plan to Plan type
 */
function mapPlan(data: any): Plan {
  // Use features directly from database - no merging with defaults
  // The database is the source of truth
  const features: PlanFeatures = data.features || getDefaultFeatures();
  
  return {
    id: data.id,
    name: data.name,
    priceMonthly: data.priceMonthly,
    priceYearly: data.priceYearly,
    features,
    stripePriceIdMonthly: data.stripePriceIdMonthly || null,
    stripePriceIdYearly: data.stripePriceIdYearly || null,
    stripeProductId: data.stripeProductId || null,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };
}

// ============================================================================
// LIMIT CHECKS
// ============================================================================

export interface LimitCheckResult {
  allowed: boolean;
  limit: number;
  current: number;
  message?: string;
}

/**
 * Check if user can create a new transaction (monthly limit)
 */
export async function checkTransactionLimit(userId: string, month: Date = new Date()): Promise<LimitCheckResult> {
  try {
    const { limits, plan } = await getUserSubscriptionData(userId);
    
    const supabase = await createServerClient();
    
    // Get start and end of month
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);

    // Try to use user_monthly_usage table first (faster)
    const monthDateStr = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}-${String(startOfMonth.getDate()).padStart(2, '0')}`;
    
    const { data: usage, error: usageError } = await supabase
      .from("user_monthly_usage")
      .select("transactions_count")
      .eq("user_id", userId)
      .eq("month_date", monthDateStr)
      .maybeSingle();

    let current = 0;
    
    // If no usage data found (null) or error (except not found), fallback to COUNT
    if (!usage || (usageError && usageError.code !== 'PGRST116')) {
      // Fallback to COUNT if table doesn't have data or has error
      const { count, error } = await supabase
        .from("Transaction")
        .select("*", { count: "exact", head: true })
        .eq("userId", userId)
        .gte("date", startOfMonth.toISOString())
        .lte("date", endOfMonth.toISOString());

      if (error) {
        logger.error("Error checking transaction limit:", error);
        return {
          allowed: limits.maxTransactions === -1 ? true : false,
          limit: limits.maxTransactions,
          current: 0,
          message: "Error checking limit",
        };
      }

      current = count || 0;
    } else {
      current = usage.transactions_count || 0;
    }

    // Unlimited transactions - always allowed, but show actual count
    if (limits.maxTransactions === -1) {
      return {
        allowed: true,
        limit: -1,
        current,
      };
    }

    const allowed = current < limits.maxTransactions;

    return {
      allowed,
      limit: limits.maxTransactions,
      current,
      message: allowed ? undefined : `You've reached your monthly transaction limit (${limits.maxTransactions}). Upgrade to continue.`,
    };
  } catch (error) {
    logger.error("Error in checkTransactionLimit:", error);
    return {
      allowed: false,
      limit: 50,
      current: 0,
      message: "Error checking limit",
    };
  }
}

/**
 * Check if user can create a new account
 */
export async function checkAccountLimit(userId: string): Promise<LimitCheckResult> {
  try {
    const { limits } = await getUserSubscriptionData(userId);
    
    const supabase = await createServerClient();
    
    // Count accounts where user is owner via userId OR via AccountOwner
    // Get all account IDs where user is owner via AccountOwner
    const { data: accountOwners } = await supabase
      .from("AccountOwner")
      .select("accountId")
      .eq("ownerId", userId);

    const ownedAccountIds = accountOwners?.map(ao => ao.accountId) || [];
    
    // Get all unique account IDs: those with userId = userId OR those in ownedAccountIds
    const accountIds = new Set<string>();
    
    // Get accounts with userId = userId
    const { data: directAccounts, error: directError } = await supabase
      .from("Account")
      .select("id")
      .eq("userId", userId);

    if (directError) {
      logger.error("Error fetching direct accounts:", directError);
    } else {
      directAccounts?.forEach(acc => accountIds.add(acc.id));
    }

    // Get accounts owned via AccountOwner
    let ownedAccounts: { id: string }[] | null = null;
    if (ownedAccountIds.length > 0) {
      const { data, error: ownedError } = await supabase
        .from("Account")
        .select("id")
        .in("id", ownedAccountIds);

      if (ownedError) {
        logger.error("Error fetching owned accounts:", ownedError);
      } else {
        ownedAccounts = data;
        ownedAccounts?.forEach(acc => accountIds.add(acc.id));
      }
    }

    const count = accountIds.size;
    
    const log = logger.withPrefix("SUBSCRIPTION");
    log.debug("Account limit check:", {
      userId,
      directAccountsCount: directAccounts?.length || 0,
      ownedAccountIdsCount: ownedAccountIds.length,
      ownedAccountsCount: ownedAccounts?.length || 0,
      totalCount: count,
      limit: limits.maxAccounts,
    });

    // Unlimited accounts - always allowed, but show actual count
    if (limits.maxAccounts === -1) {
      return {
        allowed: true,
        limit: -1,
        current: count,
      };
    }

    const allowed = count < limits.maxAccounts;

    return {
      allowed,
      limit: limits.maxAccounts,
      current: count,
      message: allowed ? undefined : `You've reached your account limit (${limits.maxAccounts}). Upgrade to continue.`,
    };
  } catch (error) {
    logger.error("Error in checkAccountLimit:", error);
    return {
      allowed: false,
      limit: 2,
      current: 0,
      message: "Error checking limit",
    };
  }
}

/**
 * Check if user has access to a specific feature
 */
export async function checkFeatureAccess(userId: string, feature: keyof PlanFeatures): Promise<boolean> {
  try {
    const { limits } = await getUserSubscriptionData(userId);
    
    // Check the feature value directly from the database
    // The database is the source of truth
    const featureValue = limits[feature];
    return featureValue === true;
  } catch (error) {
    logger.error("Error in checkFeatureAccess:", error);
    return false;
  }
}

