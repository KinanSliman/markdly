import { redirect } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/database";
import { analytics, users } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, TrendingUp, Activity } from "lucide-react";

export default async function AdminAnalyticsPage() {
  await requireAdmin();

  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin");
  }

  // Get recent events
  const recentEvents = await db
    .select({
      id: analytics.id,
      event: analytics.event,
      metadata: analytics.metadata,
      createdAt: analytics.createdAt,
      userId: analytics.userId,
    })
    .from(analytics)
    .orderBy(desc(analytics.createdAt))
    .limit(20);

  // Get event counts
  const eventCounts = await db
    .select({
      event: analytics.event,
      count: sql<number>`count(*)`,
    })
    .from(analytics)
    .groupBy(analytics.event)
    .orderBy(desc(sql<number>`count(*)`));

  // Get user event breakdown
  const userEvents = await db
    .select({
      userId: analytics.userId,
      event: analytics.event,
      count: sql<number>`count(*)`,
    })
    .from(analytics)
    .groupBy(analytics.userId, analytics.event)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(10);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">
              User activity and event tracking
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {eventCounts.reduce((sum, e) => sum + e.count, 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Across all users
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Event Types</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{eventCounts.length}</div>
              <p className="text-xs text-muted-foreground">
                Unique event types
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Event</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {eventCounts[0]?.event || "—"}
              </div>
              <p className="text-xs text-muted-foreground">
                {eventCounts[0]?.count || 0} occurrences
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Event Breakdown</CardTitle>
              <CardDescription>
                Count of each event type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {eventCounts.map((item) => (
                  <div
                    key={item.event}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <span className="font-medium">{item.event}</span>
                    <span className="text-muted-foreground">{item.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
              <CardDescription>
                Latest user activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-3 rounded border bg-muted/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{event.event}</span>
                      <span className="text-xs text-muted-foreground">
                        {event.createdAt.toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      User: {event.userId.slice(0, 8)}...
                    </div>
                    {event.metadata && (
                      <div className="text-xs mt-1 font-mono">
                        {JSON.stringify(event.metadata)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
