import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { Separator } from "@/components/ui/separator";
import { SignInButton } from "@/components/forms/signin-button";

export default async function SettingsPage() {
  const session = await auth();

  if (!session) {
    redirect("/api/auth/signin");
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
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
              <SignInButton provider="github" label="Connect GitHub" />
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
              <SignInButton provider="google" label="Connect Google" />
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
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sync Configuration</CardTitle>
              <CardDescription>
                Configure sync behavior
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Set up output paths, front matter templates, and image strategies.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
