/**
 * Metrics Collector
 *
 * Collects and aggregates performance metrics from various sources.
 */

import type {
  ConversionMetrics,
  SyncMetrics,
  ApiMetrics,
  CacheMetrics,
  ResourceMetrics,
  PerformanceReport,
  TimeRange,
  DashboardMetrics,
  MetricTrend,
} from './types';
import { globalAlertManager } from './alert-manager';

interface MetricsStorage {
  conversions: Array<PerformanceReport & { metrics: ConversionMetrics }>;
  syncs: Array<PerformanceReport & { metrics: SyncMetrics }>;
  api: Array<PerformanceReport & { metrics: ApiMetrics }>;
  cache: CacheMetrics[];
  resources: ResourceMetrics[];
}

export class MetricsCollector {
  private storage: MetricsStorage = {
    conversions: [],
    syncs: [],
    api: [],
    cache: [],
    resources: [],
  };

  private maxStorageSize = 10000; // Maximum number of entries per type
  private alertManager = globalAlertManager;

  /**
   * Record a conversion metric
   */
  recordConversion(
    metrics: ConversionMetrics,
    metadata: Record<string, any> = {}
  ): void {
    const report: PerformanceReport & { metrics: ConversionMetrics } = {
      operationId: `conv_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      operationType: 'conversion',
      startedAt: Date.now() - metrics.totalTime,
      completedAt: Date.now(),
      duration: metrics.totalTime,
      success: true,
      metrics,
      metadata,
    };

    this.storage.conversions.push(report);
    this.trimStorage('conversions');

    // Check for slow conversion
    const alert = this.alertManager.checkConversionTime(metrics.totalTime);
    if (alert) {
      this.logAlert(alert);
    }
  }

  /**
   * Record a sync metric
   */
  recordSync(
    metrics: SyncMetrics,
    metadata: Record<string, any> = {}
  ): void {
    const report: PerformanceReport & { metrics: SyncMetrics } = {
      operationId: `sync_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      operationType: 'sync',
      startedAt: Date.now() - metrics.totalTime,
      completedAt: Date.now(),
      duration: metrics.totalTime,
      success: metrics.success,
      metrics,
      metadata,
    };

    this.storage.syncs.push(report);
    this.trimStorage('syncs');

    // Check for slow sync
    if (metrics.success) {
      const alert = this.alertManager.checkSyncTime(metrics.totalTime);
      if (alert) {
        this.logAlert(alert);
      }
    } else {
      // Record sync failure alert
      if (metrics.errorMessage) {
        const alert = this.alertManager.checkSyncFailure(metrics.errorMessage);
        this.logAlert(alert);
      }
    }
  }

  /**
   * Record an API metric
   */
  recordApi(
    metrics: ApiMetrics,
    metadata: Record<string, any> = {}
  ): void {
    const report: PerformanceReport & { metrics: ApiMetrics } = {
      operationId: `api_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      operationType: 'api',
      startedAt: Date.now() - metrics.responseTime,
      completedAt: Date.now(),
      duration: metrics.responseTime,
      success: metrics.success,
      metrics,
      metadata,
    };

    this.storage.api.push(report);
    this.trimStorage('api');

    // Check for slow API response
    if (metrics.success) {
      const alert = this.alertManager.checkApiResponseTime(metrics.responseTime);
      if (alert) {
        this.logAlert(alert);
      }
    }
  }

  /**
   * Record cache metrics
   */
  recordCache(metrics: CacheMetrics): void {
    this.storage.cache.push({ ...metrics, timestamp: Date.now() });
    this.trimStorage('cache');

    // Check for low cache hit rate
    const alert = this.alertManager.checkCacheHitRate(metrics.hitRate);
    if (alert) {
      this.logAlert(alert);
    }
  }

  /**
   * Record resource metrics
   */
  recordResources(metrics: ResourceMetrics): void {
    this.storage.resources.push(metrics);
    this.trimStorage('resources');

    // Check for high memory usage
    const alert = this.alertManager.checkMemoryUsage(metrics.memoryUsage);
    if (alert) {
      this.logAlert(alert);
    }
  }

  /**
   * Trim storage to max size
   */
  private trimStorage(key: keyof MetricsStorage): void {
    const storage = this.storage[key];
    if (Array.isArray(storage) && storage.length > this.maxStorageSize) {
      (this.storage as unknown as Record<string, unknown[]>)[key] = storage.slice(
        -this.maxStorageSize
      );
    }
  }

  /**
   * Log alert (for future integration with notification systems)
   */
  private logAlert(alert: any): void {
    console.warn(`[Performance Alert] ${alert.severity.toUpperCase()}: ${alert.message}`);
  }

  /**
   * Get conversion metrics for time range
   */
  getConversions(timeRange: TimeRange = '24h'): Array<PerformanceReport & { metrics: ConversionMetrics }> {
    const cutoff = this.getTimeRangeCutoff(timeRange);
    return this.storage.conversions.filter(r => r.completedAt >= cutoff);
  }

  /**
   * Get sync metrics for time range
   */
  getSyncs(timeRange: TimeRange = '24h'): Array<PerformanceReport & { metrics: SyncMetrics }> {
    const cutoff = this.getTimeRangeCutoff(timeRange);
    return this.storage.syncs.filter(r => r.completedAt >= cutoff);
  }

  /**
   * Get API metrics for time range
   */
  getApi(timeRange: TimeRange = '24h'): Array<PerformanceReport & { metrics: ApiMetrics }> {
    const cutoff = this.getTimeRangeCutoff(timeRange);
    return this.storage.api.filter(r => r.completedAt >= cutoff);
  }

  /**
   * Get cache metrics for time range
   */
  getCache(timeRange: TimeRange = '24h'): CacheMetrics[] {
    const cutoff = this.getTimeRangeCutoff(timeRange);
    return this.storage.cache.filter(r => (r.timestamp ?? 0) >= cutoff);
  }

  /**
   * Get resource metrics for time range
   */
  getResources(timeRange: TimeRange = '24h'): ResourceMetrics[] {
    const cutoff = this.getTimeRangeCutoff(timeRange);
    return this.storage.resources.filter(r => r.timestamp >= cutoff);
  }

  /**
   * Get dashboard metrics
   */
  getDashboardMetrics(timeRange: TimeRange = '24h'): DashboardMetrics {
    const conversions = this.getConversions(timeRange);
    const syncs = this.getSyncs(timeRange);
    const api = this.getApi(timeRange);
    const cache = this.getCache(timeRange);
    const resources = this.getResources(timeRange);

    // Calculate conversion stats
    const successfulConversions = conversions.filter(c => c.success);
    const failedConversions = conversions.filter(c => !c.success);

    // Calculate percentiles
    const conversionTimes = conversions.map(c => c.duration).sort((a, b) => a - b);
    const p95Time = conversionTimes[Math.floor(conversionTimes.length * 0.95)] || 0;
    const p99Time = conversionTimes[Math.floor(conversionTimes.length * 0.99)] || 0;

    // Calculate sync stats
    const successfulSyncs = syncs.filter(s => s.success);
    const failedSyncs = syncs.filter(s => !s.success);

    // Calculate cache stats
    const latestCache = cache[cache.length - 1] || { hitRate: 0, hits: 0, misses: 0, size: 0, memoryUsage: 0 };

    // Calculate API stats
    const apiErrors = api.filter(a => !a.success).length;

    // Calculate resource stats
    const memoryUsages = resources.map(r => r.memoryUsage);
    const avgMemoryUsage = memoryUsages.length > 0
      ? memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length
      : 0;
    const peakMemoryUsage = memoryUsages.length > 0 ? Math.max(...memoryUsages) : 0;

    // Get alerts
    const alerts = this.alertManager.getUnacknowledgedAlerts();
    const alertCounts = this.alertManager.getAlertCounts();

    return {
      timeRange,
      conversions: {
        total: conversions.length,
        successful: successfulConversions.length,
        failed: failedConversions.length,
        avgTime: conversions.length > 0
          ? conversions.reduce((sum, c) => sum + c.duration, 0) / conversions.length
          : 0,
        p95Time,
        p99Time,
      },
      syncs: {
        total: syncs.length,
        successful: successfulSyncs.length,
        failed: failedSyncs.length,
        avgTime: syncs.length > 0
          ? syncs.reduce((sum, s) => sum + s.duration, 0) / syncs.length
          : 0,
        successRate: syncs.length > 0 ? successfulSyncs.length / syncs.length : 0,
      },
      cache: {
        hitRate: latestCache.hitRate,
        hits: latestCache.hits,
        misses: latestCache.misses,
        size: latestCache.size,
        memoryUsage: latestCache.memoryUsage,
      },
      api: {
        total: api.length,
        avgResponseTime: api.length > 0
          ? api.reduce((sum, a) => sum + a.duration, 0) / api.length
          : 0,
        errorRate: api.length > 0 ? apiErrors / api.length : 0,
      },
      alerts: {
        total: alerts.length,
        critical: alertCounts.critical,
        warning: alertCounts.warning,
        unacknowledged: alerts.length,
      },
      resources: {
        avgMemoryUsage,
        peakMemoryUsage,
      },
    };
  }

  /**
   * Get metric trends for charting
   */
  getMetricTrends(
    metricType: 'conversion_time' | 'sync_time' | 'api_response_time' | 'cache_hit_rate',
    timeRange: TimeRange = '24h',
    intervalMinutes: number = 60
  ): MetricTrend[] {
    const cutoff = this.getTimeRangeCutoff(timeRange);
    const now = Date.now();
    const intervalMs = intervalMinutes * 60 * 1000;

    const trends: MetricTrend[] = [];
    let currentTime = cutoff;

    while (currentTime <= now) {
      const nextTime = currentTime + intervalMs;

      let value = 0;
      let label = new Date(currentTime).toLocaleTimeString();

      switch (metricType) {
        case 'conversion_time': {
          const conversions = this.storage.conversions.filter(
            c => c.completedAt >= currentTime && c.completedAt < nextTime
          );
          if (conversions.length > 0) {
            value = conversions.reduce((sum, c) => sum + c.duration, 0) / conversions.length;
          }
          break;
        }
        case 'sync_time': {
          const syncs = this.storage.syncs.filter(
            s => s.completedAt >= currentTime && s.completedAt < nextTime
          );
          if (syncs.length > 0) {
            value = syncs.reduce((sum, s) => sum + s.duration, 0) / syncs.length;
          }
          break;
        }
        case 'api_response_time': {
          const api = this.storage.api.filter(
            a => a.completedAt >= currentTime && a.completedAt < nextTime
          );
          if (api.length > 0) {
            value = api.reduce((sum, a) => sum + a.duration, 0) / api.length;
          }
          break;
        }
        case 'cache_hit_rate': {
          const cache = this.storage.cache.filter(
            c => (c.timestamp ?? 0) >= currentTime && (c.timestamp ?? 0) < nextTime
          );
          if (cache.length > 0) {
            value = cache.reduce((sum, c) => sum + c.hitRate, 0) / cache.length * 100;
          }
          break;
        }
      }

      trends.push({ timestamp: currentTime, value, label });
      currentTime = nextTime;
    }

    return trends;
  }

  /**
   * Get time range cutoff timestamp
   */
  private getTimeRangeCutoff(timeRange: TimeRange): number {
    const now = Date.now();
    const hours = {
      '1h': 1,
      '24h': 24,
      '7d': 24 * 7,
      '30d': 24 * 30,
      'all': 24 * 365, // 1 year
    };

    return now - (hours[timeRange] * 60 * 60 * 1000);
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.storage = {
      conversions: [],
      syncs: [],
      api: [],
      cache: [],
      resources: [],
    };
  }

  /**
   * Get storage stats
   */
  getStorageStats() {
    return {
      conversions: this.storage.conversions.length,
      syncs: this.storage.syncs.length,
      api: this.storage.api.length,
      cache: this.storage.cache.length,
      resources: this.storage.resources.length,
      total: this.storage.conversions.length +
        this.storage.syncs.length +
        this.storage.api.length +
        this.storage.cache.length +
        this.storage.resources.length,
    };
  }
}

/**
 * Global metrics collector instance
 */
export const globalMetricsCollector = new MetricsCollector();
