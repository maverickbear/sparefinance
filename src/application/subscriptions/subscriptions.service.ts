/**
 * Subscriptions Service
 * Business logic for subscriptions and plans
 * This is the SINGLE SOURCE OF TRUTH for subscription, plans, and limits
 */

import { SubscriptionsRepository } from "@/src/infrastructure/database/repositories/subscriptions.repository";
import { SubscriptionsMapper } from "./subscriptions.mapper";
import { BaseSubscription, BasePlan, BaseSubscriptionData, BaseLimitCheckResult, BasePlanFeatures, PublicPlan } from "../../domain/subscriptions/subscriptions.types";
import { getDefaultFeatures } from "@/lib/utils/plan-features";
import { logger } from "@/src/infrastructure/utils/logger";
import { createServerClient } from "@/src/infrastructure/database/supabase-server";
import { getCurrentUserId } from "../shared/feature-guard";

// In-memory cache for deduplicating concurrent requests
// Maps userId -> Promise<BaseSubscriptionData>
const pendingRequests = new Map<string, Promise<BaseSubscriptionData>>();

export class SubscriptionsService {
  constructor(private repository: SubscriptionsRepository) {}

  /**
   * Get all available plans
   */
  async getPlans(): Promise<BasePlan[]> {
    try {
      const plans = await this.repository.findAllPlans();
      return plans.map(plan => SubscriptionsMapper.planToDomain(plan));
    } catch (error) {
      logger.error("[SubscriptionsService] Error fetching plans:", error);
      return [];
    }
  }

  /**
   * Get public plans (without sensitive Stripe IDs)
   * Used for public endpoints like landing page pricing section
   */
  async getPublicPlans(): Promise<PublicPlan[]> {
    try {
      const plans = await this.getPlans();
      return plans.map(plan => ({
        id: plan.id,
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        features: plan.features,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
      }));
    } catch (error) {
      logger.error("[SubscriptionsService] Error fetching public plans:", error);
      return [];
    }
  }

  /**
   * Get plan by ID
   */
  async getPlanById(planId: string, useServiceRole: boolean = false): Promise<BasePlan | null> {
    try {
      // CRITICAL: Pass useServiceRole flag to repository when called from cache context
      const plan = await this.repository.findPlanById(planId, useServiceRole);
      if (!plan) {
        return null;
      }
      return SubscriptionsMapper.planToDomain(plan);
    } catch (error) {
      logger.error("[SubscriptionsService] Error fetching plan by ID:", error);
      return null;
    }
  }

  /**
   * Get user subscription data
   * Uses request deduplication to prevent multiple simultaneous calls for the same userId
   */
  async getUserSubscriptionData(userId: string): Promise<BaseSubscriptionData> {
    // Validate userId
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      logger.error("[SubscriptionsService] Invalid userId provided to getUserSubscriptionData:", { userId, type: typeof userId });
      return {
        subscription: null,
        plan: null,
        limits: getDefaultFeatures(),
      };
    }

    // Check if there's already a pending request for this userId
    const pendingRequest = pendingRequests.get(userId);
    if (pendingRequest) {
      // Don't log every reuse - reduces log noise (deduplication is working)
      try {
        return await pendingRequest;
      } catch (error) {
        // If the pending request failed, remove it and continue to make a new request
        pendingRequests.delete(userId);
        throw error;
      }
    }

    // Create new request and cache the promise
    const requestPromise = (async () => {
      try {
        return await this.fetchUserSubscriptionData(userId);
      } finally {
        // Remove from pending requests when done (success or failure)
        pendingRequests.delete(userId);
      }
    })();

    pendingRequests.set(userId, requestPromise);

    try {
      return await requestPromise;
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
      const userId = await getCurrentUserId();
      if (!userId) {
        return {
          subscription: null,
        plan: null,
        limits: getDefaultFeatures(),
        };
      }

      return await this.getUserSubscriptionData(userId);
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
      const current = await this.repository.getUserMonthlyUsage(userId, month);

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
      const count = await this.repository.getUserAccountCount(userId);

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
   * 
   * NOTE: This function is the main entry point for fetching subscription data.
   * It logs "Fetching subscription data (cache miss)" when the cache does not have data.
   * 
   * Cache strategy:
   * 1. Try to read from User table cache (effectivePlanId, effectiveSubscriptionStatus, subscriptionUpdatedAt)
   * 2. If cache is valid (within 10 minutes), return cached data
   * 3. If not found (cache miss), log "Fetching subscription data (cache miss)",
   *    fetch from Stripe/Supabase and return data (cache is written by repository layer)
   * 
   * This function is called by getUserSubscriptionData() which handles request-level deduplication.
   */
  private async fetchUserSubscriptionData(userId: string): Promise<BaseSubscriptionData> {
    // Validate userId
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      logger.error("[SubscriptionsService] Invalid userId provided to fetchUserSubscriptionData:", { userId, type: typeof userId });
      return {
        subscription: null,
        plan: null,
        limits: getDefaultFeatures(),
      };
    }

    // Try cached subscription data from User table first
    // Pass useServiceRole=true because this is called from within "use cache" functions
    // which cannot access cookies()
    const userCache = await this.repository.getUserSubscriptionCache(userId, true);
    
    // FIX: Repository returns snake_case, not camelCase
    const effectivePlanId = userCache?.effective_plan_id;
    const effectiveSubscriptionStatus = userCache?.effective_subscription_status;
    const effectiveSubscriptionId = userCache?.effective_subscription_id;
    const subscriptionUpdatedAt = userCache?.subscription_updated_at;
    
    if (effectivePlanId && effectiveSubscriptionStatus && subscriptionUpdatedAt) {
      const subscriptionUpdatedAtTime = new Date(subscriptionUpdatedAt).getTime();
      const now = Date.now();
      const cacheAge = now - subscriptionUpdatedAtTime;
      // Optimized: Increased cache age to 10 minutes to reduce database queries
      const CACHE_MAX_AGE = 10 * 60 * 1000; // 10 minutes
      
      const isValidTimestamp = !isNaN(subscriptionUpdatedAtTime) && subscriptionUpdatedAtTime > 0;
      const isFutureTimestamp = cacheAge < 0;
      const isRecentCache = cacheAge >= 0 && cacheAge < CACHE_MAX_AGE;
      const isVeryOldCache = cacheAge > 60 * 60 * 1000;
      
      // Handle future timestamps (timezone/skew issue) - treat as valid cache if within reasonable range
      // Only log if the difference is significant (more than 1 hour in the future)
      if (isFutureTimestamp && Math.abs(cacheAge) > 60 * 60 * 1000) {
        logger.warn(
          `[SubscriptionsService] Subscription cache timestamp is significantly in the future for user ${userId}. ` +
          `This may indicate timezone differences or clock skew. ` +
          `Cache age: ${Math.round(cacheAge / 1000)}s, ` +
          `Timestamp: ${subscriptionUpdatedAt}, ` +
          `Current time: ${new Date(now).toISOString()}`
        );
      }
      
      // Accept cache if: valid timestamp AND (recent OR future within 1 hour OR not very old)
      // Future timestamps within 1 hour are likely just timezone differences and should be accepted
      if (isValidTimestamp && (isRecentCache || (isFutureTimestamp && Math.abs(cacheAge) <= 60 * 60 * 1000) || !isVeryOldCache)) {
        // CRITICAL: Pass useServiceRole=true because we're in a cache context
        // where cookies() can't be accessed, so findPlanById needs to use service role client
        const plan = await this.getPlanById(effectivePlanId, true);
        if (plan) {
          let fullSubscription: BaseSubscription | null = null;
          if (effectiveSubscriptionId) {
            // CRITICAL: Always fetch full subscription from database to get all fields
            // (currentPeriodStart, currentPeriodEnd, trialEndDate, etc.)
            // Use service role client to bypass RLS (called from cache context where cookies() can't be accessed)
            try {
              // Pass useServiceRole=true because we're in a cache context
              const subscriptionRow = await this.repository.findById(effectiveSubscriptionId, true);
              
              if (subscriptionRow) {
                fullSubscription = SubscriptionsMapper.subscriptionToDomain(subscriptionRow as any);
              }
            } catch (error) {
              logger.warn("[SubscriptionsService] Error fetching full subscription, will use fallback", {
                subscriptionId: effectiveSubscriptionId,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          // Cache hit - return cached data
          // IMPORTANT: Only use fallback subscription if we couldn't fetch the full one
          // The fallback is missing critical fields like currentPeriodStart, currentPeriodEnd, trialEndDate
          if (!fullSubscription && effectiveSubscriptionId) {
            logger.warn("[SubscriptionsService] Could not fetch full subscription, using minimal subscription from cache", {
              subscriptionId: effectiveSubscriptionId,
              userId,
            });
            // Fallback: create minimal subscription (missing dates will cause UI issues)
            fullSubscription = {
              id: effectiveSubscriptionId,
              userId: userId,
              planId: effectivePlanId,
              status: effectiveSubscriptionStatus as any,
              householdId: null,
              stripeSubscriptionId: null,
              stripeCustomerId: null,
              currentPeriodStart: null,
              currentPeriodEnd: null,
              trialEndDate: null,
              cancelAtPeriodEnd: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          }

          return {
            subscription: fullSubscription,
            plan,
            limits: plan.features,
          };
        }
      }
    }

    // Fallback: Full query (cache miss or invalid cache)
    // FIX: Pass useServiceRole=true because this is called from within "use cache" functions
    // which cannot access cookies(), so getActiveHouseholdId needs to use service role client
    const householdId = await this.repository.getActiveHouseholdId(userId, true);
    let subscription: BaseSubscription | null = null;

    if (householdId) {
      // FIX: Pass useServiceRole=true because this is called from within "use cache" functions
      // which cannot access cookies(), so findByHouseholdId needs to use service role client
      const subscriptionRow = await this.repository.findByHouseholdId(householdId, true);
      if (subscriptionRow) {
        subscription = SubscriptionsMapper.subscriptionToDomain(subscriptionRow);
      } else {
        // Try owner's subscription for inheritance
        // FIX: Pass useServiceRole=true because this is called from within "use cache" functions
        const ownerId = await this.repository.getHouseholdOwnerId(householdId, true);
        if (ownerId && ownerId !== userId) {
          // FIX: Pass useServiceRole=true because this is called from within "use cache" functions
          const ownerSubscriptionRow = await this.repository.findByUserId(ownerId, true);
          if (ownerSubscriptionRow) {
            subscription = SubscriptionsMapper.subscriptionToDomain(ownerSubscriptionRow);
          }
        }
      }
    }

    // Fallback to user's own subscription
    if (!subscription) {
      // FIX: Pass useServiceRole=true because this is called from within "use cache" functions
      // which cannot access cookies(), so findByUserId needs to use service role client
      const subscriptionRow = await this.repository.findByUserId(userId, true);
      if (subscriptionRow) {
        // Check if subscription is paused in Stripe
        const pauseStatus = await this.isSubscriptionPaused(userId);
        if (pauseStatus.isPaused && pauseStatus.pausedReason === "household_member") {
          // Subscription is paused because user is a household member
          // Don't use this subscription - user should use household/owner subscription instead
        } else {
          subscription = SubscriptionsMapper.subscriptionToDomain(subscriptionRow);
          
          // CRITICAL: If subscription has householdId but we couldn't find it via getActiveHouseholdId,
          // try to find it directly using the householdId from the subscription
          if (subscriptionRow.household_id && !householdId) {
            // Try to find subscription by the householdId from the subscription itself
            // FIX: Pass useServiceRole=true because this is called from within "use cache" functions
            const directSubscriptionRow = await this.repository.findByHouseholdId(subscriptionRow.household_id, true);
            if (directSubscriptionRow) {
              subscription = SubscriptionsMapper.subscriptionToDomain(directSubscriptionRow);
            }
          }
        }
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

    // FIX: Pass useServiceRole=true because this is called from within "use cache" functions
    // which cannot access cookies(), so getPlanById needs to use service role client
    const plan = await this.getPlanById(subscription.planId, true);
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
   * Pause user's personal subscription (e.g., when joining household with subscription)
   * Pauses collection in Stripe but keeps subscription active
   */
  async pauseUserSubscription(userId: string, reason: string, metadata?: Record<string, string>): Promise<{
    paused: boolean;
    error?: string;
  }> {
    try {
      // Get user's personal subscription (by userId, not householdId)
      const subscriptionRow = await this.repository.findByUserId(userId);
      
      if (!subscriptionRow || !subscriptionRow.stripe_subscription_id) {
        // No subscription to pause
        return { paused: true };
      }

      // Check if subscription is already paused
      try {
        const { getStripeClient } = await import("@/src/infrastructure/external/stripe/stripe-client");
        const stripe = getStripeClient();
        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionRow.stripe_subscription_id);
        
        if (stripeSubscription.pause_collection) {
          // Already paused
          logger.debug("[SubscriptionsService] Subscription already paused:", subscriptionRow.stripe_subscription_id);
          return { paused: true };
        }
      } catch (stripeError) {
        logger.error("[SubscriptionsService] Error checking subscription pause status:", stripeError);
        // Continue to try pausing anyway
      }

      // Pause subscription in Stripe
      try {
        const { getStripeClient } = await import("@/src/infrastructure/external/stripe/stripe-client");
        const stripe = getStripeClient();
        
        // Get existing subscription to preserve metadata
        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionRow.stripe_subscription_id);
        const existingMetadata = stripeSubscription.metadata || {};
        
        const updateData: any = {
          pause_collection: {
            behavior: "keep_as_draft",
          },
          metadata: {
            ...existingMetadata,
            pausedReason: reason,
            pausedAt: new Date().toISOString(),
            ...metadata,
          },
        };

        await stripe.subscriptions.update(subscriptionRow.stripe_subscription_id, updateData);
        logger.debug("[SubscriptionsService] Paused Stripe subscription:", {
          subscriptionId: subscriptionRow.stripe_subscription_id,
          reason,
        });
      } catch (stripeError) {
        logger.error("[SubscriptionsService] Error pausing Stripe subscription:", stripeError);
        return { paused: false, error: "Failed to pause subscription in Stripe" };
      }

      return { paused: true };
    } catch (error) {
      logger.error("[SubscriptionsService] Error in pauseUserSubscription:", error);
      return { paused: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  /**
   * Resume user's personal subscription (e.g., when leaving household)
   * Removes pause_collection in Stripe
   */
  async resumeUserSubscription(userId: string): Promise<{
    resumed: boolean;
    error?: string;
  }> {
    try {
      // Get user's personal subscription (by userId, not householdId)
      const subscriptionRow = await this.repository.findByUserId(userId);
      
      if (!subscriptionRow || !subscriptionRow.stripe_subscription_id) {
        // No subscription to resume
        return { resumed: true };
      }

      // Check if subscription is paused
      try {
        const { getStripeClient } = await import("@/src/infrastructure/external/stripe/stripe-client");
        const stripe = getStripeClient();
        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionRow.stripe_subscription_id);
        
        if (!stripeSubscription.pause_collection) {
          // Not paused
          logger.debug("[SubscriptionsService] Subscription not paused:", subscriptionRow.stripe_subscription_id);
          return { resumed: true };
        }
      } catch (stripeError) {
        logger.error("[SubscriptionsService] Error checking subscription pause status:", stripeError);
        // Continue to try resuming anyway
      }

      // Resume subscription in Stripe
      try {
        const { getStripeClient } = await import("@/src/infrastructure/external/stripe/stripe-client");
        const stripe = getStripeClient();
        
        const updateData: any = {
          pause_collection: null,
        };

        // Remove pause metadata
        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionRow.stripe_subscription_id);
        const metadata = { ...stripeSubscription.metadata };
        delete metadata.pausedReason;
        delete metadata.pausedAt;
        delete metadata.pausedByHouseholdId;
        
        if (Object.keys(metadata).length > 0) {
          updateData.metadata = metadata;
        } else {
          // If no metadata left, set to empty object to clear it
          updateData.metadata = {};
        }

        await stripe.subscriptions.update(subscriptionRow.stripe_subscription_id, updateData);
          logger.debug("[SubscriptionsService] Resumed Stripe subscription:", subscriptionRow.stripe_subscription_id);
      } catch (stripeError) {
        logger.error("[SubscriptionsService] Error resuming Stripe subscription:", stripeError);
        return { resumed: false, error: "Failed to resume subscription in Stripe" };
      }

      return { resumed: true };
    } catch (error) {
      logger.error("[SubscriptionsService] Error in resumeUserSubscription:", error);
      return { resumed: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  /**
   * Check if user's subscription is paused
   */
  async isSubscriptionPaused(userId: string): Promise<{
    isPaused: boolean;
    pausedReason?: string;
    pausedAt?: string;
  }> {
    try {
      const subscriptionRow = await this.repository.findByUserId(userId);
      
      if (!subscriptionRow || !subscriptionRow.stripe_subscription_id) {
        return { isPaused: false };
      }

      try {
        const { getStripeClient } = await import("@/src/infrastructure/external/stripe/stripe-client");
        const stripe = getStripeClient();
        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionRow.stripe_subscription_id);
        
        const isPaused = !!stripeSubscription.pause_collection;
        const pausedReason = stripeSubscription.metadata?.pausedReason;
        const pausedAt = stripeSubscription.metadata?.pausedAt;

        return {
          isPaused,
          pausedReason,
          pausedAt,
        };
      } catch (stripeError) {
        logger.error("[SubscriptionsService] Error checking subscription pause status:", stripeError);
        return { isPaused: false };
      }
    } catch (error) {
      logger.error("[SubscriptionsService] Error in isSubscriptionPaused:", error);
      return { isPaused: false };
    }
  }

  /**
   * Cancel active Stripe subscription for a user
   * Used during account deletion
   */
  async cancelUserSubscription(userId: string): Promise<{
    cancelled: boolean;
    error?: string;
  }> {
    try {
      // Get active subscription for user
      // Check both householdId-based and userId-based subscriptions
      const { getCurrentUserId } = await import("../shared/feature-guard");
      const currentUserId = await getCurrentUserId();
      if (!currentUserId) {
        return { cancelled: false, error: "User not authenticated" };
      }

      // Get user's household
      const { MembersRepository } = await import("@/src/infrastructure/database/repositories/members.repository");
      const membersRepository = new MembersRepository();
      const householdId = await membersRepository.getActiveHouseholdId(userId);

      // Try to get subscription by householdId first (current architecture)
      let subscription = null;
      if (householdId) {
        // FIX: Pass useServiceRole=true because this is called from within "use cache" functions
        // which cannot access cookies(), so findByHouseholdId needs to use service role client
        const subscriptionRow = await this.repository.findByHouseholdId(householdId, true);
        if (subscriptionRow && (subscriptionRow.status === "active" || subscriptionRow.status === "trialing")) {
          subscription = subscriptionRow;
        }
      }

      // Fallback to userId-based subscription (backward compatibility)
      if (!subscription) {
        const subscriptionRow = await this.repository.findByUserId(userId);
        if (subscriptionRow && (subscriptionRow.status === "active" || subscriptionRow.status === "trialing")) {
          subscription = subscriptionRow;
        }
      }

      if (!subscription || !subscription.stripe_subscription_id) {
        // No active subscription to cancel
        return { cancelled: true };
      }

      // Cancel subscription in Stripe
      try {
        const { getStripeClient } = await import("@/src/infrastructure/external/stripe/stripe-client");
        const stripe = getStripeClient();
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
        logger.debug("[SubscriptionsService] Cancelled Stripe subscription:", subscription.stripe_subscription_id);
      } catch (stripeError) {
        logger.error("[SubscriptionsService] Error cancelling Stripe subscription:", stripeError);
        // Don't fail deletion if Stripe cancellation fails, but log it
        return { cancelled: false, error: "Failed to cancel subscription in Stripe" };
      }

      // Update subscription status in database
      await this.repository.update(subscription.id, {
        status: "cancelled",
        updatedAt: new Date().toISOString(),
      });

      return { cancelled: true };
    } catch (error) {
      logger.error("[SubscriptionsService] Error in cancelUserSubscription:", error);
      return { cancelled: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
}

