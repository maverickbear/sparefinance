/**
 * Metrics Service
 * Collects and reports application metrics for monitoring
 */

import { logger } from "@/src/infrastructure/utils/logger";
import { structuredLogger } from "@/src/infrastructure/utils/structured-logger";
import type {
  Metric,
  CounterMetric,
  HistogramMetric,
  GaugeMetric,
  TimerMetric,
  MetricsConfig,
} from "./metrics.types";

class MetricsService {
  private metrics: Metric[] = [];
  private config: MetricsConfig;
  private flushIntervalId: NodeJS.Timeout | null = null;

  constructor(config?: Partial<MetricsConfig>) {
    this.config = {
      enabled: process.env.NODE_ENV === "production" || config?.enabled === true,
      flushInterval: config?.flushInterval || 60000, // 1 minute default
      maxBatchSize: config?.maxBatchSize || 100,
      endpoint: config?.endpoint || process.env.METRICS_ENDPOINT,
    };

    if (this.config.enabled && this.config.flushInterval) {
      this.startFlushInterval();
    }
  }

  /**
   * Increment a counter metric
   */
  increment(name: string, value: number = 1, labels?: Record<string, string>): void {
    if (!this.config.enabled) return;

    const metric: CounterMetric = {
      name,
      type: 'counter',
      value: value,
      increment: value,
      labels,
      timestamp: new Date(),
    };

    this.addMetric(metric);
  }

  /**
   * Record a histogram value
   */
  histogram(name: string, value: number, labels?: Record<string, string>): void {
    if (!this.config.enabled) return;

    const metric: HistogramMetric = {
      name,
      type: 'histogram',
      value,
      labels,
      timestamp: new Date(),
    };

    this.addMetric(metric);
  }

  /**
   * Set a gauge value
   */
  gauge(name: string, value: number, labels?: Record<string, string>): void {
    if (!this.config.enabled) return;

    const metric: GaugeMetric = {
      name,
      type: 'gauge',
      value,
      labels,
      timestamp: new Date(),
    };

    this.addMetric(metric);
  }

  /**
   * Start a timer and return a function to stop it
   */
  timer(name: string, labels?: Record<string, string>): () => void {
    if (!this.config.enabled) {
      return () => {}; // No-op if disabled
    }

    const startTime = Date.now();

    return () => {
      const duration = Date.now() - startTime;
      const metric: TimerMetric = {
        name,
        type: 'timer',
        value: duration,
        duration,
        labels,
        timestamp: new Date(),
      };

      this.addMetric(metric);
    };
  }

  /**
   * Add metric to queue
   */
  private addMetric(metric: Metric): void {
    this.metrics.push(metric);

    // Flush if batch size reached
    if (this.config.maxBatchSize && this.metrics.length >= this.config.maxBatchSize) {
      this.flush();
    }
  }

  /**
   * Flush metrics to external service or log
   */
  async flush(): Promise<void> {
    if (this.metrics.length === 0) return;

    const metricsToFlush = [...this.metrics];
    this.metrics = [];

    try {
      if (this.config.endpoint) {
        // Send to external metrics service
        await this.sendToExternalService(metricsToFlush);
      } else {
        // Log metrics (for development or when no external service configured)
        this.logMetrics(metricsToFlush);
      }
    } catch (error) {
      logger.error("[MetricsService] Error flushing metrics:", error);
      // Re-add metrics to queue if flush failed (up to a limit)
      if (this.metrics.length < 1000) {
        this.metrics.unshift(...metricsToFlush);
      }
    }
  }

  /**
   * Send metrics to external service
   */
  private async sendToExternalService(metrics: Metric[]): Promise<void> {
    if (!this.config.endpoint) return;

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metrics }),
      });

      if (!response.ok) {
        throw new Error(`Metrics endpoint returned ${response.status}`);
      }
    } catch (error) {
      logger.error("[MetricsService] Error sending metrics to external service:", error);
      throw error;
    }
  }

  /**
   * Log metrics (for development)
   */
  private logMetrics(metrics: Metric[]): void {
    structuredLogger.info("Metrics flushed", {
      count: metrics.length,
      metrics: metrics.map(m => ({
        name: m.name,
        type: m.type,
        value: m.value,
        labels: m.labels,
      })),
    });
  }

  /**
   * Start automatic flush interval
   */
  private startFlushInterval(): void {
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
    }

    this.flushIntervalId = setInterval(() => {
      this.flush().catch(error => {
        logger.error("[MetricsService] Error in flush interval:", error);
      });
    }, this.config.flushInterval);
  }

  /**
   * Stop flush interval
   */
  stop(): void {
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }
    // Flush remaining metrics
    this.flush();
  }
}

// Singleton instance
let metricsServiceInstance: MetricsService | null = null;

/**
 * Get or create metrics service instance
 */
export function getMetricsService(): MetricsService {
  if (!metricsServiceInstance) {
    metricsServiceInstance = new MetricsService();
  }
  return metricsServiceInstance;
}

/**
 * Helper functions for common metrics
 */
export const metrics = {
  /**
   * Track API request
   */
  trackApiRequest(path: string, method: string, duration: number, statusCode: number): void {
    const service = getMetricsService();
    service.histogram('api.request.duration', duration, { path, method, status: statusCode.toString() });
    service.increment('api.request.count', 1, { path, method, status: statusCode.toString() });
    
    if (statusCode >= 400) {
      service.increment('api.error.count', 1, { path, method, status: statusCode.toString() });
    }
  },

  /**
   * Track authentication events
   */
  trackAuthEvent(event: 'signup' | 'signin' | 'signout' | 'password_reset', success: boolean): void {
    const service = getMetricsService();
    const status = success ? 'success' : 'failure';
    service.increment(`auth.${event}.${status}`, 1);
  },

  /**
   * Track business events
   */
  trackBusinessEvent(event: string, value: number = 1, labels?: Record<string, string>): void {
    const service = getMetricsService();
    service.increment(`business.${event}`, value, labels);
  },

  /**
   * Track performance metric
   */
  trackPerformance(operation: string, duration: number, labels?: Record<string, string>): void {
    const service = getMetricsService();
    service.histogram(`performance.${operation}`, duration, labels);
  },
};

