import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { db } from "@/lib/database";
import { documents, syncConfigs, workspaces, type DocumentMetadata } from "@/db/schema";
import { eq } from "drizzle-orm";
import { FileText, Calendar, GitCommit } from "lucide-react";

export default async function DocumentsPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/api/auth/signin");
  }

  // Get user's workspace
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, session.user.id!));

  let trackedDocs: typeof documents.$inferSelect[] = [];

  if (workspace) {
    // Get sync configs for this workspace
    const configs = await db
      .select({ id: syncConfigs.id })
      .from(syncConfigs)
      .where(eq(syncConfigs.workspaceId, workspace.id!));

    const configIds = configs.map((c) => c.id).filter((id): id is string => id !== undefined);

    if (configIds.length > 0) {
      // Get tracked documents
      trackedDocs = await db
        .select()
        .from(documents)
        .where(eq(documents.syncConfigId, configIds[0]))
        .orderBy(documents.lastSynced);
    }
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Documents</h1>
          <p className="text-muted-foreground">
            Manage your synced Google Docs
          </p>
        </div>

        {trackedDocs.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Documents Yet</CardTitle>
              <CardDescription>
                Start syncing to track your documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Once you sync a document, it will appear here with tracking information
                including last sync time and modification status.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {trackedDocs.map((doc) => (
              <Card key={doc.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{doc.title || "Untitled"}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {doc.lastSynced && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Last synced: {new Date(doc.lastSynced).toLocaleString()}
                          </span>
                        )}
                        {doc.metadata?.commitSha && (
                          <span className="flex items-center gap-1">
                            <GitCommit className="h-3 w-3" />
                            {doc.metadata.commitSha.slice(0, 7)}
                          </span>
                        )}
                      </div>
                      {doc.metadata?.prUrl && (
                        <a
                          href={doc.metadata.prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-500 hover:underline"
                        >
                          View Pull Request →
                        </a>
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
