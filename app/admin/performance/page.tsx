import { redirect } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth/admin";
import { globalMetricsCollector, globalAlertManager } from "@/lib/metrics";
import { Button } from "@/components/ui/button";
import {
  Clock,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Database,
  TrendingUp,
  AlertCircle,
  Shield,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default async function AdminPerformancePage() {
  await requireAdmin();

  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin");
  }

  // Get dashboard metrics for 24h
  const metrics = globalMetricsCollector.getDashboardMetrics("24h");
  const alerts = globalAlertManager.getUnacknowledgedAlerts();
  const alertCounts = globalAlertManager.getAlertCounts();

  // Get recent trends
  const conversionTrends = globalMetricsCollector.getMetricTrends(
    "conversion_time",
    "24h",
    60
  );
  const syncTrends = globalMetricsCollector.getMetricTrends(
    "sync_time",
    "24h",
    60
  );

  // Calculate stats
  const storageStats = globalMetricsCollector.getStorageStats();

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Performance Monitoring</h1>
            <p className="text-muted-foreground">
              Real-time metrics and alerts for system performance
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-sm">
              Time Range: 24h
            </Badge>
          </div>
        </div>

        {/* Alert Banner */}
        {alerts.length > 0 && (
          <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900">
                  {alerts.length} Unacknowledged Alert
                  {alerts.length > 1 ? "s" : ""}
                </h3>
                <p className="text-sm text-yellow-800 mt-1">
                  {alerts.slice(0, 2).map((a) => a.message).join(" | ")}
                  {alerts.length > 2 && `... and ${alerts.length - 2} more`}
                </p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link href="/admin/performance/alerts">View Alerts</Link>
              </Button>
            </div>
          </div>
        )}

        {/* Key Metrics Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Conversion Metrics */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversions</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics.conversions.total}
              </div>
              <p className="text-xs text-muted-foreground">
                {metrics.conversions.successful} successful
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Avg: {metrics.conversions.avgTime.toFixed(0)}ms
              </p>
            </CardContent>
          </Card>

          {/* Sync Metrics */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Syncs</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.syncs.total}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.syncs.successful} successful
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Success rate: {(metrics.syncs.successRate * 100).toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          {/* Cache Metrics */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cache</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(metrics.cache.hitRate * 100).toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {metrics.cache.hits} hits / {metrics.cache.misses} misses
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Size: {metrics.cache.size} entries
              </p>
            </CardContent>
          </Card>

          {/* API Metrics */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">API</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.api.total}</div>
              <p className="text-xs text-muted-foreground">
                Avg: {metrics.api.avgResponseTime.toFixed(0)}ms
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Error rate: {(metrics.api.errorRate * 100).toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Performance Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Conversion Time Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Conversion Time Trend</CardTitle>
              <CardDescription>
                Average conversion time over the last 24 hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {conversionTrends.slice(-12).map((trend, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16">
                      {trend.label}
                    </span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{
                          width: `${Math.min((trend.value / 30000) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono w-16 text-right">
                      {trend.value.toFixed(0)}ms
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Sync Time Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Sync Time Trend</CardTitle>
              <CardDescription>
                Average sync time over the last 24 hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {syncTrends.slice(-12).map((trend, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16">
                      {trend.label}
                    </span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{
                          width: `${Math.min((trend.value / 60000) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono w-16 text-right">
                      {trend.value.toFixed(0)}ms
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alert Summary & Resource Metrics */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Alert Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Alert Summary</CardTitle>
              <CardDescription>Performance alerts in the last 24h</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {alertCounts.critical}
                  </div>
                  <p className="text-xs text-muted-foreground">Critical</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {alertCounts.warning}
                  </div>
                  <p className="text-xs text-muted-foreground">Warning</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {alertCounts.info}
                  </div>
                  <p className="text-xs text-muted-foreground">Info</p>
                </div>
              </div>
              <Button className="w-full mt-4" variant="outline" asChild>
                <Link href="/admin/performance/alerts">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Manage Alerts
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Resource & Storage Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Resource & Storage</CardTitle>
              <CardDescription>System resource usage</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Memory Usage</span>
                  <span className="text-sm font-mono">
                    {metrics.resources.avgMemoryUsage.toFixed(1)}MB avg
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Peak Memory</span>
                  <span className="text-sm font-mono">
                    {metrics.resources.peakMemoryUsage.toFixed(1)}MB
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Stored Metrics</span>
                  <span className="text-sm font-mono">{storageStats.total}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Cache Memory</span>
                  <span className="text-sm font-mono">
                    {(metrics.cache.memoryUsage / 1024 / 1024).toFixed(2)}MB
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Thresholds & Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Thresholds</CardTitle>
            <CardDescription>
              Current alert thresholds (triggers alerts when exceeded)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground">Max Conversion</div>
                <div className="font-mono font-semibold">
                  {globalAlertManager.getThresholds().maxConversionTime / 1000}s
                </div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground">Max Sync</div>
                <div className="font-mono font-semibold">
                  {globalAlertManager.getThresholds().maxSyncTime / 1000}s
                </div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground">Max API</div>
                <div className="font-mono font-semibold">
                  {globalAlertManager.getThresholds().maxApiResponseTime / 1000}s
                </div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground">Min Cache Hit</div>
                <div className="font-mono font-semibold">
                  {(globalAlertManager.getThresholds().minCacheHitRate * 100).toFixed(0)}%
                </div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground">Max Error Rate</div>
                <div className="font-mono font-semibold">
                  {(globalAlertManager.getThresholds().maxErrorRate * 100).toFixed(0)}%
                </div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground">Max Memory</div>
                <div className="font-mono font-semibold">
                  {globalAlertManager.getThresholds().maxMemoryUsage}MB
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex gap-4">
          <Button asChild>
            <Link href="/admin">
              <Shield className="h-4 w-4 mr-2" />
              Back to Admin
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/performance/alerts">
              <AlertCircle className="h-4 w-4 mr-2" />
              View All Alerts
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/analytics">
              <TrendingUp className="h-4 w-4 mr-2" />
              User Analytics
            </Link>
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
}
