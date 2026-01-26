import { redirect } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/database";
import { users, syncHistory } from "@/db/schema";
import { count } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, Mail, Calendar, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default async function AdminUsersPage() {
  await requireAdmin();

  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin");
  }

  // Get all users
  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      signupSource: users.signupSource,
      signupDate: users.signupDate,
      lastLogin: users.lastLogin,
      emailVerified: users.emailVerified,
      isAdmin: users.isAdmin,
    })
    .from(users);

  // Get sync counts per user
  const userSyncCounts = await db
    .select({
      userId: syncHistory.userId,
      count: count(),
    })
    .from(syncHistory)
    .where(syncHistory.userId.isNotNull())
    .groupBy(syncHistory.userId);

  // Enrich users with sync counts
  const enrichedUsers = allUsers.map((user) => {
    const syncCount = userSyncCounts.find((sc) => sc.userId === user.id)?.count || 0;
    return {
      ...user,
      syncCount,
    };
  });

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-muted-foreground">
              Manage all registered users
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Users ({enrichedUsers.length})</CardTitle>
            <CardDescription>
              List of all registered users and their activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">User</th>
                    <th className="text-left py-3 px-2 font-medium">Email</th>
                    <th className="text-left py-3 px-2 font-medium">Source</th>
                    <th className="text-left py-3 px-2 font-medium">Verified</th>
                    <th className="text-left py-3 px-2 font-medium">Admin</th>
                    <th className="text-left py-3 px-2 font-medium">Syncs</th>
                    <th className="text-left py-3 px-2 font-medium">Joined</th>
                    <th className="text-left py-3 px-2 font-medium">Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {enrichedUsers.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{user.name || "—"}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-sm">{user.email}</td>
                      <td className="py-3 px-2">
                        <Badge variant="secondary">{user.signupSource}</Badge>
                      </td>
                      <td className="py-3 px-2">
                        {user.emailVerified ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </td>
                      <td className="py-3 px-2">
                        {user.isAdmin ? (
                          <Badge variant="default">Admin</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-2 font-medium">{user.syncCount}</td>
                      <td className="py-3 px-2 text-sm text-muted-foreground">
                        {user.signupDate ? user.signupDate.toLocaleDateString() : "—"}
                      </td>
                      <td className="py-3 px-2 text-sm text-muted-foreground">
                        {user.lastLogin
                          ? user.lastLogin.toLocaleDateString()
                          : "Never"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
