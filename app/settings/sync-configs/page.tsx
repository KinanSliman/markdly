import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { db } from "@/lib/database";
import { syncConfigs, workspaces, accounts, documents } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { SyncConfigForm } from "@/components/forms/sync-config-form";
import { listGitHubRepos } from "@/lib/github";
import { listAllAccessibleDocsByUserId, GoogleReconnectRequiredError } from "@/lib/google";
import { SyncButton } from "@/components/forms/sync-button";
import { ReconnectGoogleButton } from "@/components/forms/reconnect-google-button";
import { FileText, Calendar, GitCommit } from "lucide-react";

export default async function SyncConfigsPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/api/auth/signin");
  }

  // Get user's workspace
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

  // Check OAuth connections via accounts table (not workspace-specific tables)
  const userAccounts = await db
    .select({ provider: accounts.provider, accessToken: accounts.access_token, refreshToken: accounts.refresh_token })
    .from(accounts)
    .where(eq(accounts.userId, session.user.id!));

  const githubAccount = userAccounts.find((a) => a.provider === "github");
  const googleAccount = userAccounts.find((a) => a.provider === "google");

  let githubRepos: Array<{ owner: string; name: string }> = [];
  let googleDocs: Array<{ id: string; name: string }> = [];
  let googleReconnectRequired = false;
  let googleReconnectMessage = "";

  if (githubAccount?.accessToken) {
    try {
      const repos = await listGitHubRepos(githubAccount.accessToken);
      githubRepos = repos.map((repo) => ({
        owner: repo.owner.login,
        name: repo.name,
      }));
    } catch (error) {
      console.error("Error fetching GitHub repos:", error);
    }
  }

  if (googleAccount) {
    try {
      console.log("Attempting to list all accessible Google Docs...");
      // Use the new function that searches for all accessible Google Docs
      // This includes docs in root, shared docs, and docs in subdirectories
      // It also handles token refresh automatically if needed
      const docs = await listAllAccessibleDocsByUserId(session.user.id!);
      console.log("Google Docs found:", docs.length);
      googleDocs = docs.map((doc) => ({
        id: doc.id,
        name: doc.name,
      }));
      console.log("Google Docs:", googleDocs);
    } catch (error) {
      console.error("Error fetching Google Docs:", error);
      // Check if this is a reconnection error
      if (error instanceof GoogleReconnectRequiredError) {
        googleReconnectRequired = true;
        googleReconnectMessage = error.message;
      }
    }
  } else {
    console.log("No Google account found");
  }

  // Get existing sync configs
  const configs = await db
    .select()
    .from(syncConfigs)
    .where(eq(syncConfigs.workspaceId, workspace.id!));

  // Get tracked documents for each config with their sync config info
  let trackedDocs: (typeof documents.$inferSelect & { syncConfig?: typeof syncConfigs.$inferSelect })[] = [];
  if (configs.length > 0) {
    const configIds = configs.map((c) => c.id).filter((id): id is string => id !== undefined);
    const docs = await db
      .select()
      .from(documents)
      .where(inArray(documents.syncConfigId, configIds));

    // Join with sync configs to get mode info
    trackedDocs = docs.map((doc) => {
      const syncConfig = configs.find((c) => c.id === doc.syncConfigId);
      return { ...doc, syncConfig };
    });
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Sync Configurations</h1>
          <p className="text-muted-foreground">
            Configure how your Google Docs sync to GitHub repositories
          </p>
        </div>

        {!githubAccount || !googleAccount ? (
          <Card>
            <CardHeader>
              <CardTitle>Connections Required</CardTitle>
              <CardDescription>
                You need to connect both GitHub and Google before creating sync configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Please visit the Settings page to connect your GitHub and Google accounts first.
              </p>
            </CardContent>
          </Card>
        ) : googleReconnectRequired ? (
          <Card>
            <CardHeader>
              <CardTitle>Google Account Reconnection Required</CardTitle>
              <CardDescription>
                Your Google access token has expired or needs to be refreshed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {googleReconnectMessage}
              </p>
              <p className="text-sm text-muted-foreground">
                Click the button below to reconnect your Google account. This will:
              </p>
              <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                <li>Disconnect your existing Google account</li>
                <li>Redirect you to Google for re-authorization</li>
                <li>Obtain a new refresh token for future use</li>
              </ol>
            </CardContent>
            <CardFooter>
              <ReconnectGoogleButton />
            </CardFooter>
          </Card>
        ) : githubRepos.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No GitHub Repositories Found</CardTitle>
              <CardDescription>
                Make sure your GitHub account has access to repositories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                We couldn't find any repositories accessible with your GitHub connection.
                Please check your GitHub permissions and try again.
              </p>
            </CardContent>
          </Card>
        ) : googleDocs.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Google Docs Found</CardTitle>
              <CardDescription>
                Make sure your Google account has access to documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                We couldn't find any Google Docs in your account.
                Please check your Google Drive permissions and try again.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <SyncConfigForm
              githubRepos={githubRepos}
              googleDocs={googleDocs}
            />

            {configs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Existing Configurations</CardTitle>
                  <CardDescription>
                    Your saved sync configurations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {configs.map((config) => (
                    <div
                      key={config.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div>
                        <p className="font-medium">{config.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {config.framework} • {config.outputPath}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded bg-muted">
                          {config.syncSchedule}
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {trackedDocs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Tracked Documents</CardTitle>
                  <CardDescription>
                    Documents ready to sync or convert
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {trackedDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{doc.title || "Untitled"}</span>
                          {doc.syncConfig?.mode === "convert-only" && (
                            <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                              Convert Only
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {doc.lastSynced && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(doc.lastSynced).toLocaleDateString()}
                            </span>
                          )}
                          {doc.metadata?.commitSha && (
                            <span className="flex items-center gap-1">
                              <GitCommit className="h-3 w-3" />
                              {String(doc.metadata.commitSha).slice(0, 7)}
                            </span>
                          )}
                        </div>
                      </div>
                      <SyncButton
                        docId={doc.googleDocId!}
                        docName={doc.title!}
                        mode={doc.syncConfig?.mode || "github"}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
