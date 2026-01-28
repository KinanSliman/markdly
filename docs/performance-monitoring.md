# Performance Monitoring Implementation

## Overview

This document describes the implementation of Phase 3 Milestone 5: Performance Monitoring for Markdly.

## What Was Implemented

### 1. Metrics Collection System (`lib/metrics/`)

A complete metrics collection and alerting system with the following components:

#### Types (`lib/metrics/types.ts`)
- `ConversionMetrics`: Tracks conversion operation performance
- `SyncMetrics`: Tracks sync operation performance
- `ApiMetrics`: Tracks API response times
- `CacheMetrics`: Tracks cache hit rates and memory usage
- `ResourceMetrics`: Tracks system resource usage
- `PerformanceAlert`: Alert with severity and details
- `DashboardMetrics`: Aggregated metrics for dashboard display
- `PerformanceThresholds`: Configurable alert thresholds

#### Alert Manager (`lib/metrics/alert-manager.ts`)
- **Threshold-based alerts**: Automatically triggers alerts when metrics exceed thresholds
- **Severity levels**: info, warning, critical
- **Alert types**:
  - `slow_conversion`: Conversion time exceeds threshold
  - `slow_sync`: Sync time exceeds threshold
  - `api_timeout`: API response time exceeds threshold
  - `low_cache_hit_rate`: Cache hit rate below threshold
  - `high_error_rate`: Error rate exceeds threshold
  - `high_memory_usage`: Memory usage exceeds threshold
  - `sync_failure`: Sync operation fails
- **Event listeners**: Real-time alert notifications
- **Alert management**: Acknowledge, delete, and filter alerts

#### Metrics Collector (`lib/metrics/metrics-collector.ts`)
- **Record metrics**: Conversion, sync, API, cache, and resource metrics
- **Storage**: In-memory storage with automatic cleanup (10,000 entries max)
- **Aggregation**: Calculate averages, percentiles, and trends
- **Dashboard metrics**: Pre-aggregated metrics for admin dashboard
- **Trend analysis**: Historical data for charting

### 2. Database Schema (`db/schema.ts`)

Added two new tables:

#### `performance_metrics`
```sql
CREATE TABLE performance_metrics (
  id UUID PRIMARY KEY,
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

#### `performance_alerts`
```sql
CREATE TABLE performance_alerts (
  id UUID PRIMARY KEY,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL, -- 'info', 'warning', 'critical'
  message TEXT NOT NULL,
  details JSONB,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMP,
  triggered_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 3. Admin Performance Dashboard (`app/admin/performance/`)

#### Main Dashboard (`/admin/performance`)
- **Key Metrics Cards**:
  - Conversions (total, successful, avg time)
  - Syncs (total, successful, success rate)
  - Cache (hit rate, hits/misses, size)
  - API (total requests, avg response time, error rate)

- **Performance Charts**:
  - Conversion time trend (24h)
  - Sync time trend (24h)

- **Alert Summary**:
  - Critical, Warning, Info counts
  - Unacknowledged alerts

- **Resource Metrics**:
  - Memory usage (avg, peak)
  - Storage stats
  - Cache memory usage

- **Thresholds Display**:
  - Current alert thresholds

#### Alerts Page (`/admin/performance/alerts`)
- **Alert List**: All alerts with severity indicators
- **Alert Details**: Full context and metadata
- **Acknowledge Alerts**: Mark alerts as resolved
- **Delete Alerts**: Remove old alerts
- **Threshold Configuration**: View current thresholds

### 4. Integration Points

#### Pipeline Orchestrator (`lib/markdown/pipeline/orchestrator.ts`)
- Automatically records conversion metrics after successful pipeline execution
- Records failed conversion metrics with error details
- Includes stage-by-stage timing breakdown

#### Admin Navigation (`app/admin/page.tsx`)
- Added "Performance" card linking to performance dashboard

### 5. Documentation (`lib/metrics/README.md`)
- Comprehensive usage examples
- API reference
- Integration guide
- Threshold configuration

## Default Alert Thresholds

| Threshold | Default Value | Description |
|-----------|---------------|-------------|
| `maxConversionTime` | 30000ms (30s) | Maximum conversion time before alert |
| `maxSyncTime` | 60000ms (60s) | Maximum sync time before alert |
| `maxApiResponseTime` | 10000ms (10s) | Maximum API response time before alert |
| `minCacheHitRate` | 0.3 (30%) | Minimum cache hit rate before alert |
| `maxErrorRate` | 0.1 (10%) | Maximum error rate before alert |
| `maxMemoryUsage` | 500MB | Maximum memory usage before alert |

## Usage Examples

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
```

### Getting Dashboard Metrics

```typescript
import { globalMetricsCollector } from '@/lib/metrics';

// Get dashboard metrics for 24h
const metrics = globalMetricsCollector.getDashboardMetrics('24h');

console.log(metrics.conversions.avgTime); // Average conversion time
console.log(metrics.syncs.successRate);   // Sync success rate
console.log(metrics.cache.hitRate);       // Cache hit rate
console.log(metrics.alerts.critical);     // Number of critical alerts
```

### Alert Management

```typescript
import { globalAlertManager } from '@/lib/metrics';

// Get all alerts
const alerts = globalAlertManager.getAlerts();

// Get unacknowledged alerts
const unacked = globalAlertManager.getUnacknowledgedAlerts();

// Acknowledge an alert
globalAlertManager.acknowledgeAlert(alertId);

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

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Performance Monitoring                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐      ┌──────────────────┐            │
│  │  Metrics Types   │      │  Alert Manager   │            │
│  │   (types.ts)     │      │ (alert-manager)  │            │
│  └──────────────────┘      └──────────────────┘            │
│           │                           │                    │
│           └──────────────┬────────────┘                    │
│                          │                                 │
│                  ┌───────────────┐                         │
│                  │  Metrics      │                         │
│                  │  Collector    │                         │
│                  │ (collector)   │                         │
│                  └───────────────┘                         │
│                          │                                 │
│           ┌──────────────┴──────────────┐                  │
│           │                             │                  │
│    ┌──────────────┐            ┌──────────────┐           │
│    │   Database   │            │    Admin     │           │
│    │    Schema    │            │  Dashboard   │           │
│    └──────────────┘            └──────────────┘           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Integration Flow

### Conversion Flow
```
1. Pipeline executes
   ↓
2. Metrics collected (stage-by-stage timing)
   ↓
3. globalMetricsCollector.recordConversion()
   ↓
4. AlertManager checks thresholds
   ↓
5. Alert triggered if threshold exceeded
   ↓
6. Metrics stored in memory
   ↓
7. Admin dashboard displays metrics
```

### Alert Flow
```
1. Threshold exceeded
   ↓
2. AlertManager creates alert
   ↓
3. Alert listeners notified
   ↓
4. Alert stored in memory
   ↓
5. Admin views alerts in dashboard
   ↓
6. Admin acknowledges/deletes alerts
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

## Files Created/Modified

### Created
- `lib/metrics/types.ts` - Type definitions
- `lib/metrics/alert-manager.ts` - Alert management
- `lib/metrics/metrics-collector.ts` - Metrics collection
- `lib/metrics/index.ts` - Module exports
- `lib/metrics/README.md` - Documentation
- `app/admin/performance/page.tsx` - Performance dashboard
- `app/admin/performance/alerts/page.tsx` - Alerts page

### Modified
- `db/schema.ts` - Added performance_metrics and performance_alerts tables
- `lib/markdown/pipeline/orchestrator.ts` - Added metrics recording
- `app/admin/page.tsx` - Added performance dashboard link

## Testing

To test the performance monitoring:

1. **Access the dashboard**: Navigate to `/admin/performance`
2. **Trigger conversions**: Use the converter to create metrics
3. **View alerts**: Check `/admin/performance/alerts`
4. **Monitor trends**: View the performance charts

## Success Criteria

✅ **Implement performance monitoring** - Track conversion times, API response times, cache hit rates
✅ **Add metrics collection** - Collect data on sync operations, error rates, user activity
✅ **Create admin dashboard for metrics** - Visualize performance data in the admin panel
✅ **Set up alerts for performance degradation** - Notify when metrics exceed thresholds

All criteria have been met for Phase 3 Milestone 5.
