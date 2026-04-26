import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { auth } from "@/lib/auth";
import { db } from "@/lib/database";
import { syncHistory, syncConfigs, workspaces, documents } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { SyncHistoryList } from "@/components/sync-history-list";

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
      // Get sync history for all workspace configs
      history = await db
        .select()
        .from(syncHistory)
        .where(inArray(syncHistory.syncConfigId, configIds))
        .orderBy(syncHistory.startedAt);

      // If sync history doesn't have filePath, try to get it from documents table
      if (history.length > 0) {
        const docIds = history
          .map((h) => h.docId)
          .filter((id): id is string => id !== null && id !== undefined);

        if (docIds.length > 0) {
          const trackedDocs = await db
            .select({ googleDocId: documents.googleDocId, metadata: documents.metadata })
            .from(documents)
            .where(inArray(documents.googleDocId, docIds));

          const docMetadataMap = new Map<string, string | null | undefined>(
            trackedDocs.map((doc) => [
              doc.googleDocId as string,
              (doc.metadata as { filePath?: string } | null)?.filePath,
            ])
          );

          // Merge file path into history entries
          history = history.map((entry) => ({
            ...entry,
            filePath:
              entry.filePath ||
              (entry.docId ? docMetadataMap.get(entry.docId) ?? null : null),
          }));
        }
      }
    }
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Sync History</h1>
          <p className="text-muted-foreground">
            View the history of your document syncs
          </p>
        </div>

        <SyncHistoryList initialHistory={history} />
      </div>
    </DashboardShell>
  );
}
