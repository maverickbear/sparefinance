/**
 * Cached functions to get subscription data per request
 * Ensures SubscriptionsService is invoked only once per user per request
 * Uses Next.js "use cache" directive for Cache Components support
 * 
 * CRITICAL: Added in-memory cache layer to prevent duplicate calls
 * even when Next.js cache doesn't work across different contexts
 * 
 * NOTE: This is the main entry point for fetching subscription data.
 * All components, pages, and API routes should use getCachedSubscriptionData()
 * or getDashboardSubscription() instead of calling SubscriptionsService directly.
 * 
 * This ensures:
 * 1. Request-level deduplication (in-memory cache, 5s TTL)
 * 2. Next.js cache per request ("use cache" directive, 60s stale, 180s revalidate, 600s expire)
 * 3. User table cache (10 min TTL) checked by SubscriptionsService
 * 
 * See SUBSCRIPTION_CACHE_INVESTIGATION.md for full details.
 */

import { cacheLife, cacheTag } from "next/cache";
import { logger } from "@/src/infrastructure/utils/logger";
import { makeSubscriptionsService } from "./subscriptions.factory";
import { getCurrentUserId } from "../shared/feature-guard";

const log = logger.withPrefix("SubscriptionsCache");

// In-memory cache for request-level deduplication
// This works across all contexts (server components, API routes, etc.)
// Maps userId -> { promise: Promise<BaseSubscriptionData>, timestamp: number }
const requestCache = new Map<string, { promise: Promise<any>; timestamp: number }>();

// Cache TTL: Keep promises in cache for 5 seconds to allow concurrent calls to reuse them
const CACHE_TTL = 5000; // 5 seconds

/**
 * Internal cached fetch keyed by userId
 * Uses "use cache" directive for Next.js Cache Components
 * This function is cached per userId and can be revalidated via cacheTag
 * 
 * CRITICAL: Added request-level deduplication to prevent duplicate calls
 * even when Next.js cache doesn't work across different execution contexts
 * 
 * Cache strategy:
 * 1. Check in-memory requestCache first (deduplicates concurrent calls within 5 seconds)
 * 2. If not in memory, Next.js "use cache" directive handles per-request caching
 * 3. Cache key: `subscription-${userId}` with tag "subscriptions"
 * 4. Cache TTL: stale=60s, revalidate=180s, expire=600s (Next.js cache)
 * 5. If cache miss, calls SubscriptionsService.getUserSubscriptionData(userId)
 *    which internally checks User table cache (10 minute TTL) before full query
 */
async function getCachedSubscriptionDataInternal(userId: string) {
  "use cache";
  cacheTag(`subscription-${userId}`, "subscriptions");
  // Optimized cache: longer stale time, shorter revalidate, longer expire
  // stale: 60s (data can be stale for 60s before revalidation)
  // revalidate: 180s (revalidate in background after 180s)
  // expire: 600s (expire after 10 minutes)
  cacheLife({ stale: 60, revalidate: 180, expire: 600 });

  // CRITICAL: Check in-memory cache first to prevent duplicate calls
  // This works even when Next.js cache doesn't work across contexts
  const cached = requestCache.get(userId);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    // Only reuse if cache is still fresh (within TTL)
    if (age < CACHE_TTL) {
      try {
        return await cached.promise;
      } catch (error) {
        // If cached promise failed, remove it and continue
        requestCache.delete(userId);
        throw error;
      }
    } else {
      // Cache expired, remove it
      requestCache.delete(userId);
    }
  }

  // Create new promise and cache it
  const service = makeSubscriptionsService();
  const dataPromise = service.getUserSubscriptionData(userId);
  
  // Cache the promise with timestamp to deduplicate concurrent calls
  requestCache.set(userId, { promise: dataPromise, timestamp: Date.now() });
  
  // Clean up after promise resolves (success or failure)
  // Use a longer delay to allow concurrent calls to reuse the promise
  dataPromise
    .then(() => {
      // Clean up after TTL expires to allow concurrent calls to reuse
      setTimeout(() => {
        const cached = requestCache.get(userId);
        // Only delete if this is still the same promise (not replaced)
        if (cached && cached.promise === dataPromise) {
          requestCache.delete(userId);
        }
      }, CACHE_TTL);
    })
    .catch(() => {
      // Clean up immediately on error, but only if it's still the same promise
      const cached = requestCache.get(userId);
      if (cached && cached.promise === dataPromise) {
        requestCache.delete(userId);
      }
    });

  return dataPromise;
}

/**
 * Public accessor for subscription data, resolving current user when not provided.
 * Exported so all read paths share the same cached result.
 * 
 * CRITICAL: If called from within a "use cache" function, userId MUST be provided
 * to avoid calling getCurrentUserId() (which uses cookies()) inside a cache scope.
 */
export async function getCachedSubscriptionData(userId?: string) {
  const resolvedUserId = userId ?? (await getCurrentUserId());
  if (!resolvedUserId) {
    return {
      subscription: null,
      plan: null,
      limits: null,
    };
  }

  return getCachedSubscriptionDataInternal(resolvedUserId);
}

/**
 * Backwards-compatible dashboard accessor
 * 
 * CRITICAL: If called from within a "use cache" function, userId MUST be provided
 * to avoid calling getCurrentUserId() (which uses cookies()) inside a cache scope.
 */
export async function getDashboardSubscription(userId?: string) {
  return getCachedSubscriptionData(userId);
}

/**
 * Clear in-memory request cache for a specific user
 * Used after creating/updating subscriptions to ensure fresh data
 */
export function clearSubscriptionRequestCache(userId: string): void {
  requestCache.delete(userId);
}

