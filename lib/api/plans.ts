"use server";

import { createServerClient } from "@/lib/supabase-server";
import { Plan, PlanFeatures, Subscription } from "@/lib/validations/plan";
import { getOwnerIdForMember, isHouseholdMember } from "./members";

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
const SUBSCRIPTION_CACHE_TTL = 30 * 1000; // 30 seconds

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
  // Also invalidate for any members of this user's household
  // (since members inherit the owner's subscription)
  // Note: This is a simple implementation - in production you might want
  // to track household relationships in the cache
  console.log("[PLANS] Invalidated subscription cache for user:", userId);
}

async function refreshPlansCache(): Promise<void> {
  try {
    const supabase = await createServerClient();
    
    const { data: plans, error } = await supabase
      .from("Plan")
      .select("*")
      .order("priceMonthly", { ascending: true });

    if (error || !plans) {
      console.error("Error fetching plans for cache:", error);
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
    console.error("Error refreshing plans cache:", error);
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
    console.error("Error in getPlans:", error);
    return [];
  }
}

export async function getPlanById(planId: string): Promise<Plan | null> {
  try {
    // Check if cache is valid
    const now = Date.now();
    if (!plansCache.has(planId) || (now - cacheTimestamp) > CACHE_TTL) {
      await refreshPlansCache();
    }

    // Return from cache
    const cachedPlan = plansCache.get(planId);
    if (cachedPlan) {
      return cachedPlan;
    }

    // If not in cache, fetch directly (fallback)
    const supabase = await createServerClient();
    
    const { data: plan, error } = await supabase
      .from("Plan")
      .select("*")
      .eq("id", planId)
      .single();

    if (error || !plan) {
      console.error("Error fetching plan:", error);
      return null;
    }

    const mappedPlan = mapPlan(plan);
    // Update cache
    plansCache.set(planId, mappedPlan);
    
    return mappedPlan;
  } catch (error) {
    console.error("Error in getPlanById:", error);
    return null;
  }
}

export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  try {
    // Check request-level cache first (prevents duplicate calls in same request)
    // Use get() instead of has() + get() to avoid race conditions
    const requestKey = `subscription:${userId}`;
    const cachedPromise = requestCache.get(requestKey);
    if (cachedPromise) {
      console.log("[PLANS] getUserSubscription - Using request-level cache for:", userId);
      return await cachedPromise;
    }

    // Check persistent cache (both results and in-flight promises)
    const now = Date.now();
    const cached = subscriptionCache.get(userId);
    
    if (cached) {
      // Check if cache entry is still valid
      const isExpired = (now - cached.timestamp) >= SUBSCRIPTION_CACHE_TTL;
      
      if (!isExpired) {
        if (cached.type === 'result') {
          // We have a cached result
          console.log("[PLANS] getUserSubscription - Using persistent cache result for:", userId);
          const result = Promise.resolve(cached.subscription);
          requestCache.set(requestKey, result);
          setTimeout(() => requestCache.delete(requestKey), 100);
          return cached.subscription;
        } else if (cached.type === 'promise') {
          // There's an in-flight promise - reuse it
          console.log("[PLANS] getUserSubscription - Reusing in-flight promise for:", userId);
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
        console.log("[PLANS] getUserSubscription - Using persistent cache result (double-check) for:", userId);
        const result = Promise.resolve(doubleCheckCache.subscription);
        requestCache.set(requestKey, result);
        setTimeout(() => requestCache.delete(requestKey), 100);
        return doubleCheckCache.subscription;
      } else if (doubleCheckCache.type === 'promise') {
        console.log("[PLANS] getUserSubscription - Reusing in-flight promise (double-check) for:", userId);
        requestCache.set(requestKey, doubleCheckCache.promise);
        setTimeout(() => requestCache.delete(requestKey), 1000);
        return await doubleCheckCache.promise;
      }
    }
    
    console.log("[PLANS] getUserSubscription - Fetching new subscription for:", userId);
    
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
    console.error("[PLANS] Error in getUserSubscription:", error);
    // On error, return null to allow user to select a plan
    // This prevents assuming user has a plan when there's a database error
    // Note: This is different from when user has no subscription (also returns null)
    return null;
  }
}

async function fetchUserSubscription(userId: string): Promise<Subscription | null> {
    const supabase = await createServerClient();
    
    // Optimize: Check household membership and get ownerId in a single query
    const { data: member, error: memberError } = await supabase
      .from("HouseholdMember")
      .select("ownerId, status")
      .eq("memberId", userId)
      .eq("status", "active")
      .maybeSingle();

    if (memberError && memberError.code !== "PGRST116") {
      console.error("[PLANS] Error checking household membership:", memberError);
    }

    const isMember = member !== null;
    const ownerId = member?.ownerId || null;
    console.log("[PLANS] getUserSubscription - userId:", userId, "isMember:", isMember, "ownerId:", ownerId);
    
    if (isMember && ownerId) {
      // User is a household member, inherit plan from owner
      // Get owner's subscription
      const { data: ownerSubscription, error: ownerError } = await supabase
        .from("Subscription")
        .select("*")
        .eq("userId", ownerId)
        .eq("status", "active")
        .order("createdAt", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ownerError && ownerError.code !== "PGRST116") {
        console.error("[PLANS] Error fetching owner subscription:", ownerError);
      }

      console.log("[PLANS] getUserSubscription - ownerSubscription:", ownerSubscription ? { planId: ownerSubscription.planId, status: ownerSubscription.status } : null);

      if (ownerSubscription) {
        // Owner has a subscription, return it as shadow subscription for the member
        // Only inherit if owner has Basic or Premium plan
        const ownerPlanId = ownerSubscription.planId;
        console.log("[PLANS] getUserSubscription - ownerPlanId:", ownerPlanId);
        
        if (ownerPlanId === "basic" || ownerPlanId === "premium") {
          console.log("[PLANS] getUserSubscription - Returning shadow subscription for member:", userId, "with plan:", ownerPlanId);
          return {
            id: ownerSubscription.id,
            userId, // Use member's userId, but owner's subscription data
            planId: ownerPlanId,
            status: ownerSubscription.status,
            stripeSubscriptionId: ownerSubscription.stripeSubscriptionId,
            stripeCustomerId: ownerSubscription.stripeCustomerId,
            currentPeriodStart: ownerSubscription.currentPeriodStart ? new Date(ownerSubscription.currentPeriodStart) : null,
            currentPeriodEnd: ownerSubscription.currentPeriodEnd ? new Date(ownerSubscription.currentPeriodEnd) : null,
            cancelAtPeriodEnd: ownerSubscription.cancelAtPeriodEnd || false,
            createdAt: ownerSubscription.createdAt ? new Date(ownerSubscription.createdAt) : new Date(),
            updatedAt: ownerSubscription.updatedAt ? new Date(ownerSubscription.updatedAt) : new Date(),
          };
        } else {
          console.log("[PLANS] getUserSubscription - Owner has Free plan, member will get Free");
        }
        // If owner has Free plan, fall through to return Free for member
      } else {
        console.log("[PLANS] getUserSubscription - Owner has no active subscription");
      }
      // If owner has no subscription or has Free, return Free for member
    } else {
      console.log("[PLANS] getUserSubscription - User is not a household member");
    }
    
    // User is not a member, or owner has Free/no subscription - check user's own subscription
    const { data: subscription, error } = await supabase
      .from("Subscription")
      .select("*")
      .eq("userId", userId)
      .eq("status", "active")
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    // If error is PGRST116 (no rows returned), it's expected when no subscription exists
    // Other errors should be logged
    if (error && error.code !== "PGRST116") {
      console.error("[PLANS] Error fetching subscription:", error);
    }

    if (!subscription) {
      // Return null if no subscription exists
      // User must select a plan on /select-plan page
      // This allows users to choose their plan before being redirected to dashboard
      return null;
    }

    return mapSubscription(subscription);
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
    console.error("Error in getCurrentUserSubscription:", error);
    // Even on error, if we have a user, we should return a free subscription
    // But we can't access the user here, so return null
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
      // Default to free plan
      const freePlan = await getPlanById("free");
      return {
        plan: freePlan,
        subscription: null,
        limits: freePlan?.features || getDefaultFeatures(),
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

    return {
      plan,
      subscription: userSubscription,
      limits: plan.features,
    };
  } catch (error) {
    console.error("Error in checkPlanLimits:", error);
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
    features = typeof data.features === "string" 
      ? JSON.parse(data.features) 
      : data.features;
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
    cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };
}

function getDefaultFeatures(): PlanFeatures {
  return {
    maxTransactions: 50,
    maxAccounts: 2,
    hasInvestments: false,
    hasAdvancedReports: false,
    hasCsvExport: false,
    hasDebts: true,
    hasGoals: true,
    hasBankIntegration: false,
  };
}

export interface UserPlanInfo {
  name: "free" | "basic" | "premium";
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

    if (memberError && memberError.code !== "PGRST116") {
      console.error("[PLANS] Error checking household membership:", memberError);
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
        console.error("[PLANS] Error fetching owner subscription:", ownerError);
      }

      if (ownerSubscription) {
        // Owner has a subscription, check if it's Basic or Premium
        const ownerPlanId = ownerSubscription.planId;
        
        if (ownerPlanId === "basic" || ownerPlanId === "premium") {
          return {
            name: ownerPlanId as "basic" | "premium",
            isShadow: true,
            ownerId,
            ownerName: owner?.name || owner?.email || undefined,
          };
        }
        // If owner has Free plan, fall through to return Free
      }
      // If owner has no subscription or has Free, return Free for member
    }
    
    // User is not a member, or owner has Free/no subscription - check user's own subscription
    const subscription = await getUserSubscription(userId);
    
    if (subscription) {
      return {
        name: subscription.planId as "free" | "basic" | "premium",
        isShadow: false,
      };
    }

    // Default to free
    return {
      name: "free",
      isShadow: false,
    };
  } catch (error) {
    console.error("[PLANS] Error in getUserPlanInfo:", error);
    return {
      name: "free",
      isShadow: false,
    };
  }
}

