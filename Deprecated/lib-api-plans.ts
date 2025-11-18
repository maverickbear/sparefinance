"use server";

/**
 * @deprecated This file is deprecated. Use @/lib/api/subscription instead.
 * 
 * This file is kept for backward compatibility during migration.
 * All new code should use the unified subscription API in @/lib/api/subscription.
 * 
 * Functions in this file are still used internally by the unified API
 * but should not be imported directly by other modules.
 */

import { createServerClient } from "@/lib/supabase-server";
import { Plan, PlanFeatures, Subscription } from "@/lib/validations/plan";
import { getOwnerIdForMember, isHouseholdMember } from "@/lib/api/members";
import { logger } from "@/lib/utils/logger";
import { getDefaultFeatures } from "@/lib/utils/plan-features";

// Re-export types for convenience
export type { Subscription, Plan, PlanFeatures };

export interface PlanWithSubscription extends Plan {
  subscription?: Subscription;
}

// Simple in-memory cache for plans (they rarely change)
const plansCache = new Map<string, Plan>();
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache for subscriptions (shorter TTL since they can change)
// Stores both completed results and in-flight promises to prevent duplicate fetches
const subscriptionCache = new Map<string, 
  | { subscription: Subscription | null; timestamp: number; type: 'result' }
  | { promise: Promise<Subscription | null>; timestamp: number; type: 'promise' }
>();
const SUBSCRIPTION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Track invalidation timestamps to force cache bypass
const invalidationTimestamps = new Map<string, number>();

// Request-level memoization to prevent duplicate calls in the same request
const requestCache = new Map<string, Promise<Subscription | null>>();

/**
 * Invalidate subscription cache for a user
 * Call this when subscriptions are created, updated, or deleted
 */
export async function invalidateSubscriptionCache(userId: string): Promise<void> {
  subscriptionCache.delete(userId);
  // Also invalidate request cache
  requestCache.delete(`subscription:${userId}`);
  // Set invalidation timestamp to force cache bypass
  invalidationTimestamps.set(userId, Date.now());
  // Also invalidate for any members of this user's household
  // (since members inherit the owner's subscription)
  // Note: This is a simple implementation - in production you might want
  // to track household relationships in the cache
  const log = logger.withPrefix("PLANS");
  log.debug("Invalidated subscription cache for user:", userId);
}

/**
 * Invalidate plans cache
 * Call this when plans are updated in the database
 */
export async function invalidatePlansCache(): Promise<void> {
  plansCache.clear();
  cacheTimestamp = 0; // Force refresh on next access
  const log = logger.withPrefix("PLANS");
  log.debug("Invalidated plans cache");
}

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

    // Clear existing cache
    plansCache.clear();
    
    // Populate cache
    plans.forEach(plan => {
        const mappedPlan = mapPlan(plan);
        plansCache.set(mappedPlan.id, mappedPlan);
    });
    
    cacheTimestamp = Date.now();
  } catch (error) {
    logger.error("Error refreshing plans cache:", error);
  }
}

export async function getPlans(): Promise<Plan[]> {
  try {
    // Check if cache is valid
    const now = Date.now();
    if (plansCache.size === 0 || (now - cacheTimestamp) > CACHE_TTL) {
      await refreshPlansCache();
    }

    // Return cached plans
    return Array.from(plansCache.values()).sort((a, b) => a.priceMonthly - b.priceMonthly);
  } catch (error) {
    logger.error("Error in getPlans:", error);
    return [];
  }
}

export async function getPlanById(planId: string): Promise<Plan | null> {
  try {
    // Always fetch fresh from database to ensure we get the latest features
    // Cache is only used for performance, but we want to respect database changes
    const supabase = await createServerClient();
    
    const { data: plan, error } = await supabase
      .from("Plan")
      .select("*")
      .eq("id", planId)
      .single();

    if (error || !plan) {
      logger.error("Error fetching plan:", error);
      // Try cache as fallback if database fetch fails
      const cachedPlan = plansCache.get(planId);
      if (cachedPlan) {
        logger.warn("Using cached plan due to database error");
        return cachedPlan;
      }
      return null;
    }

    const mappedPlan = mapPlan(plan);
    // Update cache with fresh data
    plansCache.set(planId, mappedPlan);
    cacheTimestamp = Date.now();
    
    return mappedPlan;
  } catch (error) {
    logger.error("Error in getPlanById:", error);
    // Try cache as fallback
    const cachedPlan = plansCache.get(planId);
    if (cachedPlan) {
      logger.warn("Using cached plan due to error");
      return cachedPlan;
    }
    return null;
  }
}

export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  try {
    const log = logger.withPrefix("PLANS");
    
    // Check request-level cache first (prevents duplicate calls in same request)
    // Use get() instead of has() + get() to avoid race conditions
    const requestKey = `subscription:${userId}`;
    const cachedPromise = requestCache.get(requestKey);
    if (cachedPromise) {
      return await cachedPromise;
    }

    // Check persistent cache (both results and in-flight promises)
    const now = Date.now();
    const cached = subscriptionCache.get(userId);
    const invalidationTime = invalidationTimestamps.get(userId);
    
    if (cached) {
      // Check if cache entry is still valid
      const isExpired = (now - cached.timestamp) >= SUBSCRIPTION_CACHE_TTL;
      // Check if cache was invalidated after this entry was created
      const wasInvalidated = invalidationTime && invalidationTime > cached.timestamp;
      
      if (!isExpired && !wasInvalidated) {
        if (cached.type === 'result') {
          // We have a cached result
          const result = Promise.resolve(cached.subscription);
          requestCache.set(requestKey, result);
          setTimeout(() => requestCache.delete(requestKey), 100);
          return cached.subscription;
        } else if (cached.type === 'promise') {
          // There's an in-flight promise - reuse it
          requestCache.set(requestKey, cached.promise);
          setTimeout(() => requestCache.delete(requestKey), 1000);
          return await cached.promise;
        }
      } else {
        // Cache expired, remove it
        subscriptionCache.delete(userId);
      }
    }

    // No valid cache - create new fetch promise
    // Double-check cache after we decide to create a new promise (prevents race conditions)
    // This ensures that if another call set the cache between our check and now, we reuse it
    const doubleCheckCache = subscriptionCache.get(userId);
    if (doubleCheckCache && (now - doubleCheckCache.timestamp) < SUBSCRIPTION_CACHE_TTL) {
      if (doubleCheckCache.type === 'result') {
        const result = Promise.resolve(doubleCheckCache.subscription);
        requestCache.set(requestKey, result);
        setTimeout(() => requestCache.delete(requestKey), 100);
        return doubleCheckCache.subscription;
      } else if (doubleCheckCache.type === 'promise') {
        requestCache.set(requestKey, doubleCheckCache.promise);
        setTimeout(() => requestCache.delete(requestKey), 1000);
        return await doubleCheckCache.promise;
      }
    }
    
    // Create promise and cache it IMMEDIATELY (before awaiting) to prevent concurrent calls
    // This ensures all concurrent calls get the same promise
    const subscriptionPromise = fetchUserSubscription(userId)
      .then((subscription) => {
        // Update persistent cache with result after fetch completes
        subscriptionCache.set(userId, {
          subscription,
          timestamp: Date.now(),
          type: 'result',
        });
        return subscription;
      })
      .catch((error) => {
        // Remove from caches on error so it can be retried
        subscriptionCache.delete(userId);
        requestCache.delete(requestKey);
        throw error;
      });

    // Store the in-flight promise in persistent cache IMMEDIATELY
    // This allows other concurrent calls to reuse the same promise
    subscriptionCache.set(userId, {
      promise: subscriptionPromise,
      timestamp: now,
      type: 'promise',
    });

    // Set in request cache BEFORE awaiting - this is critical for preventing race conditions
    requestCache.set(requestKey, subscriptionPromise);

    // Clean up request cache after a short delay (request should complete quickly)
    setTimeout(() => {
      requestCache.delete(requestKey);
    }, 1000);

    return await subscriptionPromise;
    } catch (error) {
      logger.error("Error in getUserSubscription:", error);
    // On error, return null to allow user to select a plan
    // This prevents assuming user has a plan when there's a database error
    // Note: This is different from when user has no subscription (also returns null)
    return null;
  }
}

/**
 * Check if a trial subscription is still valid (not expired)
 */
function isTrialValid(subscription: any): boolean {
  if (subscription.status !== "trialing") {
    return true; // Not a trial, so it's valid
  }
  
  if (!subscription.trialEndDate) {
    return false; // Trial without end date is invalid
  }
  
  const trialEndDate = new Date(subscription.trialEndDate);
  const now = new Date();
  
  return trialEndDate > now; // Trial is valid if end date is in the future
}

async function fetchUserSubscription(userId: string): Promise<Subscription | null> {
    const supabase = await createServerClient();
    const log = logger.withPrefix("PLANS");
    
    // Optimize: Check household membership and get ownerId in a single query
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
    
    if (isMember && ownerId) {
      // User is a household member, inherit plan from owner
      // Get owner's subscription (active or trialing)
      const { data: ownerSubscription, error: ownerError } = await supabase
        .from("Subscription")
        .select("*")
        .eq("userId", ownerId)
        .in("status", ["active", "trialing"])
        .order("createdAt", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ownerError && ownerError.code !== "PGRST116") {
        log.error("Error fetching owner subscription:", ownerError);
      }

      if (ownerSubscription) {
        // Owner has a subscription, return it as shadow subscription for the member
        // Allow even if trial expired - user can still view the system
        // Only inherit if owner has Essential or Pro plan
        const ownerPlanId = ownerSubscription.planId;
        
        if (ownerPlanId === "essential" || ownerPlanId === "pro") {
          const mapped = mapSubscription(ownerSubscription);
          return {
            ...mapped,
            userId, // Use member's userId, but owner's subscription data
          };
        }
        // If owner has no valid plan, fall through to return null
      }
      // If owner has no subscription, return null for member
    }
    
    // User is not a member, or owner has no subscription - check user's own subscription
    // Prioritize active or trialing subscriptions, but also check for any subscription
    // to handle edge cases where status might be different
    // First try to get active or trialing subscription
    let { data: subscription, error } = await supabase
      .from("Subscription")
      .select("*")
      .eq("userId", userId)
      .in("status", ["active", "trialing"])
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    // If no active/trialing subscription found, check for any subscription (including cancelled)
    // This handles edge cases but we'll still check status in the layout
    if (!subscription && !error) {
      const { data: anySubscription, error: anyError } = await supabase
        .from("Subscription")
        .select("*")
        .eq("userId", userId)
        .order("createdAt", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (anySubscription) {
        subscription = anySubscription;
      }
      if (anyError && anyError.code !== "PGRST116") {
        error = anyError;
      }
    }

    // If error is PGRST116 (no rows returned), it's expected when no subscription exists
    // Other errors should be logged
    if (error && error.code !== "PGRST116") {
      log.error("Error fetching subscription:", error);
    }

    if (!subscription) {
      // Return null if no subscription exists
      // User must select a plan on /select-plan page
      // This allows users to choose their plan before being redirected to dashboard
      log.debug(`No subscription found for user ${userId}`);
      return null;
    }

    // Log subscription details for debugging
    log.debug(`Found subscription for user ${userId}:`, {
      id: subscription.id,
      planId: subscription.planId,
      status: subscription.status,
      trialStartDate: subscription.trialStartDate,
      trialEndDate: subscription.trialEndDate,
    });

    // Map and return subscription
    const mappedSubscription = mapSubscription(subscription);
    
    // Additional validation: ensure trialing subscriptions are recognized
    if (subscription.status === "trialing") {
      log.debug(`Trialing subscription found for user ${userId}, allowing access`);
    }
    
    return mappedSubscription;
}

export async function getCurrentUserSubscription(): Promise<Subscription | null> {
  try {
    const supabase = await createServerClient();
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return null;
    }

    // getUserSubscription returns null if user has no subscription
    // User must select a plan on /select-plan page
    const subscription = await getUserSubscription(authUser.id);
    return subscription;
  } catch (error) {
    logger.error("Error in getCurrentUserSubscription:", error);
    // Even on error, if we have a user, we should return a free subscription
    // But we can't access the user here, so return null
    return null;
  }
}

/**
 * Get plan name by plan ID (server-side)
 * Returns the dynamic name from the database
 */
export async function getPlanNameById(planId: string): Promise<string | null> {
  try {
    const plan = await getPlanById(planId);
    return plan?.name || null;
  } catch (error) {
    logger.error("Error in getPlanNameById:", error);
    return null;
  }
}

export async function checkPlanLimits(
  userId: string,
  subscription?: Subscription | null
): Promise<{
  plan: Plan | null;
  subscription: Subscription | null;
  limits: PlanFeatures;
}> {
  try {
    // Use provided subscription or fetch it
    const userSubscription = subscription ?? await getUserSubscription(userId);
    
    if (!userSubscription) {
      // No subscription - user needs to select a plan
      // Return null plan with default (restrictive) limits
      return {
        plan: null,
        subscription: null,
        limits: getDefaultFeatures(),
      };
    }

    const plan = await getPlanById(userSubscription.planId);
    if (!plan) {
      return {
        plan: null,
        subscription: userSubscription,
        limits: getDefaultFeatures(),
      };
    }

    // Use features directly from the database plan
    // The database is the source of truth - if features are disabled in Supabase, they should be disabled here
    // mapPlan already merges with defaults, so all features are guaranteed to be defined
    // This ensures that new features (like hasCsvImport) are automatically added with default values
    // if they don't exist in the database yet
    let limits = plan.features;

    return {
      plan,
      subscription: userSubscription,
      limits,
    };
  } catch (error) {
    logger.error("Error in checkPlanLimits:", error);
    return {
      plan: null,
      subscription: null,
      limits: getDefaultFeatures(),
    };
  }
}

function mapPlan(data: any): Plan {
  let features: PlanFeatures;
  try {
    const parsedFeatures = typeof data.features === "string" 
      ? JSON.parse(data.features) 
      : data.features;
    
    // Merge with defaults to ensure all fields are defined (handles new features added later)
    // This ensures that if a plan in the database doesn't have hasCsvImport (or any new feature),
    // it will be added with the default value
    const mergedFeatures = { ...getDefaultFeatures(), ...parsedFeatures };
    
    // CRITICAL FIX: Convert string booleans to actual booleans
    // This handles cases where JSONB stores booleans as strings "true"/"false"
    // or when values come from SQL queries that may return strings
    features = {
      maxTransactions: typeof mergedFeatures.maxTransactions === "string" 
        ? parseInt(mergedFeatures.maxTransactions, 10) 
        : mergedFeatures.maxTransactions,
      maxAccounts: typeof mergedFeatures.maxAccounts === "string" 
        ? parseInt(mergedFeatures.maxAccounts, 10) 
        : mergedFeatures.maxAccounts,
      hasInvestments: mergedFeatures.hasInvestments === true || mergedFeatures.hasInvestments === "true",
      hasAdvancedReports: mergedFeatures.hasAdvancedReports === true || mergedFeatures.hasAdvancedReports === "true",
      hasCsvExport: mergedFeatures.hasCsvExport === true || mergedFeatures.hasCsvExport === "true",
      hasCsvImport: mergedFeatures.hasCsvImport === true || mergedFeatures.hasCsvImport === "true",
      hasDebts: mergedFeatures.hasDebts === true || mergedFeatures.hasDebts === "true",
      hasGoals: mergedFeatures.hasGoals === true || mergedFeatures.hasGoals === "true",
      hasBankIntegration: mergedFeatures.hasBankIntegration === true || mergedFeatures.hasBankIntegration === "true",
      hasHousehold: mergedFeatures.hasHousehold === true || mergedFeatures.hasHousehold === "true",
      hasBudgets: mergedFeatures.hasBudgets === true || mergedFeatures.hasBudgets === "true",
    };
  } catch {
    features = getDefaultFeatures();
  }

  return {
    id: data.id,
    name: data.name,
    priceMonthly: parseFloat(data.priceMonthly) || 0,
    priceYearly: parseFloat(data.priceYearly) || 0,
    features,
    stripePriceIdMonthly: data.stripePriceIdMonthly,
    stripePriceIdYearly: data.stripePriceIdYearly,
    stripeProductId: data.stripeProductId,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };
}

function mapSubscription(data: any): Subscription {
  return {
    id: data.id,
    userId: data.userId,
    planId: data.planId,
    status: data.status,
    stripeSubscriptionId: data.stripeSubscriptionId,
    stripeCustomerId: data.stripeCustomerId,
    currentPeriodStart: data.currentPeriodStart ? new Date(data.currentPeriodStart) : null,
    currentPeriodEnd: data.currentPeriodEnd ? new Date(data.currentPeriodEnd) : null,
    trialStartDate: data.trialStartDate ? new Date(data.trialStartDate) : null,
    trialEndDate: data.trialEndDate ? new Date(data.trialEndDate) : null,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };
}

// Note: getDefaultFeatures and resolvePlanFeatures are in @/lib/utils/plan-features
// They are not re-exported here because "use server" files can only export async functions

export interface UserPlanInfo {
  name: "essential" | "pro";
  isShadow: boolean; // true se herdado do owner
  ownerId?: string; // se for shadow subscription
  ownerName?: string; // nome do owner (se for shadow)
}

export async function getUserPlanInfo(userId: string): Promise<UserPlanInfo | null> {
  try {
    const supabase = await createServerClient();
    
    // Optimize: Check household membership and get ownerId in a single query
    const { data: member, error: memberError } = await supabase
      .from("HouseholdMember")
      .select("ownerId, status")
      .eq("memberId", userId)
      .eq("status", "active")
      .maybeSingle();

    const log = logger.withPrefix("PLANS");
    
    if (memberError && memberError.code !== "PGRST116") {
      log.error("Error checking household membership:", memberError);
    }

    const isMember = member !== null;
    const ownerId = member?.ownerId || null;
    
    if (isMember && ownerId) {
      // User is a household member, inherit plan from owner
      // Fetch owner's subscription and name in parallel
      const [ownerSubscriptionResult, ownerResult] = await Promise.all([
        supabase
          .from("Subscription")
          .select("*")
          .eq("userId", ownerId)
          .eq("status", "active")
          .order("createdAt", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("User")
          .select("name, email")
          .eq("id", ownerId)
          .maybeSingle(),
      ]);

      const { data: ownerSubscription, error: ownerError } = ownerSubscriptionResult;
      const { data: owner } = ownerResult;

      if (ownerError && ownerError.code !== "PGRST116") {
        log.error("Error fetching owner subscription:", ownerError);
      }

      if (ownerSubscription) {
        // Owner has a subscription, check if it's Essential or Pro
        const ownerPlanId = ownerSubscription.planId;
        
        if (ownerPlanId === "essential" || ownerPlanId === "pro") {
          return {
            name: ownerPlanId as "essential" | "pro",
            isShadow: true,
            ownerId,
            ownerName: owner?.name || owner?.email || undefined,
          };
        }
        // If owner has no valid plan, fall through to return null
      }
      // If owner has no subscription or invalid plan, return null for member
    }
    
    // User is not a member, or owner has no valid subscription - check user's own subscription
    const subscription = await getUserSubscription(userId);
    
    if (subscription) {
      const planId = subscription.planId;
      if (planId === "essential" || planId === "pro") {
        return {
          name: planId as "essential" | "pro",
          isShadow: false,
        };
      }
    }

    // No valid subscription - return null (user needs to select a plan)
    return null;
  } catch (error) {
    logger.error("Error in getUserPlanInfo:", error);
    return null;
  }
}

