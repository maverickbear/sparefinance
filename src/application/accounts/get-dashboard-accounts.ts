/**
 * Cached function to get accounts for dashboard
 * This ensures AccountsService is called only once per request (per includeHoldings setting)
 * Uses Next.js "use cache" directive for Cache Components support
 * 
 * CRITICAL: Added in-memory cache layer to prevent duplicate calls
 * even when Next.js cache doesn't work across different contexts
 */

import { cacheLife, cacheTag } from "next/cache";
import { makeAccountsService } from "./accounts.factory";
import { getCurrentUserId } from "../shared/feature-guard";
import { logger } from "@/src/infrastructure/utils/logger";

const log = logger.withPrefix("AccountsCache");

// In-memory cache for request-level deduplication
// This works across all contexts (server components, API routes, etc.)
// Maps cacheKey -> { promise: Promise<any[]>, timestamp: number }
const requestCache = new Map<string, { promise: Promise<any>; timestamp: number }>();

// Cache TTL: Keep promises in cache for 5 seconds to allow concurrent calls to reuse them
const CACHE_TTL = 5000; // 5 seconds

/**
 * Internal cached function keyed by userId and includeHoldings
 * Uses "use cache" directive for Next.js Cache Components
 * Calls fetchAccountsInternal directly to avoid nested cache directives
 * 
 * CRITICAL: Added request-level deduplication to prevent duplicate calls
 * even when Next.js cache doesn't work across different execution contexts
 */
async function getAccountsCachedInternal(
  userId: string, 
  includeHoldings: boolean,
  accessToken?: string,
  refreshToken?: string
) {
  "use cache";
  // Create unique cache key combining userId and includeHoldings
  const cacheKey = `accounts-${userId}-${includeHoldings ? "with" : "without"}-holdings`;
  cacheTag(cacheKey, "accounts");
  cacheLife({ stale: 30, revalidate: 120, expire: 300 });

  // CRITICAL: Check in-memory cache first to prevent duplicate calls
  // This works even when Next.js cache doesn't work across contexts
  const cached = requestCache.get(cacheKey);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    // Only reuse if cache is still fresh (within TTL)
    if (age < CACHE_TTL) {
      log.debug("Using in-memory cached promise (deduplication)", { userId, includeHoldings, age: `${age}ms` });
      try {
        return await cached.promise;
      } catch (error) {
        // If cached promise failed, remove it and continue
        requestCache.delete(cacheKey);
        throw error;
      }
    } else {
      // Cache expired, remove it
      requestCache.delete(cacheKey);
    }
  }

  log.debug("Computing accounts (cache miss)", { userId, includeHoldings });

  // Create new promise and cache it
  const service = makeAccountsService();
  const dataPromise = (service as any).fetchAccountsInternal(userId, includeHoldings, accessToken, refreshToken);
  
  // Cache the promise with timestamp to deduplicate concurrent calls
  requestCache.set(cacheKey, { promise: dataPromise, timestamp: Date.now() });
  
  // Clean up after promise resolves (success or failure)
  // Use a longer delay to allow concurrent calls to reuse the promise
  dataPromise
    .then(() => {
      // Clean up after TTL expires to allow concurrent calls to reuse
      setTimeout(() => {
        const cached = requestCache.get(cacheKey);
        // Only delete if this is still the same promise (not replaced)
        if (cached && cached.promise === dataPromise) {
          requestCache.delete(cacheKey);
        }
      }, CACHE_TTL);
    })
    .catch(() => {
      // Clean up immediately on error, but only if it's still the same promise
      const cached = requestCache.get(cacheKey);
      if (cached && cached.promise === dataPromise) {
        requestCache.delete(cacheKey);
      }
    });

  return dataPromise;
}

/**
 * Get accounts for dashboard (cached per request)
 * includeHoldings is a boolean key to avoid object identity misses
 * Uses "use cache" directive for Next.js Cache Components
 * 
 * @param includeHoldings - Whether to include investment holdings
 * @param accessToken - Optional access token for authentication (if not provided, will try to get from cookies)
 * @param refreshToken - Optional refresh token for authentication (if not provided, will try to get from cookies)
 */
export async function getAccountsForDashboard(
  includeHoldings: boolean = true,
  accessToken?: string,
  refreshToken?: string
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return [];
  }

  // Get tokens if not provided (for direct calls outside cache)
  // This ensures proper authentication when tokens are not explicitly passed
  let finalAccessToken = accessToken;
  let finalRefreshToken = refreshToken;

  if (!finalAccessToken || !finalRefreshToken) {
    try {
      const { createServerClient } = await import("@/src/infrastructure/database/supabase-server");
      const supabase = await createServerClient();
      // SECURITY: Use getUser() first to verify authentication, then getSession() for tokens
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Only get session tokens if user is authenticated
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          finalAccessToken = finalAccessToken || session.access_token;
          finalRefreshToken = finalRefreshToken || session.refresh_token;
        }
      }
    } catch (error: any) {
      // If we can't get tokens (e.g., inside unstable_cache), continue without them
      // The createServerClient will try to get from cookies when called
      log.debug("Could not get tokens, will try from cookies:", error?.message);
    }
  }

  return getAccountsCachedInternal(userId, includeHoldings, finalAccessToken, finalRefreshToken);
}

