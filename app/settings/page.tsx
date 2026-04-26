import { redirect } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { Separator } from "@/components/ui/separator";
import { SignInButton } from "@/components/forms/signin-button";
import { DisconnectButton } from "@/components/forms/disconnect-button";
import { Button } from "@/components/ui/button";
import { Settings, ExternalLink } from "lucide-react";
import { db } from "@/lib/database";
import { accounts, workspaces, syncConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function SettingsPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/api/auth/signin");
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
  if (workspace) {
    const configs = await db
      .select()
      .from(syncConfigs)
      .where(eq(syncConfigs.workspaceId, workspace.id!));
    configsCount = configs.length;
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your workspace settings and connections
          </p>
        </div>

        <Separator />

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>GitHub Connection</CardTitle>
              <CardDescription>
                Connect your GitHub account to sync documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Connect a GitHub account to enable syncing documents to your repositories.
              </p>
              {githubConnected ? (
                <div className="flex items-center justify-between">
                  <span className="text-green-600 font-medium">✓ Connected</span>
                  <DisconnectButton provider="github" />
                </div>
              ) : (
                <SignInButton provider="github" label="Connect GitHub" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Google Connection</CardTitle>
              <CardDescription>
                Connect your Google account to access Docs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Connect a Google account to access your Google Docs for syncing.
              </p>
              {googleConnected ? (
                <div className="flex items-center justify-between">
                  <span className="text-green-600 font-medium">✓ Connected</span>
                  <DisconnectButton provider="google" />
                </div>
              ) : (
                <SignInButton provider="google" label="Connect Google" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sync Configurations</CardTitle>
              <CardDescription>
                Configure how documents sync to GitHub
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {configsCount} configuration{configsCount !== 1 ? "s" : ""} active.
                Set up output paths, front matter templates, and image strategies.
              </p>
              <Button asChild variant="outline">
                <Link href="/settings/sync-configs">
                  Manage Configurations
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cloudinary Configuration</CardTitle>
              <CardDescription>
                Configure image hosting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Images will be uploaded to Cloudinary and linked via CDN URLs.
                Make sure to set your Cloudinary credentials in your environment variables.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
