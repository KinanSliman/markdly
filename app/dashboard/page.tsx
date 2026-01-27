import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { SignInButton } from "@/components/forms/signin-button";
import { Github, Chrome, CheckCircle2, XCircle, ArrowRight, Settings, Mail } from "lucide-react";
import { db } from "@/lib/database";
import { accounts, workspaces, syncConfigs, syncHistory, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const session = await auth();

  // If not authenticated, show sign-in prompt
  if (!session || !session.user) {
    return (
      <DashboardShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Welcome to Markdly</h1>
            <p className="text-muted-foreground text-lg max-w-md">
              Turn Google Docs into GitHub-ready Markdown. Sign in to get started.
            </p>
          </div>
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 space-y-4">
              <Button asChild className="w-full">
                <Link href="/auth/signin">
                  <Mail className="mr-2 h-4 w-4" />
                  Sign in with Email
                </Link>
              </Button>
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link href="/auth/signup" className="text-primary hover:underline">
                  Sign up
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  // Check which providers are connected
  const userAccounts = await db
    .select({ provider: accounts.provider })
    .from(accounts)
    .where(eq(accounts.userId, session.user.id!));

  const connectedProviders = new Set(userAccounts.map((a) => a.provider));
  const githubConnected = connectedProviders.has("github");
  const googleConnected = connectedProviders.has("google");

  // Get workspace and sync configs
  let [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, session.user.id!));

  // Create workspace if it doesn't exist
  if (!workspace) {
    const newWorkspace = await db
      .insert(workspaces)
      .values({
        ownerId: session.user.id!,
        name: `${session.user.name || session.user.email}'s Workspace`,
        plan: "free",
      })
      .returning();

    workspace = newWorkspace[0];
  }

  let configsCount = 0;
  let recentSyncs: typeof syncHistory.$inferSelect[] = [];

  if (workspace) {
    const configs = await db
      .select()
      .from(syncConfigs)
      .where(eq(syncConfigs.workspaceId, workspace.id!));

    configsCount = configs.length;

    if (configs.length > 0) {
      recentSyncs = await db
        .select()
        .from(syncHistory)
        .where(eq(syncHistory.syncConfigId, configs[0].id!))
        .orderBy(syncHistory.startedAt)
        .limit(3);
    }
  }

  const allConnected = githubConnected && googleConnected && configsCount > 0;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {session.user?.name || "User"}!
          </p>
        </div>

        {/* Onboarding Banner */}
        {!allConnected && (
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
            <CardHeader>
              <CardTitle className="text-blue-900 dark:text-blue-100">
                {configsCount === 0
                  ? "Get Started with Markdly"
                  : "Almost Ready!"}
              </CardTitle>
              <CardDescription className="text-blue-700 dark:text-blue-200">
                {configsCount === 0
                  ? "Connect your accounts and create your first sync configuration to start syncing documents."
                  : "Create your first sync configuration to start syncing documents."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {!githubConnected && (
                  <SignInButton provider="github" label="Connect GitHub" />
                )}
                {!googleConnected && (
                  <SignInButton provider="google" label="Connect Google" />
                )}
                {githubConnected && googleConnected && configsCount === 0 && (
                  <Button asChild>
                    <Link href="/settings/sync-configs">
                      Create Sync Configuration
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Sync Configurations</CardTitle>
              <CardDescription>Your configured sync workflows</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">{configsCount}</div>
              <p className="text-sm text-muted-foreground">
                {configsCount === 0
                  ? "No configurations yet"
                  : `Configuration${configsCount > 1 ? "s" : ""} ready`}
              </p>
              <Button asChild variant="outline" className="mt-4 w-full">
                <Link href="/settings/sync-configs">
                  Manage Configurations
                  <Settings className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Connections</CardTitle>
              <CardDescription>Manage your connected accounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Github className="h-4 w-4" />
                  <span className="text-sm font-medium">GitHub</span>
                </div>
                {githubConnected ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Chrome className="h-4 w-4" />
                  <span className="text-sm font-medium">Google</span>
                </div>
                {googleConnected ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
              <Button asChild variant="outline" className="mt-2 w-full">
                <Link href="/settings">
                  View Connections
                  <Settings className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Syncs</CardTitle>
              <CardDescription>Latest sync operations</CardDescription>
            </CardHeader>
            <CardContent>
              {recentSyncs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No syncs yet. Create your first sync to see history here.
                </p>
              ) : (
                <div className="space-y-2">
                  {recentSyncs.map((sync) => (
                    <div key={sync.id} className="text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate max-w-[150px]">
                          {sync.docTitle || "Untitled"}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            sync.status === "success"
                              ? "bg-green-100 text-green-800"
                              : sync.status === "failed"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {sync.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button asChild variant="outline" className="mt-4 w-full">
                <Link href="/dashboard/syncs">
                  View All History
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
