/**
 * Performance Monitoring Types
 *
 * Defines types for tracking and monitoring system performance metrics.
 */

// ============================================================================
// Core Metric Types
// ============================================================================

/**
 * Conversion performance metrics
 */
export interface ConversionMetrics {
  /** Total conversion time in ms */
  totalTime: number;
  /** Time spent fetching from Google Docs API */
  fetchTime: number;
  /** Time spent parsing document structure */
  parseTime: number;
  /** Time spent processing content */
  processTime: number;
  /** Time spent uploading images */
  imageUploadTime: number;
  /** Time spent formatting markdown */
  formatTime: number;
  /** Time spent validating output */
  validateTime: number;
  /** Whether result was retrieved from cache */
  cached: boolean;
  /** Document size in characters */
  documentSize: number;
  /** Number of paragraphs processed */
  paragraphCount: number;
  /** Number of tables processed */
  tableCount: number;
  /** Number of images processed */
  imageCount: number;
  /** Number of code blocks detected */
  codeBlockCount: number;
}

/**
 * Sync operation metrics
 */
export interface SyncMetrics {
  /** Total sync time in ms */
  totalTime: number;
  /** Time spent fetching Google Doc */
  fetchTime: number;
  /** Time spent converting to markdown */
  convertTime: number;
  /** Time spent uploading images */
  imageUploadTime: number;
  /** Time spent creating GitHub branch */
  branchTime: number;
  /** Time spent committing files */
  commitTime: number;
  /** Time spent creating PR */
  prTime: number;
  /** Number of files changed */
  filesChanged: number;
  /** Whether sync was successful */
  success: boolean;
  /** Error message if failed */
  errorMessage?: string;
}

/**
 * API response metrics
 */
export interface ApiMetrics {
  /** API endpoint called */
  endpoint: string;
  /** HTTP method */
  method: string;
  /** Response time in ms */
  responseTime: number;
  /** HTTP status code */
  statusCode: number;
  /** Whether request was successful */
  success: boolean;
  /** Error type if failed */
  errorType?: string;
}

/**
 * Cache performance metrics
 */
export interface CacheMetrics {
  /** Cache hit rate (0-1) */
  hitRate: number;
  /** Number of hits */
  hits: number;
  /** Number of misses */
  misses: number;
  /** Number of entries stored */
  size: number;
  /** Memory usage in bytes */
  memoryUsage: number;
  /** Number of evictions */
  evictions: number;
  /** Timestamp of measurement */
  timestamp?: number;
}

/**
 * System resource metrics
 */
export interface ResourceMetrics {
  /** Memory usage in MB */
  memoryUsage: number;
  /** CPU usage percentage */
  cpuUsage: number;
  /** Timestamp of measurement */
  timestamp: number;
}

// ============================================================================
// Alert Types
// ============================================================================

/**
 * Performance alert types
 */
export type AlertType =
  | 'slow_conversion'
  | 'high_error_rate'
  | 'low_cache_hit_rate'
  | 'high_memory_usage'
  | 'api_timeout'
  | 'sync_failure';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Performance alert
 */
export interface PerformanceAlert {
  /** Alert ID */
  id: string;
  /** Alert type */
  type: AlertType;
  /** Alert severity */
  severity: AlertSeverity;
  /** Alert message */
  message: string;
  /** Alert details */
  details: Record<string, any>;
  /** Timestamp when alert was triggered */
  triggeredAt: number;
  /** Whether alert has been acknowledged */
  acknowledged: boolean;
  /** Timestamp when alert was acknowledged */
  acknowledgedAt?: number;
}

// ============================================================================
// Threshold Types
// ============================================================================

/**
 * Performance thresholds for alerts
 */
export interface PerformanceThresholds {
  /** Maximum conversion time in ms (default: 30000 = 30 seconds) */
  maxConversionTime: number;
  /** Maximum sync time in ms (default: 60000 = 60 seconds) */
  maxSyncTime: number;
  /** Maximum API response time in ms (default: 10000 = 10 seconds) */
  maxApiResponseTime: number;
  /** Minimum cache hit rate (0-1, default: 0.3) */
  minCacheHitRate: number;
  /** Maximum error rate (0-1, default: 0.1) */
  maxErrorRate: number;
  /** Maximum memory usage in MB (default: 500) */
  maxMemoryUsage: number;
}

// ============================================================================
// Dashboard Types
// ============================================================================

/**
 * Time range for metrics aggregation
 */
export type TimeRange = '1h' | '24h' | '7d' | '30d' | 'all';

/**
 * Aggregated metrics for dashboard
 */
export interface DashboardMetrics {
  /** Time range */
  timeRange: TimeRange;
  /** Conversion metrics */
  conversions: {
    total: number;
    successful: number;
    failed: number;
    avgTime: number;
    p95Time: number;
    p99Time: number;
  };
  /** Sync metrics */
  syncs: {
    total: number;
    successful: number;
    failed: number;
    avgTime: number;
    successRate: number;
  };
  /** Cache metrics */
  cache: {
    hitRate: number;
    hits: number;
    misses: number;
    size: number;
    memoryUsage: number;
  };
  /** API metrics */
  api: {
    total: number;
    avgResponseTime: number;
    errorRate: number;
  };
  /** Active alerts */
  alerts: {
    total: number;
    critical: number;
    warning: number;
    unacknowledged: number;
  };
  /** Resource metrics */
  resources: {
    avgMemoryUsage: number;
    peakMemoryUsage: number;
  };
}

/**
 * Metric trend data point
 */
export interface MetricTrend {
  /** Timestamp */
  timestamp: number;
  /** Metric value */
  value: number;
  /** Label for display */
  label: string;
}

/**
 * Performance report for a specific operation
 */
export interface PerformanceReport {
  /** Operation ID */
  operationId: string;
  /** Operation type */
  operationType: 'conversion' | 'sync' | 'api';
  /** Start timestamp */
  startedAt: number;
  /** End timestamp */
  completedAt: number;
  /** Duration in ms */
  duration: number;
  /** Whether operation was successful */
  success: boolean;
  /** Detailed metrics */
  metrics: ConversionMetrics | SyncMetrics | ApiMetrics;
  /** Additional metadata */
  metadata: Record<string, any>;
}
