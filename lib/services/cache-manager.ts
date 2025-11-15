/**
 * Cache Manager Service
 * Centralized cache management with consistent tagging and revalidation
 * Uses Redis when available, falls back to Next.js cache
 */

import { unstable_cache, revalidateTag } from 'next/cache';
import { cache as redisCache } from './redis';

/**
 * Cache tags for different data types
 */
export const CACHE_TAGS = {
  TRANSACTIONS: 'transactions',
  ACCOUNTS: 'accounts',
  BUDGETS: 'budgets',
  GOALS: 'goals',
  DEBTS: 'debts',
  CATEGORIES: 'categories',
  DASHBOARD: 'dashboard',
  FINANCIAL_HEALTH: 'financial-health',
  INVESTMENTS: 'investments',
  LIABILITIES: 'liabilities',
  PROFILE: 'profile',
  ONBOARDING: 'onboarding',
} as const;

/**
 * Cache durations (in seconds)
 */
export const CACHE_DURATIONS = {
  SHORT: 10, // 10 seconds - for frequently changing data
  MEDIUM: 60, // 1 minute - for moderate data
  LONG: 300, // 5 minutes - for stable data
  VERY_LONG: 3600, // 1 hour - for rarely changing data
} as const;

/**
 * Cache key generators
 */
export const generateCacheKey = {
  /**
   * Generate cache key for transactions
   */
  transactions: (params: {
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    accountId?: string;
    categoryId?: string;
    type?: string;
  }) => {
    const parts = ['transactions'];
    if (params.userId) parts.push(params.userId);
    if (params.startDate) parts.push(params.startDate.toISOString());
    if (params.endDate) parts.push(params.endDate.toISOString());
    if (params.accountId) parts.push(params.accountId);
    if (params.categoryId) parts.push(params.categoryId);
    if (params.type) parts.push(params.type);
    return parts.join(':');
  },

  /**
   * Generate cache key for accounts
   */
  accounts: (userId?: string) => {
    return userId ? `accounts:${userId}` : 'accounts';
  },

  /**
   * Generate cache key for budgets
   */
  budgets: (params: { userId?: string; period?: Date }) => {
    const parts = ['budgets'];
    if (params.userId) parts.push(params.userId);
    if (params.period) {
      parts.push(`${params.period.getFullYear()}-${params.period.getMonth()}`);
    }
    return parts.join(':');
  },

  /**
   * Generate cache key for dashboard
   */
  dashboard: (params: { userId?: string; month?: Date }) => {
    const parts = ['dashboard'];
    if (params.userId) parts.push(params.userId);
    if (params.month) {
      parts.push(`${params.month.getFullYear()}-${params.month.getMonth()}`);
    }
    return parts.join(':');
  },

  /**
   * Generate cache key for financial health
   */
  financialHealth: (params: { userId?: string; month?: Date }) => {
    const parts = ['financial-health'];
    if (params.userId) parts.push(params.userId);
    if (params.month) {
      parts.push(`${params.month.getFullYear()}-${params.month.getMonth()}`);
    }
    return parts.join(':');
  },
};

/**
 * Create a cached function with proper tags and revalidation
 */
export function createCachedFunction<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: {
    keyFn: (...args: TArgs) => string;
    tags: string[];
    revalidate?: number;
  }
) {
  return (...args: TArgs): Promise<TResult> => {
    const cacheKey = options.keyFn(...args);
    
    return unstable_cache(
      async () => fn(...args),
      [cacheKey],
      {
        tags: options.tags,
        revalidate: options.revalidate ?? CACHE_DURATIONS.MEDIUM,
      }
    )();
  };
}

/**
 * Invalidate cache by tags
 */
export function invalidateCache(...tags: string[]): void {
  tags.forEach(tag => {
    revalidateTag(tag);
  });
}

/**
 * Invalidate all related caches when transactions change
 */
export function invalidateTransactionCaches(): void {
  invalidateCache(
    CACHE_TAGS.TRANSACTIONS,
    CACHE_TAGS.DASHBOARD,
    CACHE_TAGS.FINANCIAL_HEALTH,
    CACHE_TAGS.ACCOUNTS, // Balance depends on transactions
  );
}

/**
 * Invalidate all related caches when accounts change
 */
export function invalidateAccountCaches(): void {
  invalidateCache(
    CACHE_TAGS.ACCOUNTS,
    CACHE_TAGS.DASHBOARD,
    CACHE_TAGS.FINANCIAL_HEALTH,
  );
}

/**
 * Invalidate all related caches when budgets change
 */
export function invalidateBudgetCaches(): void {
  invalidateCache(
    CACHE_TAGS.BUDGETS,
    CACHE_TAGS.DASHBOARD,
  );
}

/**
 * Invalidate all related caches when goals change
 */
export function invalidateGoalCaches(): void {
  invalidateCache(
    CACHE_TAGS.GOALS,
    CACHE_TAGS.DASHBOARD,
  );
}

/**
 * Invalidate all dashboard-related caches
 */
export function invalidateDashboardCaches(): void {
  invalidateCache(
    CACHE_TAGS.DASHBOARD,
    CACHE_TAGS.FINANCIAL_HEALTH,
    CACHE_TAGS.TRANSACTIONS,
    CACHE_TAGS.ACCOUNTS,
    CACHE_TAGS.BUDGETS,
    CACHE_TAGS.GOALS,
  );
}

/**
 * Cache wrapper for async functions
 * Automatically handles cache key generation and tag management
 * Uses Redis when available, falls back to Next.js cache
 */
export async function withCache<T>(
  fn: () => Promise<T>,
  options: {
    key: string;
    tags: string[];
    revalidate?: number;
    useRedis?: boolean; // Force Redis usage if available
  }
): Promise<T> {
  // Try Redis first if enabled
  if (options.useRedis) {
    const redisKey = `cache:${options.key}`;
    const cached = await redisCache.get<T>(redisKey);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - execute function and cache result
    const result = await fn();
    const ttl = options.revalidate ?? CACHE_DURATIONS.MEDIUM;
    await redisCache.set(redisKey, result, ttl);
    return result;
  }

  // Fallback to Next.js cache
  return unstable_cache(
    fn,
    [options.key],
    {
      tags: options.tags,
      revalidate: options.revalidate ?? CACHE_DURATIONS.MEDIUM,
    }
  )();
}

/**
 * Redis-backed cache for dashboard data
 * Use this for frequently accessed data that benefits from Redis
 */
export async function withRedisCache<T>(
  fn: () => Promise<T>,
  options: {
    key: string;
    ttlSeconds?: number;
  }
): Promise<T> {
  const redisKey = `cache:${options.key}`;
  
  // Try to get from Redis
  const cached = await redisCache.get<T>(redisKey);
  if (cached !== null) {
    return cached;
  }

  // Cache miss - execute function and cache result
  const result = await fn();
  const ttl = options.ttlSeconds ?? CACHE_DURATIONS.MEDIUM;
  await redisCache.set(redisKey, result, ttl);
  return result;
}

/**
 * Invalidate Redis cache by key pattern
 * Note: Upstash doesn't support pattern matching - use specific keys or tags
 */
export async function invalidateRedisCache(pattern: string): Promise<void> {
  // For pattern-based invalidation, maintain a set of keys per tag
  // and delete them individually
  // For now, this is a no-op - implement tag-based invalidation if needed
  console.warn('[Cache] Pattern-based invalidation not fully supported. Use tag-based invalidation instead.');
}

