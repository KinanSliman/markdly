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
import { globalAlertManager } from "@/lib/metrics";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  AlertCircle,
  XCircle,
  CheckCircle2,
  Clock,
  Shield,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default async function AdminPerformanceAlertsPage() {
  await requireAdmin();

  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin");
  }

  const alerts = globalAlertManager.getAlerts();
  const unacknowledgedAlerts = globalAlertManager.getUnacknowledgedAlerts();
  const alertCounts = globalAlertManager.getAlertCounts();

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Performance Alerts</h1>
            <p className="text-muted-foreground">
              Monitor and manage system performance alerts
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/admin/performance">
              <Shield className="h-4 w-4 mr-2" />
              Back to Performance
            </Link>
          </Button>
        </div>

        {/* Alert Summary */}
        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600">
                Critical
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {alertCounts.critical}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-600">
                Warning
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {alertCounts.warning}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-600">
                Info
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {alertCounts.info}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Unacknowledged</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{unacknowledgedAlerts.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts List */}
        <Card>
          <CardHeader>
            <CardTitle>
              Recent Alerts{" "}
              {unacknowledgedAlerts.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unacknowledgedAlerts.length} New
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Showing {alerts.length} alert{alerts.length !== 1 ? "s" : ""} from the
              last 24 hours
            </CardDescription>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-semibold">No Alerts</h3>
                <p className="text-muted-foreground">
                  System performance is within normal parameters
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`border rounded-lg p-4 ${
                      alert.severity === "critical"
                        ? "border-red-500 bg-red-50/50"
                        : alert.severity === "warning"
                        ? "border-yellow-500 bg-yellow-50/50"
                        : "border-blue-500 bg-blue-50/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {alert.severity === "critical" && (
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                          )}
                          {alert.severity === "warning" && (
                            <AlertCircle className="h-4 w-4 text-yellow-600" />
                          )}
                          {alert.severity === "info" && (
                            <AlertCircle className="h-4 w-4 text-blue-600" />
                          )}
                          <Badge
                            variant={
                              alert.severity === "critical"
                                ? "destructive"
                                : alert.severity === "warning"
                                ? "default"
                                : "secondary"
                            }
                            className="capitalize"
                          >
                            {alert.severity}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {alert.type.replace(/_/g, " ")}
                          </span>
                          {!alert.acknowledged && (
                            <Badge variant="outline">New</Badge>
                          )}
                        </div>
                        <p className="font-medium">{alert.message}</p>
                        {alert.details && Object.keys(alert.details).length > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground font-mono bg-background/50 rounded p-2">
                            {Object.entries(alert.details).map(([key, value]) => (
                              <div key={key}>
                                <span className="text-muted-foreground">
                                  {key}:
                                </span>{" "}
                                {typeof value === "number"
                                  ? value.toFixed(2)
                                  : String(value)}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {new Date(alert.triggeredAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        {!alert.acknowledged ? (
                          <form action={async () => {
                            "use server";
                            globalAlertManager.acknowledgeAlert(alert.id);
                          }}>
                            <Button
                              type="submit"
                              size="sm"
                              variant="outline"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Acknowledge
                            </Button>
                          </form>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Acknowledged
                          </Badge>
                        )}
                        <form action={async () => {
                          "use server";
                          globalAlertManager.deleteAlert(alert.id);
                        }}>
                          <Button
                            type="submit"
                            size="sm"
                            variant="ghost"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </form>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Thresholds */}
        <Card>
          <CardHeader>
            <CardTitle>Alert Thresholds</CardTitle>
            <CardDescription>
              Current thresholds that trigger performance alerts
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
      </div>
    </DashboardShell>
  );
}
