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
import { normalizeAndValidateFeatures } from "@/lib/api/plan-features-service";

// Re-export types for convenience
export type { Subscription, Plan, PlanFeatures };

export interface SubscriptionData {
  subscription: Subscription | null;
  plan: Plan | null;
  limits: PlanFeatures;
}

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const PLANS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes - plans change rarely
const plansCache = new Map<string, Plan>();
let plansCacheTimestamp = 0;

const subscriptionCache = new Map<string, 
  | { data: SubscriptionData; timestamp: number; type: 'result' }
  | { promise: Promise<SubscriptionData>; timestamp: number; type: 'promise' }
>();

const invalidationTimestamps = new Map<string, number>();

// Request-level cache to prevent duplicate calls within the same request
// This is cleared after a short timeout (1 second) to avoid memory leaks
const requestCache = new Map<string, Promise<SubscriptionData>>();

/**
 * Invalidate subscription cache for a user
 * Call this when subscriptions are created, updated, or deleted (e.g., from webhooks)
 */
export async function invalidateSubscriptionCache(userId: string): Promise<void> {
  subscriptionCache.delete(userId);
  requestCache.delete(`subscription:${userId}`);
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
  log.debug("Invalidated plans cache - will refresh on next access");
}

/**
 * Invalidate subscription cache for all users with a specific plan
 * Call this when a plan is updated to ensure all users see the new features
 */
export async function invalidateSubscriptionsForPlan(planId: string): Promise<void> {
  try {
    const supabase = await createServerClient();
    const log = logger.withPrefix("SUBSCRIPTION");
    
    // Get all active subscriptions with this plan
    const { data: subscriptions, error } = await supabase
      .from("Subscription")
      .select("userId, householdId")
      .eq("planId", planId)
      .in("status", ["active", "trialing"]);
    
    if (error) {
      log.error("Error fetching subscriptions for plan:", { planId, error });
      return;
    }
    
    if (!subscriptions || subscriptions.length === 0) {
      log.debug("No active subscriptions found for plan:", planId);
      return;
    }
    
    // Collect all user IDs (from userId and household members)
    const userIds = new Set<string>();
    
    for (const sub of subscriptions) {
      // Add direct userId if exists
      if (sub.userId) {
        userIds.add(sub.userId);
      }
      
      // If household subscription, invalidate all household members
      if (sub.householdId) {
        const { data: members } = await supabase
          .from("HouseholdMemberNew")
          .select("userId")
          .eq("householdId", sub.householdId)
          .eq("status", "active");
        
        if (members) {
          members.forEach(m => {
            if (m.userId) {
              userIds.add(m.userId);
            }
          });
        }
      }
    }
    
    // Invalidate cache for all users
    let invalidatedCount = 0;
    for (const userId of userIds) {
      subscriptionCache.delete(userId);
      invalidationTimestamps.set(userId, Date.now());
      invalidatedCount++;
    }
    
    log.debug("Invalidated subscription cache for plan:", {
      planId,
      subscriptionCount: subscriptions.length,
      userCount: userIds.size,
      invalidatedCount,
    });
  } catch (error) {
    logger.error("Error invalidating subscriptions for plan:", { planId, error });
  }
}

/**
 * Get all available plans
 */
export async function getPlans(): Promise<Plan[]> {
  try {
    const now = Date.now();
    // PERFORMANCE: Use longer TTL for plans cache (plans change rarely)
    if (plansCache.size === 0 || (now - plansCacheTimestamp) > PLANS_CACHE_TTL) {
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
    // PERFORMANCE: Use longer TTL for plans cache (plans change rarely)
    if (plansCache.size === 0 || (now - plansCacheTimestamp) > PLANS_CACHE_TTL) {
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
    
    // OPTIMIZED: Check request-level cache first (prevents duplicate calls in same request)
    const requestKey = `subscription:${userId}`;
    const requestCached = requestCache.get(requestKey);
    if (requestCached) {
      return await requestCached;
    }
    
    // Check persistent cache
    const cached = subscriptionCache.get(userId);
    if (cached && cached.type === 'result') {
      const age = now - cached.timestamp;
      const isInvalidated = invalidationTime > cached.timestamp;
      
      if (!isInvalidated && age < CACHE_TTL) {
        // Cache in request cache for reuse
        const resultPromise = Promise.resolve(cached.data);
        requestCache.set(requestKey, resultPromise);
        setTimeout(() => requestCache.delete(requestKey), 1000);
        return cached.data;
      }
    }

    // Check for in-flight promise
    if (cached && cached.type === 'promise') {
      const age = now - cached.timestamp;
      if (age < 10000) { // 10 seconds max for promises
        // Cache in request cache for reuse
        requestCache.set(requestKey, cached.promise);
        setTimeout(() => requestCache.delete(requestKey), 1000);
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
        requestCache.delete(requestKey);
        throw error;
      });

    // Cache promise immediately to prevent concurrent calls
    subscriptionCache.set(userId, {
      promise: fetchPromise,
      timestamp: now,
      type: 'promise',
    });
    
    // Cache in request cache for reuse within the same request
    requestCache.set(requestKey, fetchPromise);
    setTimeout(() => requestCache.delete(requestKey), 1000);

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
  
  // PERFORMANCE OPTIMIZATION: Try to use cached subscription fields from User table first
  // This avoids 2 queries (HouseholdMember + Subscription) and uses only 1 query (User)
  const { data: user, error: userError } = await supabase
    .from("User")
    .select("effectivePlanId, effectiveSubscriptionStatus, effectiveSubscriptionId, subscriptionUpdatedAt")
    .eq("id", userId)
    .maybeSingle();

  if (userError && userError.code !== "PGRST116") {
    log.error("Error fetching user subscription cache:", userError);
  }

  // If we have cached subscription data and it's recent (less than 5 minutes old), use it
  if (user?.effectivePlanId && user?.effectiveSubscriptionStatus && user?.subscriptionUpdatedAt) {
    const subscriptionUpdatedAtTime = new Date(user.subscriptionUpdatedAt).getTime();
    const now = Date.now();
    const cacheAge = now - subscriptionUpdatedAtTime;
    const CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes
    
    // PERFORMANCE: Handle future timestamps (clock skew or timezone issues)
    // If timestamp is in the future, treat as valid cache (likely clock skew or timezone difference)
    // Only reject if timestamp is invalid (NaN) or extremely old (>1 hour in past)
    const isValidTimestamp = !isNaN(subscriptionUpdatedAtTime) && subscriptionUpdatedAtTime > 0;
    const isFutureTimestamp = cacheAge < 0;
    const isRecentCache = cacheAge >= 0 && cacheAge < CACHE_MAX_AGE;
    const isVeryOldCache = cacheAge > 60 * 60 * 1000; // More than 1 hour old
    
    // Use cache if: valid timestamp AND (recent OR future timestamp OR not very old)
    // Future timestamps are accepted as valid (clock skew/timezone issues)
    if (isValidTimestamp && (isRecentCache || isFutureTimestamp || !isVeryOldCache)) {
      log.debug("Using cached subscription data from User table", {
        userId,
        planId: user.effectivePlanId,
        status: user.effectiveSubscriptionStatus,
        cacheAge: `${Math.round(cacheAge / 1000)}s`,
        isFutureTimestamp: isFutureTimestamp,
      });

      // Get plan details
      const { data: plan, error: planError } = await supabase
        .from("Plan")
        .select("*")
        .eq("id", user.effectivePlanId)
        .maybeSingle();

      if (planError && planError.code !== "PGRST116") {
        log.error("Error fetching plan:", planError);
      }

      if (plan) {
        // Get full subscription details if we have subscriptionId
        let fullSubscription: Subscription | null = null;
        if (user.effectiveSubscriptionId) {
          const { data: subscriptionData } = await supabase
            .from("Subscription")
            .select("*")
            .eq("id", user.effectiveSubscriptionId)
            .maybeSingle();
          
          if (subscriptionData) {
            fullSubscription = subscriptionData as Subscription;
          }
        }

        const mappedPlan = mapPlan(plan);
        return {
          subscription: fullSubscription || (user.effectiveSubscriptionId ? {
            id: user.effectiveSubscriptionId,
            userId: userId,
            planId: user.effectivePlanId,
            status: user.effectiveSubscriptionStatus as any,
          } as Subscription : null),
          plan: mappedPlan,
          limits: mappedPlan.features, // Use mapped plan features (already processed from database)
        };
      }
    } else {
      // Only log if cache is truly expired (invalid timestamp or very old)
      // Future timestamps are now accepted, so we only log if it's invalid or very old
      if (!isValidTimestamp || isVeryOldCache) {
        const reason = !isValidTimestamp 
          ? "invalid_timestamp" 
          : "too_old";
        
        log.debug("Cache expired, falling back to full query", {
          userId,
          cacheAge: `${Math.round(cacheAge / 1000)}s`,
          reason,
          subscriptionUpdatedAt: user.subscriptionUpdatedAt,
          isValidTimestamp,
        });
      }
      
      // If cache is very stale (>1 hour) or invalid, refresh it in background
      // This helps prevent future cache misses without blocking the current request
      // Note: Future timestamps are now accepted, so we don't refresh for those
      if (!isValidTimestamp || isVeryOldCache) {
        void Promise.resolve(supabase.rpc('update_user_subscription_cache', { p_user_id: userId }))
          .then(() => {
            log.debug("Background cache refresh completed", { userId });
          })
          .catch((err: unknown) => {
            log.warn("Failed to refresh stale subscription cache in background", {
              userId,
              error: err instanceof Error ? err.message : String(err),
            });
          });
      }
    }
  }

  // FALLBACK: If cache is missing or expired, use optimized query logic
  // Only log if we're actually doing a full query (not just cache miss on first load)
  if (!user?.effectivePlanId) {
    log.debug("Using fallback subscription query (cache miss or expired)", { userId });
  }
  
  // ARCHITECTURE: Subscriptions are by household, not by user
  // All members of the same household share the same subscription
  // Priority: householdId first (current architecture), then userId (backward compatibility)
  
  // Step 1: Get householdId first (needed for primary lookup)
  let householdId: string | null = null;
  const { data: activeHousehold } = await supabase
    .from("UserActiveHousehold")
    .select("householdId")
    .eq("userId", userId)
    .maybeSingle();
  
  if (activeHousehold?.householdId) {
    householdId = activeHousehold.householdId;
  } else {
    // Fallback to default household
    const { data: defaultMember } = await supabase
      .from("HouseholdMemberNew")
      .select("householdId")
      .eq("userId", userId)
      .eq("isDefault", true)
      .eq("status", "active")
      .maybeSingle();
    
    householdId = defaultMember?.householdId || null;
  }

  // Step 2: Get ownerId if user is a household member (needed for inheritance)
  let ownerId: string | null = null;
  if (householdId) {
    try {
      const { data: household } = await supabase
        .from("Household")
        .select("createdBy")
        .eq("id", householdId)
        .maybeSingle();
      
      if (household?.createdBy && household.createdBy !== userId) {
        ownerId = household.createdBy;
        log.debug("User is household member, ownerId:", { userId, ownerId, householdId });
      }
    } catch (error) {
      log.warn("Error fetching household owner:", error);
    }
  }

  // Step 3: Fetch subscriptions in parallel (householdId primary, ownerId for inheritance, userId fallback)
  const [subscriptionByHouseholdResult, subscriptionByOwnerIdResult, subscriptionByUserIdResult] = await Promise.all([
    // PRIMARY: Get subscription by householdId (current architecture)
    householdId
      ? supabase
          .from("Subscription")
          .select("*")
          .eq("householdId", householdId)
          .in("status", ["active", "trialing", "cancelled"])
          .order("createdAt", { ascending: false })
          .limit(10)
          .then(({ data, error }) => {
            if (error && error.code !== "PGRST116") {
              log.error("Error fetching subscription by householdId:", error);
              return null;
            }
            if (!data || data.length === 0) {
              log.debug("No subscription found by householdId", { householdId, userId });
              return null;
            }
            // Prioritize: active/trialing > cancelled, then by createdAt (newest first)
            const sorted = data.sort((a, b) => {
              const aPriority = (a.status === "active" || a.status === "trialing") ? 0 : 1;
              const bPriority = (b.status === "active" || b.status === "trialing") ? 0 : 1;
              if (aPriority !== bPriority) return aPriority - bPriority;
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
            log.debug("Found subscription by householdId", { 
              subscriptionId: sorted[0].id, 
              status: sorted[0].status,
              householdId 
            });
            return sorted[0] as Subscription;
          })
      : Promise.resolve(null),
    // INHERITANCE: Get subscription by ownerId (for household members to inherit owner's subscription)
    ownerId
      ? supabase
          .from("Subscription")
          .select("*")
          .eq("userId", ownerId)
          .in("status", ["active", "trialing", "cancelled"])
          .order("createdAt", { ascending: false })
          .limit(10)
          .then(({ data, error }) => {
            if (error && error.code !== "PGRST116") {
              log.error("Error fetching subscription by ownerId:", error);
              return null;
            }
            if (!data || data.length === 0) {
              log.debug("No subscription found by ownerId", { ownerId, userId, householdId });
              return null;
            }
            // Prioritize: active/trialing > cancelled, then by createdAt (newest first)
            const sorted = data.sort((a, b) => {
              const aPriority = (a.status === "active" || a.status === "trialing") ? 0 : 1;
              const bPriority = (b.status === "active" || b.status === "trialing") ? 0 : 1;
              if (aPriority !== bPriority) return aPriority - bPriority;
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
            log.debug("Found subscription by ownerId (inheritance)", { 
              subscriptionId: sorted[0].id, 
              status: sorted[0].status,
              ownerId,
              memberUserId: userId,
              householdId 
            });
            return sorted[0] as Subscription;
          })
      : Promise.resolve(null),
    // FALLBACK: Get subscription by userId (backward compatibility for old subscriptions)
    supabase
      .from("Subscription")
      .select("*")
      .eq("userId", userId)
      .in("status", ["active", "trialing", "cancelled"])
      .order("createdAt", { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (error && error.code !== "PGRST116") {
          log.error("Error fetching subscription by userId:", error);
          return null;
        }
        if (!data || data.length === 0) {
          log.debug("No subscription found by userId", { userId });
          return null;
        }
        // Prioritize: active/trialing > cancelled, then by createdAt (newest first)
        const sorted = data.sort((a, b) => {
          const aPriority = (a.status === "active" || a.status === "trialing") ? 0 : 1;
          const bPriority = (b.status === "active" || b.status === "trialing") ? 0 : 1;
          if (aPriority !== bPriority) return aPriority - bPriority;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        log.debug("Found subscription by userId", { 
          subscriptionId: sorted[0].id, 
          status: sorted[0].status,
          userId 
        });
        return sorted[0] as Subscription;
      })
  ]);

  let subscription: Subscription | null = null;

  // PRIMARY: Use householdId subscription (current architecture - subscriptions are by household)
  if (subscriptionByHouseholdResult) {
    subscription = subscriptionByHouseholdResult;
    log.debug("Found subscription by householdId (primary):", { 
      userId, 
      householdId, 
      subscriptionId: subscription.id,
      status: subscription.status 
    });
  } 
  // INHERITANCE: If no subscription found by householdId, try owner's subscription (for household members)
  else if (subscriptionByOwnerIdResult) {
    subscription = subscriptionByOwnerIdResult;
    log.debug("Found subscription by ownerId (inheritance for household member):", { 
      userId, 
      ownerId,
      householdId,
      subscriptionId: subscription.id, 
      status: subscription.status 
    });
  }
  // FALLBACK: If no subscription found by householdId or ownerId, try userId (backward compatibility)
  else if (subscriptionByUserIdResult) {
    subscription = subscriptionByUserIdResult;
    log.debug("Found subscription by userId (fallback for backward compatibility):", { 
      userId, 
      subscriptionId: subscription.id, 
      status: subscription.status 
    });
  }

  if (!subscription) {
    log.debug("No subscription found for user:", { 
      userId, 
      householdId,
      ownerId,
      subscriptionByHouseholdResult: subscriptionByHouseholdResult ? "found" : "not found",
      subscriptionByOwnerIdResult: subscriptionByOwnerIdResult ? "found" : "not found",
      subscriptionByUserIdResult: subscriptionByUserIdResult ? "found" : "not found"
    });
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

  // Debug: Log plan features from database
  log.debug("Plan features from database:", {
    planId: plan.id,
    planName: plan.name,
    features: JSON.stringify(plan.features),
    hasAdvancedReports: plan.features?.hasAdvancedReports,
    hasAdvancedReportsType: typeof plan.features?.hasAdvancedReports,
  });

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
    const log = logger.withPrefix("SUBSCRIPTION");
    
    log.debug("Refreshing plans cache from database");
    
    const { data: plans, error } = await supabase
      .from("Plan")
      .select("*")
      .order("priceMonthly", { ascending: true });

    if (error || !plans) {
      logger.error("Error fetching plans for cache:", error);
      return;
    }

    log.debug("Plans fetched from database:", {
      count: plans.length,
      plans: plans.map(p => ({
        id: p.id,
        name: p.name,
        features: p.features,
        featuresType: typeof p.features,
      })),
    });

    plansCache.clear();
    
    plans.forEach(plan => {
      const mappedPlan = mapPlan(plan);
      plansCache.set(mappedPlan.id, mappedPlan);
    });
    
    plansCacheTimestamp = Date.now();
    log.debug("Plans cache refreshed:", {
      cacheSize: plansCache.size,
      cachedPlanIds: Array.from(plansCache.keys()),
    });
    
    plansCacheTimestamp = Date.now();
  } catch (error) {
    logger.error("Error refreshing plans cache:", error);
  }
}

/**
 * Map database plan to Plan type
 * Uses centralized feature normalization and validation
 */
function mapPlan(data: any): Plan {
  const log = logger.withPrefix("SUBSCRIPTION");
  
  // Use centralized service to normalize and validate features
  const features = normalizeAndValidateFeatures(data.features, data.id);
  
  // Debug: Log what we're mapping
  log.debug("Mapping plan features:", {
    planId: data.id,
    planName: data.name,
    featuresRaw: data.features,
    featuresType: typeof data.features,
    featuresMapped: JSON.stringify(features),
    hasAdvancedReports: features.hasAdvancedReports,
    hasAdvancedReportsType: typeof features.hasAdvancedReports,
  });
  
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
    const hasError = usageError && (usageError as { code?: string }).code !== 'PGRST116';
    if (!usage || hasError) {
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
      message: allowed ? undefined : `You've reached your monthly transaction limit (${limits.maxTransactions}).`,
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
    
    // OPTIMIZATION: Fetch all account data in parallel instead of sequentially
    // This reduces total query time from 3 sequential queries to 2 parallel queries
    const [accountOwnersResult, directAccountsResult] = await Promise.all([
      // Get all account IDs where user is owner via AccountOwner
      supabase
        .from("AccountOwner")
        .select("accountId")
        .eq("ownerId", userId),
      // Get accounts with userId = userId
      supabase
        .from("Account")
        .select("id")
        .eq("userId", userId),
    ]);

    const { data: accountOwners, error: accountOwnersError } = accountOwnersResult;
    const { data: directAccounts, error: directError } = directAccountsResult;

    if (accountOwnersError) {
      logger.error("Error fetching account owners:", accountOwnersError);
    }
    if (directError) {
      logger.error("Error fetching direct accounts:", directError);
    }

    const ownedAccountIds = accountOwners?.map(ao => ao.accountId) || [];
    const accountIds = new Set<string>();
    
    // Add direct accounts
    directAccounts?.forEach(acc => accountIds.add(acc.id));

    // Get accounts owned via AccountOwner (only if we have account IDs to fetch)
    let ownedAccounts: { id: string }[] | null = null;
    if (ownedAccountIds.length > 0) {
      const { data: ownedAccountsData, error: ownedError } = await supabase
        .from("Account")
        .select("id")
        .in("id", ownedAccountIds);

      if (ownedError) {
        logger.error("Error fetching owned accounts:", ownedError);
      } else {
        ownedAccounts = ownedAccountsData;
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
      message: allowed ? undefined : `You've reached your account limit (${limits.maxAccounts}).`,
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

/**
 * Check if user can perform write operations
 * User can write if subscription is active or trialing
 * This is the central function to verify write access - use this everywhere
 */
export async function canUserWrite(userId: string): Promise<boolean> {
  try {
    const { subscription } = await getUserSubscriptionData(userId);
    
    if (!subscription) {
      return false;
    }
    
    // User can write if subscription is active
    if (subscription.status === "active") {
      return true;
    }
    
    // User can write if trial is active and valid
    if (subscription.status === "trialing") {
      // Validate trial end date
      if (subscription.trialEndDate) {
        const trialEnd = new Date(subscription.trialEndDate);
        const now = new Date();
        return trialEnd > now;
      }
      // If no trial end date, assume trial is valid
      return true;
    }
    
    // All other statuses (cancelled, past_due, etc.) block writes
    return false;
  } catch (error) {
    logger.error("Error in canUserWrite:", error);
    return false;
  }
}

