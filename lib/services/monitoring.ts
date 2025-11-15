/**
 * Monitoring and Observability Service
 * Centralized monitoring utilities for error tracking, metrics, and logging
 */

import { logger } from '@/lib/utils/logger';

/**
 * Performance metrics
 */
interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count';
  tags?: Record<string, string>;
  timestamp?: Date;
}

/**
 * Track performance metric
 */
export function trackMetric(metric: PerformanceMetric): void {
  const timestamp = metric.timestamp || new Date();
  
  // Log metric
  logger.info('[METRIC]', {
    name: metric.name,
    value: metric.value,
    unit: metric.unit,
    tags: metric.tags,
    timestamp: timestamp.toISOString(),
  });

  // In production, send to monitoring service (e.g., Datadog, New Relic)
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to external monitoring service
    // Example: await sendToMonitoringService(metric);
  }
}

/**
 * Track API request performance
 */
export function trackApiRequest(
  path: string,
  method: string,
  duration: number,
  statusCode: number,
  userId?: string
): void {
  trackMetric({
    name: 'api.request',
    value: duration,
    unit: 'ms',
    tags: {
      path,
      method,
      statusCode: statusCode.toString(),
      ...(userId && { userId }),
    },
  });
}

/**
 * Track database query performance
 */
export function trackDbQuery(
  query: string,
  duration: number,
  success: boolean
): void {
  trackMetric({
    name: 'db.query',
    value: duration,
    unit: 'ms',
    tags: {
      query: query.substring(0, 50), // Truncate long queries
      success: success.toString(),
    },
  });
}

/**
 * Track cache operations
 */
export function trackCacheOperation(
  operation: 'hit' | 'miss' | 'set' | 'delete',
  key: string,
  duration?: number
): void {
  trackMetric({
    name: 'cache.operation',
    value: duration || 0,
    unit: 'ms',
    tags: {
      operation,
      key: key.substring(0, 50), // Truncate long keys
    },
  });
}

/**
 * Track business metrics
 */
export function trackBusinessMetric(
  name: string,
  value: number,
  tags?: Record<string, string>
): void {
  trackMetric({
    name: `business.${name}`,
    value,
    unit: 'count',
    tags,
  });
}

/**
 * Performance timer utility
 */
export class PerformanceTimer {
  private startTime: number;
  private name: string;
  private tags?: Record<string, string>;

  constructor(name: string, tags?: Record<string, string>) {
    this.name = name;
    this.tags = tags;
    this.startTime = performance.now();
  }

  /**
   * End timer and track metric
   */
  end(): number {
    const duration = performance.now() - this.startTime;
    trackMetric({
      name: this.name,
      value: duration,
      unit: 'ms',
      tags: this.tags,
    });
    return duration;
  }

  /**
   * Get elapsed time without ending timer
   */
  elapsed(): number {
    return performance.now() - this.startTime;
  }
}

/**
 * Create performance timer
 */
export function startTimer(name: string, tags?: Record<string, string>): PerformanceTimer {
  return new PerformanceTimer(name, tags);
}

/**
 * Health check data
 */
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: boolean;
    redis?: boolean;
    externalApis?: {
      plaid?: boolean;
      stripe?: boolean;
      questrade?: boolean;
    };
  };
  timestamp: Date;
}

/**
 * Perform health check
 */
export async function performHealthCheck(): Promise<HealthCheckResult> {
  const checks: HealthCheckResult['checks'] = {
    database: false,
    redis: undefined,
    externalApis: {},
  };

  // Check database
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = createClient();
    const { error } = await supabase.from('User').select('id').limit(1);
    checks.database = !error;
  } catch (error) {
    logger.error('[HealthCheck] Database check failed:', error);
  }

  // Check Redis
  try {
    const { getRedisClient } = await import('@/lib/services/redis');
    const client = getRedisClient();
    if (client) {
      await client.ping();
      checks.redis = true;
    }
  } catch (error) {
    logger.error('[HealthCheck] Redis check failed:', error);
    checks.redis = false;
  }

  // Determine overall status
  const hasCriticalFailure = !checks.database;
  const hasDegradedService = checks.redis === false;
  
  const status: HealthCheckResult['status'] = hasCriticalFailure
    ? 'unhealthy'
    : hasDegradedService
    ? 'degraded'
    : 'healthy';

  return {
    status,
    checks,
    timestamp: new Date(),
  };
}

