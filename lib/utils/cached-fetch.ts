/**
 * Cached Fetch Utility
 * Wrapper around fetch() that respects Cache-Control headers from the server
 * Implements stale-while-revalidate pattern when supported by server
 */

interface CachedFetchOptions extends RequestInit {
  /**
   * Force refresh (bypass cache)
   */
  forceRefresh?: boolean;
  
  /**
   * Custom cache TTL in seconds (overrides server headers if provided)
   */
  cacheTTL?: number;
}

interface CacheEntry {
  data: any;
  timestamp: number;
  cacheControl: string | null;
  expiresAt: number;
}

// In-memory cache for client-side (only for current session)
const memoryCache = new Map<string, CacheEntry>();

/**
 * Parse Cache-Control header to extract max-age and stale-while-revalidate
 */
function parseCacheControl(header: string | null): {
  maxAge?: number;
  staleWhileRevalidate?: number;
  noCache?: boolean;
  noStore?: boolean;
} {
  if (!header) return {};
  
  const result: {
    maxAge?: number;
    staleWhileRevalidate?: number;
    noCache?: boolean;
    noStore?: boolean;
  } = {};
  
  const parts = header.split(',').map(p => p.trim());
  
  for (const part of parts) {
    if (part === 'no-cache') {
      result.noCache = true;
    } else if (part === 'no-store') {
      result.noStore = true;
    } else if (part.startsWith('max-age=')) {
      result.maxAge = parseInt(part.split('=')[1], 10);
    } else if (part.startsWith('s-maxage=')) {
      // Use s-maxage if max-age is not present
      if (!result.maxAge) {
        result.maxAge = parseInt(part.split('=')[1], 10);
      }
    } else if (part.startsWith('stale-while-revalidate=')) {
      result.staleWhileRevalidate = parseInt(part.split('=')[1], 10);
    }
  }
  
  return result;
}

/**
 * Check if cached data is still fresh
 */
function isCacheFresh(entry: CacheEntry, maxAge: number): boolean {
  const age = (Date.now() - entry.timestamp) / 1000; // age in seconds
  return age < maxAge;
}

/**
 * Check if cached data is stale but can be used while revalidating
 */
function canUseStaleWhileRevalidate(
  entry: CacheEntry,
  maxAge: number,
  staleWhileRevalidate: number
): boolean {
  const age = (Date.now() - entry.timestamp) / 1000; // age in seconds
  return age >= maxAge && age < (maxAge + staleWhileRevalidate);
}

/**
 * Enhanced fetch that respects Cache-Control headers
 * 
 * Features:
 * - Respects max-age from server Cache-Control header
 * - Implements stale-while-revalidate pattern
 * - Returns cached data immediately if fresh
 * - Revalidates in background if stale but within stale-while-revalidate window
 * 
 * @param url - Request URL
 * @param options - Fetch options (with optional forceRefresh and cacheTTL)
 * @returns Promise with response data
 */
export async function cachedFetch<T = any>(
  url: string,
  options: CachedFetchOptions = {}
): Promise<T> {
  const { forceRefresh = false, cacheTTL, ...fetchOptions } = options;
  
  // Generate cache key
  const cacheKey = `${url}:${JSON.stringify(fetchOptions)}`;
  
  // Check memory cache first (only if not forcing refresh)
  if (!forceRefresh) {
    const cached = memoryCache.get(cacheKey);
    
    if (cached) {
      // Check if cache entry has expired
      if (Date.now() < cached.expiresAt) {
        // Cache is still valid, return immediately
        return cached.data as T;
      }
      
      // Cache expired, remove it
      memoryCache.delete(cacheKey);
    }
  }
  
  // Make fetch request
  const response = await fetch(url, {
    ...fetchOptions,
    // Add cache control to request if forcing refresh
    cache: forceRefresh ? 'no-store' : 'default',
  });
  
  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
  }
  
  // Parse response
  const data = await response.json();
  
  // Parse Cache-Control header
  const cacheControl = response.headers.get('Cache-Control');
  const cacheInfo = parseCacheControl(cacheControl);
  
  // Determine cache expiration
  let expiresAt = Date.now() + (cacheTTL ? cacheTTL * 1000 : 0);
  
  if (cacheInfo.maxAge && !cacheTTL) {
    expiresAt = Date.now() + (cacheInfo.maxAge * 1000);
  } else if (!cacheInfo.maxAge && !cacheTTL) {
    // No cache info, use default short TTL (5 seconds)
    expiresAt = Date.now() + 5000;
  }
  
  // Store in cache if not no-store
  if (!cacheInfo.noStore && !forceRefresh) {
    memoryCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      cacheControl: cacheControl,
      expiresAt,
    });
    
    // Clean up expired entries periodically (keep cache size reasonable)
    if (memoryCache.size > 100) {
      const now = Date.now();
      for (const [key, entry] of memoryCache.entries()) {
        if (now >= entry.expiresAt) {
          memoryCache.delete(key);
        }
      }
    }
  }
  
  // If we have stale-while-revalidate and cached data exists, revalidate in background
  if (cacheInfo.staleWhileRevalidate && !forceRefresh) {
    const cached = memoryCache.get(cacheKey);
    if (cached && cacheInfo.maxAge) {
      if (canUseStaleWhileRevalidate(cached, cacheInfo.maxAge, cacheInfo.staleWhileRevalidate)) {
        // Data is stale but within stale-while-revalidate window
        // Return current data immediately, revalidate in background
        (async () => {
          try {
            const revalidateResponse = await fetch(url, {
              ...fetchOptions,
              cache: 'no-store', // Force fresh data
            });
            
            if (revalidateResponse.ok) {
              const freshData = await revalidateResponse.json();
              const freshCacheControl = revalidateResponse.headers.get('Cache-Control');
              const freshCacheInfo = parseCacheControl(freshCacheControl);
              
              let freshExpiresAt = Date.now() + (cacheTTL ? cacheTTL * 1000 : 0);
              if (freshCacheInfo.maxAge && !cacheTTL) {
                freshExpiresAt = Date.now() + (freshCacheInfo.maxAge * 1000);
              }
              
              // Update cache with fresh data
              memoryCache.set(cacheKey, {
                data: freshData,
                timestamp: Date.now(),
                cacheControl: freshCacheControl,
                expiresAt: freshExpiresAt,
              });
            }
          } catch (error) {
            // Silently fail revalidation - we already returned stale data
            console.warn('[cachedFetch] Background revalidation failed:', error);
          }
        })();
      }
    }
  }
  
  return data as T;
}

/**
 * Clear all cached entries
 */
export function clearCache(): void {
  memoryCache.clear();
}

/**
 * Clear cached entry for specific URL
 */
export function clearCacheEntry(url: string, options: RequestInit = {}): void {
  const cacheKey = `${url}:${JSON.stringify(options)}`;
  memoryCache.delete(cacheKey);
}

