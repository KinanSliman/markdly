/**
 * Performance Alert Manager
 *
 * Manages performance alerts and threshold monitoring.
 */

import type { PerformanceAlert, AlertType, AlertSeverity, PerformanceThresholds } from './types';

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  maxConversionTime: 30000, // 30 seconds
  maxSyncTime: 60000, // 60 seconds
  maxApiResponseTime: 10000, // 10 seconds
  minCacheHitRate: 0.3, // 30%
  maxErrorRate: 0.1, // 10%
  maxMemoryUsage: 500, // 500 MB
};

export class AlertManager {
  private alerts: Map<string, PerformanceAlert> = new Map();
  private thresholds: PerformanceThresholds;
  private listeners: Array<(alert: PerformanceAlert) => void> = [];

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * Check conversion time threshold
   */
  checkConversionTime(timeMs: number): PerformanceAlert | null {
    if (timeMs > this.thresholds.maxConversionTime) {
      return this.createAlert(
        'slow_conversion',
        'warning',
        `Conversion took ${timeMs.toFixed(0)}ms (threshold: ${this.thresholds.maxConversionTime}ms)`,
        { timeMs, threshold: this.thresholds.maxConversionTime }
      );
    }
    return null;
  }

  /**
   * Check sync time threshold
   */
  checkSyncTime(timeMs: number): PerformanceAlert | null {
    if (timeMs > this.thresholds.maxSyncTime) {
      return this.createAlert(
        'slow_conversion',
        'critical',
        `Sync took ${timeMs.toFixed(0)}ms (threshold: ${this.thresholds.maxSyncTime}ms)`,
        { timeMs, threshold: this.thresholds.maxSyncTime }
      );
    }
    return null;
  }

  /**
   * Check API response time threshold
   */
  checkApiResponseTime(timeMs: number): PerformanceAlert | null {
    if (timeMs > this.thresholds.maxApiResponseTime) {
      return this.createAlert(
        'api_timeout',
        'warning',
        `API response took ${timeMs.toFixed(0)}ms (threshold: ${this.thresholds.maxApiResponseTime}ms)`,
        { timeMs, threshold: this.thresholds.maxApiResponseTime }
      );
    }
    return null;
  }

  /**
   * Check cache hit rate threshold
   */
  checkCacheHitRate(hitRate: number): PerformanceAlert | null {
    if (hitRate < this.thresholds.minCacheHitRate) {
      return this.createAlert(
        'low_cache_hit_rate',
        'warning',
        `Cache hit rate is ${(hitRate * 100).toFixed(1)}% (threshold: ${(this.thresholds.minCacheHitRate * 100)}%)`,
        { hitRate, threshold: this.thresholds.minCacheHitRate }
      );
    }
    return null;
  }

  /**
   * Check error rate threshold
   */
  checkErrorRate(errorRate: number, totalRequests: number): PerformanceAlert | null {
    if (errorRate > this.thresholds.maxErrorRate && totalRequests > 10) {
      return this.createAlert(
        'high_error_rate',
        'critical',
        `Error rate is ${(errorRate * 100).toFixed(1)}% (threshold: ${(this.thresholds.maxErrorRate * 100)}%)`,
        { errorRate, threshold: this.thresholds.maxErrorRate, totalRequests }
      );
    }
    return null;
  }

  /**
   * Check memory usage threshold
   */
  checkMemoryUsage(memoryUsageMb: number): PerformanceAlert | null {
    if (memoryUsageMb > this.thresholds.maxMemoryUsage) {
      return this.createAlert(
        'high_memory_usage',
        'warning',
        `Memory usage is ${memoryUsageMb.toFixed(1)}MB (threshold: ${this.thresholds.maxMemoryUsage}MB)`,
        { memoryUsageMb, threshold: this.thresholds.maxMemoryUsage }
      );
    }
    return null;
  }

  /**
   * Check sync failure
   */
  checkSyncFailure(errorMessage: string): PerformanceAlert {
    return this.createAlert(
      'sync_failure',
      'critical',
      `Sync failed: ${errorMessage}`,
      { errorMessage }
    );
  }

  /**
   * Create and store an alert
   */
  private createAlert(
    type: AlertType,
    severity: AlertSeverity,
    message: string,
    details: Record<string, any>
  ): PerformanceAlert {
    const alert: PerformanceAlert = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      type,
      severity,
      message,
      details,
      triggeredAt: Date.now(),
      acknowledged: false,
    };

    this.alerts.set(alert.id, alert);
    this.notifyListeners(alert);

    return alert;
  }

  /**
   * Get all alerts
   */
  getAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values()).sort((a, b) => b.triggeredAt - a.triggeredAt);
  }

  /**
   * Get unacknowledged alerts
   */
  getUnacknowledgedAlerts(): PerformanceAlert[] {
    return this.getAlerts().filter(alert => !alert.acknowledged);
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: AlertSeverity): PerformanceAlert[] {
    return this.getAlerts().filter(alert => alert.severity === severity);
  }

  /**
   * Get alerts by type
   */
  getAlertsByType(type: AlertType): PerformanceAlert[] {
    return this.getAlerts().filter(alert => alert.type === type);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = Date.now();
      this.alerts.set(alertId, alert);
      return true;
    }
    return false;
  }

  /**
   * Delete an alert
   */
  deleteAlert(alertId: string): boolean {
    return this.alerts.delete(alertId);
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts.clear();
  }

  /**
   * Get alert count by severity
   */
  getAlertCounts(): Record<AlertSeverity, number> {
    const counts: Record<AlertSeverity, number> = { info: 0, warning: 0, critical: 0 };
    for (const alert of this.alerts.values()) {
      if (!alert.acknowledged) {
        counts[alert.severity]++;
      }
    }
    return counts;
  }

  /**
   * Update thresholds
   */
  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  /**
   * Get current thresholds
   */
  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  /**
   * Add event listener for new alerts
   */
  onAlert(callback: (alert: PerformanceAlert) => void): void {
    this.listeners.push(callback);
  }

  /**
   * Remove event listener
   */
  offAlert(callback: (alert: PerformanceAlert) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners about a new alert
   */
  private notifyListeners(alert: PerformanceAlert): void {
    for (const listener of this.listeners) {
      try {
        listener(alert);
      } catch (error) {
        console.error('Error in alert listener:', error);
      }
    }
  }
}

/**
 * Create a new alert manager instance
 */
export function createAlertManager(
  thresholds?: Partial<PerformanceThresholds>
): AlertManager {
  return new AlertManager(thresholds);
}

/**
 * Global alert manager instance
 */
export const globalAlertManager = createAlertManager();
