/**
 * Redis/Upstash Client Service
 * Provides centralized Redis connection for caching and rate limiting
 * 
 * Uses Upstash Redis (serverless) in production, with fallback to local Redis in development
 */

import { Redis } from '@upstash/redis';

let redisClient: Redis | null = null;

/**
 * Get Redis client instance (singleton)
 */
export function getRedisClient(): Redis | null {
  // Return null if Redis is not configured (graceful degradation)
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[Redis] Redis not configured - caching and rate limiting will not work properly');
    }
    return null;
  }

  if (!redisClient) {
    try {
      redisClient = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    } catch (error) {
      console.error('[Redis] Failed to initialize Redis client:', error);
      return null;
    }
  }

  return redisClient;
}

/**
 * Cache operations
 */
export const cache = {
  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const client = getRedisClient();
    if (!client) return null;

    try {
      const value = await client.get<T>(key);
      return value;
    } catch (error) {
      console.error(`[Redis] Error getting key ${key}:`, error);
      return null;
    }
  },

  /**
   * Set value in cache with TTL
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      if (ttlSeconds) {
        await client.setex(key, ttlSeconds, value);
      } else {
        await client.set(key, value);
      }
      return true;
    } catch (error) {
      console.error(`[Redis] Error setting key ${key}:`, error);
      return false;
    }
  },

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      await client.del(key);
      return true;
    } catch (error) {
      console.error(`[Redis] Error deleting key ${key}:`, error);
      return false;
    }
  },

  /**
   * Delete multiple keys matching pattern
   * Note: Upstash Redis REST API doesn't support KEYS/SCAN commands
   * This is a placeholder - in production, maintain a set of keys per tag/namespace
   */
  async deletePattern(pattern: string): Promise<number> {
    // Upstash Redis REST API doesn't support pattern matching
    // For production, maintain a set of keys per namespace/tag
    // and delete them individually when needed
    console.warn('[Redis] Pattern deletion not supported by Upstash REST API. Use individual key deletion or maintain key sets.');
    return 0;
  },

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`[Redis] Error checking existence of key ${key}:`, error);
      return false;
    }
  },

  /**
   * Increment value (useful for counters)
   */
  async increment(key: string, by: number = 1): Promise<number | null> {
    const client = getRedisClient();
    if (!client) return null;

    try {
      return await client.incrby(key, by);
    } catch (error) {
      console.error(`[Redis] Error incrementing key ${key}:`, error);
      return null;
    }
  },

  /**
   * Set expiration on existing key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      const result = await client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      console.error(`[Redis] Error setting expiration on key ${key}:`, error);
      return false;
    }
  },
};

/**
 * Rate limiting operations
 */
export const rateLimit = {
  /**
   * Check and increment rate limit
   * Returns: { allowed: boolean, remaining: number, resetTime: number }
   */
  async check(
    key: string,
    maxRequests: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const client = getRedisClient();
    if (!client) {
      // Fallback: allow request if Redis is not available
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: Date.now() + windowMs,
      };
    }

    try {
      const now = Date.now();
      const windowSeconds = Math.ceil(windowMs / 1000);
      const resetTime = now + windowMs;

      // Use sliding window log algorithm
      // Remove old entries outside the window
      const oldestAllowed = now - windowMs;
      
      // Get current count
      const count = await client.zcount(key, oldestAllowed, now);
      
      if (count >= maxRequests) {
        // Rate limit exceeded
        // Get the oldest entry to calculate reset time
        const oldest = await client.zrange(key, 0, 0, { byScore: true });
        const oldestTime = oldest.length > 0 ? Number(oldest[0]) : now;
        const actualResetTime = oldestTime + windowMs;

        return {
          allowed: false,
          remaining: 0,
          resetTime: actualResetTime,
        };
      }

      // Add current request to the window
      await client.zadd(key, { score: now, member: `${now}-${Math.random()}` });
      // Set expiration on the key
      await client.expire(key, windowSeconds);

      return {
        allowed: true,
        remaining: maxRequests - count - 1,
        resetTime,
      };
    } catch (error) {
      console.error(`[Redis] Error checking rate limit for key ${key}:`, error);
      // On error, allow the request (fail open)
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: Date.now() + windowMs,
      };
    }
  },

  /**
   * Reset rate limit for a key
   */
  async reset(key: string): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      await client.del(key);
      return true;
    } catch (error) {
      console.error(`[Redis] Error resetting rate limit for key ${key}:`, error);
      return false;
    }
  },
};

/**
 * Session management operations
 */
export const session = {
  /**
   * Store session data
   */
  async set(sessionId: string, data: Record<string, unknown>, ttlSeconds: number = 3600): Promise<boolean> {
    return cache.set(`session:${sessionId}`, data, ttlSeconds);
  },

  /**
   * Get session data
   */
  async get<T = Record<string, unknown>>(sessionId: string): Promise<T | null> {
    return cache.get<T>(`session:${sessionId}`);
  },

  /**
   * Delete session
   */
  async delete(sessionId: string): Promise<boolean> {
    return cache.delete(`session:${sessionId}`);
  },

  /**
   * Refresh session TTL
   */
  async refresh(sessionId: string, ttlSeconds: number = 3600): Promise<boolean> {
    return cache.expire(`session:${sessionId}`, ttlSeconds);
  },
};

