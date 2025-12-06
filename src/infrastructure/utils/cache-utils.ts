/**
 * Cache utility functions for optimized cache invalidation
 */

import { revalidateTag } from "next/cache";
import { logger } from "./logger";

const log = logger.withPrefix("CacheUtils");

/**
 * Invalidate subscription cache for a specific user
 * This is more efficient than invalidating all subscriptions
 */
export async function invalidateUserSubscriptionCache(userId: string): Promise<void> {
  try {
    // Invalidate specific user's subscription cache
    revalidateTag(`subscription-${userId}`, 'max');
    log.debug("Invalidated user subscription cache", { userId });
  } catch (error) {
    log.warn("Error invalidating user subscription cache:", error);
  }
}

/**
 * Invalidate all subscription caches
 * Use this when changes affect multiple users (e.g., plan updates)
 */
export async function invalidateAllSubscriptionCaches(): Promise<void> {
  try {
    revalidateTag('subscriptions', 'max');
    log.debug("Invalidated all subscription caches");
  } catch (error) {
    log.warn("Error invalidating all subscription caches:", error);
  }
}

/**
 * Invalidate subscription and account caches for a specific user
 * This is the recommended way to invalidate cache after subscription changes
 */
export async function invalidateUserCaches(userId: string, options?: {
  subscriptions?: boolean;
  accounts?: boolean;
}): Promise<void> {
  try {
    const { subscriptions = true, accounts = true } = options || {};
    
    if (subscriptions) {
      await invalidateUserSubscriptionCache(userId);
      // Also invalidate general tag for safety
      await invalidateAllSubscriptionCaches();
    }
    
    if (accounts) {
      revalidateTag('accounts', 'max');
      log.debug("Invalidated account cache", { userId });
    }
    
    log.debug("Invalidated user caches", { userId, subscriptions, accounts });
  } catch (error) {
    log.warn("Error invalidating user caches:", error);
  }
}

