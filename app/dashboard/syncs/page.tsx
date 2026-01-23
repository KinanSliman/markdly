import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";

export default async function SyncHistoryPage() {
  const session = await auth();

  if (!session) {
    redirect("/api/auth/signin");
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
      </div>
    </DashboardShell>
  );
}
