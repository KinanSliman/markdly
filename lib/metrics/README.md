# Performance Monitoring Module

A comprehensive performance monitoring system for Markdly that tracks conversion times, sync operations, API response times, cache performance, and system resources with real-time alerting.

## Features

- **Real-time Metrics Collection**: Track conversion, sync, API, cache, and resource metrics
- **Alert Management**: Automatic threshold-based alerts with severity levels
- **Dashboard Integration**: Admin dashboard for visualizing performance data
- **Trend Analysis**: Historical data for identifying performance patterns
- **Alert Acknowledgment**: Track and acknowledge performance issues

## Architecture

### Components

1. **Types** (`types.ts`)
   - `ConversionMetrics`: Conversion operation metrics
   - `SyncMetrics`: Sync operation metrics
   - `ApiMetrics`: API response metrics
   - `CacheMetrics`: Cache performance metrics
   - `ResourceMetrics`: System resource metrics
   - `PerformanceAlert`: Alert with severity and details
   - `DashboardMetrics`: Aggregated metrics for dashboard

2. **Alert Manager** (`alert-manager.ts`)
   - Manages performance alerts with configurable thresholds
   - Supports multiple severity levels (info, warning, critical)
   - Event listeners for real-time alert notifications
   - Alert acknowledgment and deletion

3. **Metrics Collector** (`metrics-collector.ts`)
   - Collects and stores performance metrics
   - Aggregates data for dashboard display
   - Generates metric trends for charting
   - Integrates with alert manager for threshold checking

## Usage

### Recording Metrics

```typescript
import { globalMetricsCollector } from '@/lib/metrics';

// Record conversion metrics
globalMetricsCollector.recordConversion({
  totalTime: 1500,
  fetchTime: 500,
  parseTime: 200,
  processTime: 600,
  imageUploadTime: 100,
  formatTime: 50,
  validateTime: 50,
  cached: false,
  documentSize: 5000,
  paragraphCount: 20,
  tableCount: 2,
  imageCount: 3,
  codeBlockCount: 5,
}, { docId: '123abc', userId: 'user-456' });

// Record sync metrics
globalMetricsCollector.recordSync({
  totalTime: 5000,
  fetchTime: 800,
  convertTime: 1500,
  imageUploadTime: 1000,
  branchTime: 500,
  commitTime: 1000,
  prTime: 200,
  filesChanged: 1,
  success: true,
}, { syncConfigId: 'config-123', docTitle: 'My Document' });

// Record API metrics
globalMetricsCollector.recordApi({
  endpoint: '/api/convert-demo',
  method: 'POST',
  responseTime: 1200,
  statusCode: 200,
  success: true,
});

// Record cache metrics
globalMetricsCollector.recordCache({
  hitRate: 0.75,
  hits: 150,
  misses: 50,
  size: 100,
  memoryUsage: 5242880, // 5MB
});

// Record resource metrics
globalMetricsCollector.recordResources({
  memoryUsage: 256, // MB
  cpuUsage: 45, // %
  timestamp: Date.now(),
});
```

### Getting Metrics

```typescript
import { globalMetricsCollector } from '@/lib/metrics';

// Get dashboard metrics for 24h
const metrics = globalMetricsCollector.getDashboardMetrics('24h');

console.log(metrics.conversions.avgTime); // Average conversion time
console.log(metrics.syncs.successRate);   // Sync success rate
console.log(metrics.cache.hitRate);       // Cache hit rate
console.log(metrics.alerts.critical);     // Number of critical alerts

// Get metric trends for charting
const trends = globalMetricsCollector.getMetricTrends(
  'conversion_time',
  '24h',
  60 // interval in minutes
);
```

### Alert Management

```typescript
import { globalAlertManager } from '@/lib/metrics';

// Check thresholds (automatically called by metrics collector)
const alert = globalAlertManager.checkConversionTime(35000);
if (alert) {
  console.warn(`Alert: ${alert.message}`);
}

// Get all alerts
const alerts = globalAlertManager.getAlerts();

// Get unacknowledged alerts
const unacked = globalAlertManager.getUnacknowledgedAlerts();

// Get alerts by severity
const criticalAlerts = globalAlertManager.getAlertsBySeverity('critical');

// Acknowledge an alert
globalAlertManager.acknowledgeAlert(alertId);

// Delete an alert
globalAlertManager.deleteAlert(alertId);

// Update thresholds
globalAlertManager.updateThresholds({
  maxConversionTime: 45000, // 45 seconds
  minCacheHitRate: 0.5,     // 50%
});
```

### Event Listeners

```typescript
import { globalAlertManager } from '@/lib/metrics';

// Listen for new alerts
globalAlertManager.onAlert((alert) => {
  console.log(`New ${alert.severity} alert: ${alert.message}`);

  // Send notification (email, Slack, etc.)
  if (alert.severity === 'critical') {
    sendCriticalAlert(alert);
  }
});
```

## Alert Thresholds

Default thresholds (configurable):

| Threshold | Default Value | Description |
|-----------|---------------|-------------|
| `maxConversionTime` | 30000ms (30s) | Maximum conversion time before alert |
| `maxSyncTime` | 60000ms (60s) | Maximum sync time before alert |
| `maxApiResponseTime` | 10000ms (10s) | Maximum API response time before alert |
| `minCacheHitRate` | 0.3 (30%) | Minimum cache hit rate before alert |
| `maxErrorRate` | 0.1 (10%) | Maximum error rate before alert |
| `maxMemoryUsage` | 500MB | Maximum memory usage before alert |

## Alert Types

| Type | Severity | Trigger Condition |
|------|----------|-------------------|
| `slow_conversion` | warning/critical | Conversion time exceeds threshold |
| `slow_sync` | critical | Sync time exceeds threshold |
| `api_timeout` | warning | API response time exceeds threshold |
| `low_cache_hit_rate` | warning | Cache hit rate below threshold |
| `high_error_rate` | critical | Error rate exceeds threshold |
| `high_memory_usage` | warning | Memory usage exceeds threshold |
| `sync_failure` | critical | Sync operation fails |

## Admin Dashboard

### Performance Dashboard (`/admin/performance`)

- **Key Metrics Cards**: Conversions, Syncs, Cache, API
- **Performance Charts**: Conversion and sync time trends
- **Alert Summary**: Critical, Warning, Info counts
- **Resource Metrics**: Memory usage, storage stats
- **Thresholds Display**: Current alert thresholds

### Alerts Page (`/admin/performance/alerts`)

- **Alert List**: All alerts with severity indicators
- **Alert Details**: Full context and metadata
- **Acknowledge Alerts**: Mark alerts as resolved
- **Delete Alerts**: Remove old alerts
- **Threshold Configuration**: View current thresholds

## Database Schema

### performance_metrics Table

```sql
CREATE TABLE performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  operation_type TEXT NOT NULL, -- 'conversion', 'sync', 'api'
  operation_id TEXT,
  duration INTEGER NOT NULL, -- milliseconds
  success BOOLEAN NOT NULL,
  error_message TEXT,
  metrics JSONB, -- Detailed metrics
  metadata JSONB, -- Additional context
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### performance_alerts Table

```sql
CREATE TABLE performance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL, -- 'info', 'warning', 'critical'
  message TEXT NOT NULL,
  details JSONB,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMP,
  triggered_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## Integration Points

### Pipeline Orchestrator

Metrics are automatically collected during pipeline execution:

```typescript
// In lib/markdown/pipeline/orchestrator.ts
import { globalMetricsCollector } from '@/lib/metrics';

// After pipeline completes
globalMetricsCollector.recordConversion({
  totalTime: context.metrics.totalTime,
  fetchTime: context.metrics.fetchTime,
  // ... other metrics
});
```

### Sync Engine

Sync operations are tracked:

```typescript
// In sync execution
import { globalMetricsCollector } from '@/lib/metrics';

globalMetricsCollector.recordSync({
  totalTime: syncDuration,
  success: true,
  // ... other metrics
});
```

### API Endpoints

API response times are tracked:

```typescript
// In API route handlers
import { globalMetricsCollector } from '@/lib/metrics';

const startTime = performance.now();
// ... handle request
const responseTime = performance.now() - startTime;

globalMetricsCollector.recordApi({
  endpoint: req.url,
  method: req.method,
  responseTime,
  statusCode: res.status,
  success: res.status < 400,
});
```

### Cache System

Cache performance is tracked:

```typescript
// In cache manager
import { globalMetricsCollector } from '@/lib/metrics';

const stats = await cache.stats();
globalMetricsCollector.recordCache(stats);
```

## Performance Considerations

- **In-Memory Storage**: Metrics are stored in memory by default (10,000 entries max)
- **Automatic Cleanup**: Old entries are automatically trimmed
- **Non-Blocking**: All metric recording is non-blocking
- **Lazy Evaluation**: Trends are calculated on-demand

## Future Enhancements

- **Persistent Storage**: Store metrics in database for long-term retention
- **Export Functionality**: Export metrics to CSV/JSON
- **Real-time WebSocket**: Push alerts to admin dashboard via WebSocket
- **Email Notifications**: Send email alerts for critical issues
- **Integration with Monitoring Tools**: Prometheus, Grafana, etc.
- **Custom Thresholds per User**: Allow users to set their own thresholds
