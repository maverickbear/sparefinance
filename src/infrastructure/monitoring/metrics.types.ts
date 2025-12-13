/**
 * Metrics Types
 * Type definitions for metrics and monitoring
 */

export type MetricType = 'counter' | 'histogram' | 'gauge' | 'timer';

export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  labels?: Record<string, string>;
  timestamp?: Date;
}

export interface CounterMetric extends Metric {
  type: 'counter';
  increment: number;
}

export interface HistogramMetric extends Metric {
  type: 'histogram';
  buckets?: number[];
}

export interface GaugeMetric extends Metric {
  type: 'gauge';
}

export interface TimerMetric extends Metric {
  type: 'timer';
  duration: number; // in milliseconds
}

export interface MetricsConfig {
  enabled: boolean;
  flushInterval?: number; // milliseconds
  maxBatchSize?: number;
  endpoint?: string; // External metrics endpoint (e.g., Datadog, Prometheus)
}

