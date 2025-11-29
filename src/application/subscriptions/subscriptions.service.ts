/**
 * Subscriptions Service
 * Business logic for subscriptions and plans
 * This is the SINGLE SOURCE OF TRUTH for subscription, plans, and limits
 */

import { SubscriptionsRepository } from "../../infrastructure/database/repositories/subscriptions.repository";
import { SubscriptionsMapper } from "./subscriptions.mapper";
import { BaseSubscription, BasePlan, BaseSubscriptionData, BaseLimitCheckResult, BasePlanFeatures } from "../../domain/subscriptions/subscriptions.types";
import { SUBSCRIPTION_CACHE_TTL, PLANS_CACHE_TTL } from "../../domain/subscriptions/subscriptions.constants";
import { getDefaultFeatures } from "@/lib/utils/plan-features";
import { logger } from "@/src/infrastructure/utils/logger";

// In-memory caches
const plansCache = new Map<string, BasePlan>();
let plansCacheTimestamp = 0;

const subscriptionCache = new Map<string, 
  | { data: BaseSubscriptionData; timestamp: number; type: 'result' }
  | { promise: Promise<BaseSubscriptionData>; timestamp: number; type: 'promise' }
>();

const invalidationTimestamps = new Map<string, number>();
const requestCache = new Map<string, Promise<BaseSubscriptionData>>();

export class SubscriptionsService {
  constructor(private repository: SubscriptionsRepository) {}

  /**
   * Invalidate subscription cache for a user
   */
  invalidateSubscriptionCache(userId: string): void {
    subscriptionCache.delete(userId);
    requestCache.delete(`subscription:${userId}`);
    invalidationTimestamps.set(userId, Date.now());
    logger.debug("[SubscriptionsService] Invalidated subscription cache for user:", userId);
  }

  /**
   * Invalidate plans cache
   */
  invalidatePlansCache(): void {
    plansCache.clear();
    plansCacheTimestamp = 0;
    logger.debug("[SubscriptionsService] Invalidated plans cache");
  }

  /**
   * Get all available plans
   */
  async getPlans(): Promise<BasePlan[]> {
    try {
      const now = Date.now();
      if (plansCache.size === 0 || (now - plansCacheTimestamp) > PLANS_CACHE_TTL) {
        await this.refreshPlansCache();
      }
      
      return Array.from(plansCache.values());
    } catch (error) {
      logger.error("[SubscriptionsService] Error fetching plans:", error);
      return [];
    }
  }

  /**
   * Get plan by ID
   */
  async getPlanById(planId: string): Promise<BasePlan | null> {
    try {
      const cached = plansCache.get(planId);
      if (cached) {
        return cached;
      }

      const now = Date.now();
      if (plansCache.size === 0 || (now - plansCacheTimestamp) > PLANS_CACHE_TTL) {
        await this.refreshPlansCache();
      }

      return plansCache.get(planId) || null;
    } catch (error) {
      logger.error("[SubscriptionsService] Error fetching plan by ID:", error);
      return null;
    }
  }

  /**
   * Get user subscription data (with caching)
   */
  async getUserSubscriptionData(userId: string): Promise<BaseSubscriptionData> {
    try {
      const now = Date.now();
      const invalidationTime = invalidationTimestamps.get(userId) || 0;
      
      // Check request-level cache first
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
        
        if (!isInvalidated && age < SUBSCRIPTION_CACHE_TTL) {
          const resultPromise = Promise.resolve(cached.data);
          requestCache.set(requestKey, resultPromise);
          setTimeout(() => requestCache.delete(requestKey), 1000);
          return cached.data;
        }
      }

      // Check for in-flight promise
      if (cached && cached.type === 'promise') {
        const age = now - cached.timestamp;
        if (age < 10000) {
          requestCache.set(requestKey, cached.promise);
          setTimeout(() => requestCache.delete(requestKey), 1000);
          return await cached.promise;
        }
      }

      // Fetch data
      const fetchPromise = this.fetchUserSubscriptionData(userId)
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

      subscriptionCache.set(userId, {
        promise: fetchPromise,
        timestamp: now,
        type: 'promise',
      });
      
      requestCache.set(requestKey, fetchPromise);
      setTimeout(() => requestCache.delete(requestKey), 1000);

      return await fetchPromise;
    } catch (error) {
      logger.error("[SubscriptionsService] Error getting user subscription data:", error);
      return {
        subscription: null,
        plan: null,
        limits: getDefaultFeatures(),
      };
    }
  }

  /**
   * Get current user subscription data
   */
  async getCurrentUserSubscriptionData(): Promise<BaseSubscriptionData> {
    try {
      const { createServerClient } = await import("../../infrastructure/database/supabase-server");
      const supabase = await createServerClient();
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

      if (authError || !authUser) {
        return {
          subscription: null,
        plan: null,
        limits: getDefaultFeatures(),
        };
      }

      return await this.getUserSubscriptionData(authUser.id);
    } catch (error) {
      logger.error("[SubscriptionsService] Error getting current user subscription data:", error);
      return {
        subscription: null,
        plan: null,
        limits: getDefaultFeatures(),
      };
    }
  }

  /**
   * Check transaction limit
   */
  async checkTransactionLimit(userId: string, month: Date = new Date()): Promise<BaseLimitCheckResult> {
    try {
      const { limits } = await this.getUserSubscriptionData(userId);
      const { createServerClient } = await import("../../infrastructure/database/supabase-server");
      const supabase = await createServerClient();
      
      const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
      const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);

      const monthDateStr = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}-${String(startOfMonth.getDate()).padStart(2, '0')}`;
      
      const { data: usage, error: usageError } = await supabase
        .from("user_monthly_usage")
        .select("transactions_count")
        .eq("user_id", userId)
        .eq("month_date", monthDateStr)
        .maybeSingle();

      let current = 0;
      
      const hasError = usageError && (usageError as { code?: string }).code !== 'PGRST116';
      if (!usage || hasError) {
        const { count } = await supabase
          .from("Transaction")
          .select("*", { count: "exact", head: true })
          .eq("userId", userId)
          .gte("date", startOfMonth.toISOString())
          .lte("date", endOfMonth.toISOString());

        current = count || 0;
      } else {
        current = usage.transactions_count || 0;
      }

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
      logger.error("[SubscriptionsService] Error in checkTransactionLimit:", error);
      return {
        allowed: false,
        limit: 50,
        current: 0,
        message: "Error checking limit",
      };
    }
  }

  /**
   * Check account limit
   */
  async checkAccountLimit(userId: string): Promise<BaseLimitCheckResult> {
    try {
      const { limits } = await this.getUserSubscriptionData(userId);
      const { createServerClient } = await import("../../infrastructure/database/supabase-server");
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

      const count = accountIds.size;

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
      logger.error("[SubscriptionsService] Error in checkAccountLimit:", error);
      return {
        allowed: false,
        limit: 2,
        current: 0,
        message: "Error checking limit",
      };
    }
  }

  /**
   * Check feature access
   */
  async checkFeatureAccess(userId: string, feature: keyof BasePlanFeatures): Promise<boolean> {
    try {
      const { limits } = await this.getUserSubscriptionData(userId);
      const featureValue = limits[feature];
      return featureValue === true;
    } catch (error) {
      logger.error("[SubscriptionsService] Error in checkFeatureAccess:", error);
      return false;
    }
  }

  /**
   * Check if user can write
   */
  async canUserWrite(userId: string): Promise<boolean> {
    try {
      const { subscription } = await this.getUserSubscriptionData(userId);
      
      if (!subscription) {
        return false;
      }
      
      if (subscription.status === "active") {
        return true;
      }
      
      if (subscription.status === "trialing") {
        if (subscription.trialEndDate) {
          const trialEnd = new Date(subscription.trialEndDate);
          const now = new Date();
          return trialEnd > now;
        }
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error("[SubscriptionsService] Error in canUserWrite:", error);
      return false;
    }
  }

  /**
   * Internal: Fetch user subscription data from database
   */
  private async fetchUserSubscriptionData(userId: string): Promise<BaseSubscriptionData> {
    // Try cached subscription data from User table first
    const userCache = await this.repository.getUserSubscriptionCache(userId);
    
    if (userCache?.effectivePlanId && userCache?.effectiveSubscriptionStatus && userCache?.subscriptionUpdatedAt) {
      const subscriptionUpdatedAtTime = new Date(userCache.subscriptionUpdatedAt).getTime();
      const now = Date.now();
      const cacheAge = now - subscriptionUpdatedAtTime;
      const CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes
      
      const isValidTimestamp = !isNaN(subscriptionUpdatedAtTime) && subscriptionUpdatedAtTime > 0;
      const isFutureTimestamp = cacheAge < 0;
      const isRecentCache = cacheAge >= 0 && cacheAge < CACHE_MAX_AGE;
      const isVeryOldCache = cacheAge > 60 * 60 * 1000;
      
      if (isValidTimestamp && (isRecentCache || isFutureTimestamp || !isVeryOldCache)) {
        const plan = await this.getPlanById(userCache.effectivePlanId);
        if (plan) {
          let fullSubscription: BaseSubscription | null = null;
          if (userCache.effectiveSubscriptionId) {
            // Fetch full subscription if needed
            const { createServerClient } = await import("../../infrastructure/database/supabase-server");
            const supabase = await createServerClient();
            const { data: subscriptionData } = await supabase
              .from("Subscription")
              .select("*")
              .eq("id", userCache.effectiveSubscriptionId)
              .maybeSingle();
            
            if (subscriptionData) {
              fullSubscription = SubscriptionsMapper.subscriptionToDomain(subscriptionData as any);
            }
          }

          return {
            subscription: fullSubscription || (userCache.effectiveSubscriptionId ? {
              id: userCache.effectiveSubscriptionId,
              userId: userId,
              planId: userCache.effectivePlanId,
              status: userCache.effectiveSubscriptionStatus as any,
              householdId: null,
              stripeSubscriptionId: null,
              stripeCustomerId: null,
              currentPeriodStart: null,
              currentPeriodEnd: null,
              trialEndDate: null,
              cancelAtPeriodEnd: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            } : null),
            plan,
            limits: plan.features,
          };
        }
      }
    }

    // Fallback: Full query
    const householdId = await this.repository.getActiveHouseholdId(userId);
    let subscription: BaseSubscription | null = null;

    if (householdId) {
      const subscriptionRow = await this.repository.findByHouseholdId(householdId);
      if (subscriptionRow) {
        subscription = SubscriptionsMapper.subscriptionToDomain(subscriptionRow);
      } else {
        // Try owner's subscription for inheritance
        const ownerId = await this.repository.getHouseholdOwnerId(householdId);
        if (ownerId && ownerId !== userId) {
          const ownerSubscriptionRow = await this.repository.findByUserId(ownerId);
          if (ownerSubscriptionRow) {
            subscription = SubscriptionsMapper.subscriptionToDomain(ownerSubscriptionRow);
          }
        }
      }
    }

    // Fallback to user's own subscription
    if (!subscription) {
      const subscriptionRow = await this.repository.findByUserId(userId);
      if (subscriptionRow) {
        subscription = SubscriptionsMapper.subscriptionToDomain(subscriptionRow);
      }
    }

    if (!subscription) {
      return {
        subscription: null,
        plan: null,
        limits: getDefaultFeatures(),
      };
    }

    // Validate trial
    if (subscription.status === "trialing" && subscription.trialEndDate) {
      const trialEnd = new Date(subscription.trialEndDate);
      const now = new Date();
      if (trialEnd <= now) {
        return {
          subscription: null,
          plan: null,
          limits: getDefaultFeatures(),
        };
      }
    }

    const plan = await this.getPlanById(subscription.planId);
    if (!plan) {
      return {
        subscription,
        plan: null,
        limits: getDefaultFeatures(),
      };
    }

    return {
      subscription,
      plan,
      limits: plan.features,
    };
  }

  /**
   * Refresh plans cache
   */
  private async refreshPlansCache(): Promise<void> {
    try {
      const plans = await this.repository.findAllPlans();
      plansCache.clear();
      
      plans.forEach(plan => {
        const mappedPlan = SubscriptionsMapper.planToDomain(plan);
        plansCache.set(mappedPlan.id, mappedPlan);
      });
      
      plansCacheTimestamp = Date.now();
    } catch (error) {
      logger.error("[SubscriptionsService] Error refreshing plans cache:", error);
    }
  }
}

