import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";

export default async function DocumentsPage() {
  const session = await auth();

  if (!session) {
    redirect("/api/auth/signin");
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
      </div>
    </DashboardShell>
  );
}
