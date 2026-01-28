/**
 * Performance Monitoring Module
 *
 * Exports metrics collection, alert management, and types.
 */

// Types
export type {
  ConversionMetrics,
  SyncMetrics,
  ApiMetrics,
  CacheMetrics,
  ResourceMetrics,
  PerformanceAlert,
  AlertType,
  AlertSeverity,
  PerformanceThresholds,
  TimeRange,
  DashboardMetrics,
  MetricTrend,
  PerformanceReport,
} from './types';

// Alert Manager
export {
  AlertManager,
  createAlertManager,
  globalAlertManager,
} from './alert-manager';

// Metrics Collector
export {
  MetricsCollector,
  globalMetricsCollector,
} from './metrics-collector';
