import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { db } from "@/lib/database";
import { syncConfigs, workspaces, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SyncConfigForm } from "@/components/forms/sync-config-form";
import { listGitHubRepos } from "@/lib/github";
import { listFilesInFolder } from "@/lib/google";

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
  let googleFolders: Array<{ id: string; name: string }> = [];

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

  if (googleAccount?.accessToken) {
    try {
      console.log("Attempting to list Google Drive folders using access token...");
      // Use access token directly since refresh token might not be available
      const folders = await listFilesInFolder("root", googleAccount.accessToken, true);
      console.log("Google Drive folders:", folders);
      googleFolders = folders
        .filter((f) => f.mimeType === "application/vnd.google-apps.folder")
        .map((f) => ({
          id: f.id,
          name: f.name,
        }));
      console.log("Filtered Google Drive folders:", googleFolders);
    } catch (error) {
      console.error("Error fetching Google folders:", error);
    }
  } else {
    console.log("No Google access token found. accessToken:", googleAccount?.accessToken);
  }

  // Get existing sync configs
  const configs = await db
    .select()
    .from(syncConfigs)
    .where(eq(syncConfigs.workspaceId, workspace.id!));

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
        ) : googleFolders.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Google Drive Folders Found</CardTitle>
              <CardDescription>
                Make sure your Google account has access to folders
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                We couldn't find any folders in your Google Drive.
                Please check your Google Drive permissions and try again.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <SyncConfigForm
              githubRepos={githubRepos}
              googleFolders={googleFolders}
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
          </>
        )}
      </div>
    </DashboardShell>
  );
}
