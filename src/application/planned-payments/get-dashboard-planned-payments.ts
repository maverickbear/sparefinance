/**
 * Cached function to get planned payments for dashboard
 * This ensures PlannedPaymentsService is called only once per request (per filter combination)
 * Uses Next.js "use cache" directive for Cache Components support
 * 
 * CRITICAL: Added in-memory cache layer to prevent duplicate calls
 * even when Next.js cache doesn't work across different contexts
 */

import { cacheLife, cacheTag } from "next/cache";
import { makePlannedPaymentsService } from "./planned-payments.factory";
import { getCurrentUserId } from "../shared/feature-guard";
import { logger } from "@/src/infrastructure/utils/logger";
import { BasePlannedPayment } from "../../domain/planned-payments/planned-payments.types";

const log = logger.withPrefix("PlannedPaymentsCache");

// In-memory cache for request-level deduplication
// This works across all contexts (server components, API routes, etc.)
// Maps cacheKey -> { promise: Promise<any>, timestamp: number }
const requestCache = new Map<string, { promise: Promise<any>; timestamp: number }>();

// Cache TTL: Keep promises in cache for 5 seconds to allow concurrent calls to reuse them
const CACHE_TTL = 5000; // 5 seconds

/**
 * Normalize date to start of day (00:00:00) for consistent cache keys
 */
function normalizeStartDate(date: Date): string {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized.toISOString().split('T')[0];
}

/**
 * Normalize date to end of day (23:59:59) for consistent cache keys
 */
function normalizeEndDate(date: Date): string {
  const normalized = new Date(date);
  normalized.setHours(23, 59, 59, 999);
  return normalized.toISOString().split('T')[0];
}

/**
 * Create cache key from filters
 * Normalizes dates to reduce cache misses from time differences
 */
function createCacheKey(
  userId: string,
  filters?: {
    startDate?: Date;
    endDate?: Date;
    status?: "scheduled" | "paid" | "skipped" | "cancelled";
    type?: "expense" | "income" | "transfer";
    source?: "recurring" | "debt" | "manual" | "subscription" | "goal";
    limit?: number;
    page?: number;
  }
): string {
  const parts = [`planned-payments-${userId}`];
  
  if (filters?.startDate) {
    parts.push(`start-${normalizeStartDate(filters.startDate)}`);
  }
  if (filters?.endDate) {
    parts.push(`end-${normalizeEndDate(filters.endDate)}`);
  }
  if (filters?.status) {
    parts.push(`status-${filters.status}`);
  }
  if (filters?.type) {
    parts.push(`type-${filters.type}`);
  }
  if (filters?.source) {
    parts.push(`source-${filters.source}`);
  }
  if (filters?.limit !== undefined) {
    parts.push(`limit-${filters.limit}`);
  }
  if (filters?.page !== undefined) {
    parts.push(`page-${filters.page}`);
  }
  
  return parts.join("-");
}

/**
 * Internal cached function keyed by userId and filters
 * Uses "use cache" directive for Next.js Cache Components
 * 
 * CRITICAL: Added request-level deduplication to prevent duplicate calls
 * even when Next.js cache doesn't work across different execution contexts
 */
async function getPlannedPaymentsCachedInternal(
  userId: string,
  filters?: {
    startDate?: Date;
    endDate?: Date;
    status?: "scheduled" | "paid" | "skipped" | "cancelled";
    type?: "expense" | "income" | "transfer";
    source?: "recurring" | "debt" | "manual" | "subscription" | "goal";
    limit?: number;
    page?: number;
  },
  accessToken?: string,
  refreshToken?: string
): Promise<{ plannedPayments: BasePlannedPayment[]; total: number }> {
  "use cache";
  const cacheKey = createCacheKey(userId, filters);
  cacheTag(cacheKey, "planned-payments");
  // Planned payments change more frequently than accounts, use shorter cache times
  cacheLife({ stale: 15, revalidate: 60, expire: 180 });

  // CRITICAL: Check in-memory cache first to prevent duplicate calls
  // This works even when Next.js cache doesn't work across contexts
  const cached = requestCache.get(cacheKey);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    // Only reuse if cache is still fresh (within TTL)
    if (age < CACHE_TTL) {
      log.debug("Using in-memory cached promise (deduplication)", { userId, cacheKey, age: `${age}ms` });
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

  log.debug("Computing planned payments (cache miss)", { userId, cacheKey });

  // Create new promise and cache it
  const service = makePlannedPaymentsService();
  const dataPromise = service.getPlannedPayments(filters, accessToken, refreshToken);
  
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
 * Get planned payments for dashboard (cached per request)
 * Uses "use cache" directive for Next.js Cache Components
 * 
 * @param filters - Optional filters for planned payments
 * @param accessToken - Optional access token for authentication
 * @param refreshToken - Optional refresh token for authentication
 */
export async function getPlannedPaymentsForDashboard(
  filters?: {
    startDate?: Date;
    endDate?: Date;
    status?: "scheduled" | "paid" | "skipped" | "cancelled";
    type?: "expense" | "income" | "transfer";
    source?: "recurring" | "debt" | "manual" | "subscription" | "goal";
    limit?: number;
    page?: number;
  },
  accessToken?: string,
  refreshToken?: string
): Promise<{ plannedPayments: BasePlannedPayment[]; total: number }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { plannedPayments: [], total: 0 };
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

  return getPlannedPaymentsCachedInternal(userId, filters, finalAccessToken, finalRefreshToken);
}

