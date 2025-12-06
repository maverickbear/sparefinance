/**
 * Cache Headers Helper
 * Provides cache control headers for different data types
 */

export type CacheType = 'static' | 'semi-static' | 'dynamic' | 'computed';

/**
 * Get appropriate cache headers based on data type
 * 
 * @param type - Type of data being cached
 * @returns Cache-Control header configuration
 */
export function getCacheHeaders(type: CacheType): Record<string, string> {
  const configs: Record<CacheType, Record<string, string>> = {
    static: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
    },
    'semi-static': {
      'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=300',
    },
    dynamic: {
      'Cache-Control': 'private, s-maxage=10, stale-while-revalidate=30',
    },
    computed: {
      'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=600',
    },
  };
  
  return configs[type];
}

