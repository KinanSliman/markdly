import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { db } from "@/lib/database";
import { syncHistory, syncConfigs, workspaces } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Calendar, GitCommit, FileText, Clock } from "lucide-react";

export default async function SyncHistoryPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/api/auth/signin");
  }

  // Get user's workspace
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, session.user.id!));

  let history: typeof syncHistory.$inferSelect[] = [];

  if (workspace) {
    // Get sync configs for this workspace
    const configs = await db
      .select({ id: syncConfigs.id })
      .from(syncConfigs)
      .where(eq(syncConfigs.workspaceId, workspace.id!));

    const configIds = configs.map((c) => c.id).filter((id): id is string => id !== undefined);

    if (configIds.length > 0) {
      // Get sync history for these configs
      history = await db
        .select()
        .from(syncHistory)
        .where(eq(syncHistory.syncConfigId, configIds[0]))
        .orderBy(syncHistory.startedAt);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500">Success</Badge>;
      case "failed":
        return <Badge className="bg-red-500">Failed</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500">Pending</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Sync History</h1>
          <p className="text-muted-foreground">
            View the history of your document syncs
          </p>
        </div>

        {history.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Syncs Yet</CardTitle>
              <CardDescription>
                Start syncing documents to see history here
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Once you sync your first document, you'll see a detailed history of all sync operations here.
                This includes success/failure status, files changed, commit SHAs, and timestamps.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {history.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{entry.docTitle || "Untitled"}</span>
                        {getStatusBadge(entry.status || "pending")}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {entry.startedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(entry.startedAt).toLocaleString()}
                          </span>
                        )}
                        {entry.commitSha && (
                          <span className="flex items-center gap-1">
                            <GitCommit className="h-3 w-3" />
                            {entry.commitSha.slice(0, 7)}
                          </span>
                        )}
                        {entry.filesChanged && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {entry.filesChanged} file(s)
                          </span>
                        )}
                      </div>
                      {entry.errorMessage && (
                        <p className="text-sm text-red-500 mt-2">
                          Error: {entry.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
