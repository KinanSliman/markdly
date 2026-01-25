import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { auth } from "@/lib/auth";
import { db } from "@/lib/database";
import { syncHistory, syncConfigs, workspaces } from "@/db/schema";
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
    }
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Sync History</h1>
          <p className="text-muted-foreground">
            View the history of your document syncs
          </p>
        </div>

        <SyncHistoryList initialHistory={history} />
      </div>
    </DashboardShell>
  );
}
