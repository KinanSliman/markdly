import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { db } from "@/lib/database";
import { syncConfigs, workspaces, githubConnections, googleConnections } from "@/db/schema";
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
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, session.user.id!));

  if (!workspace) {
    redirect("/settings");
  }

  // Get GitHub connection
  const [githubConn] = await db
    .select()
    .from(githubConnections)
    .where(eq(githubConnections.workspaceId, workspace.id!));

  // Get Google connection
  const [googleConn] = await db
    .select()
    .from(googleConnections)
    .where(eq(googleConnections.workspaceId, workspace.id!));

  let githubRepos: Array<{ owner: string; name: string }> = [];
  let googleFolders: Array<{ id: string; name: string }> = [];

  if (githubConn?.accessToken) {
    try {
      const repos = await listGitHubRepos(githubConn.accessToken);
      githubRepos = repos.map((repo) => ({
        owner: repo.owner.login,
        name: repo.name,
      }));
    } catch (error) {
      console.error("Error fetching GitHub repos:", error);
    }
  }

  if (googleConn?.refreshToken) {
    try {
      const folders = await listFilesInFolder("root", googleConn.refreshToken);
      googleFolders = folders
        .filter((f) => f.mimeType === "application/vnd.google-apps.folder")
        .map((f) => ({
          id: f.id,
          name: f.name,
        }));
    } catch (error) {
      console.error("Error fetching Google folders:", error);
    }
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

        {!githubConn || !googleConn ? (
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
