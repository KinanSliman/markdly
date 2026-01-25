import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/database";
import { accounts, workspaces, githubConnections, googleConnections, syncConfigs, documents, syncHistory } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    // 1. Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { provider } = body;

    if (!provider || (provider !== "github" && provider !== "google")) {
      return NextResponse.json(
        { error: "Invalid provider. Must be 'github' or 'google'." },
        { status: 400 }
      );
    }

    // 3. Get user's workspace
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerId, session.user.id!));

    // 4. Delete provider-specific connections
    if (provider === "github") {
      // Delete GitHub connections (if they exist)
      if (workspace) {
        try {
          await db
            .delete(githubConnections)
            .where(eq(githubConnections.workspaceId, workspace.id));
        } catch (e) {
          // Ignore errors if no records exist
          console.log("No GitHub connections to delete or already deleted");
        }
      }

      // Delete the GitHub account from NextAuth
      await db
        .delete(accounts)
        .where(
          and(
            eq(accounts.userId, session.user.id!),
            eq(accounts.provider, "github")
          )
        );
    } else if (provider === "google") {
      // Get Google connection IDs for this workspace
      let googleConnIds: string[] = [];
      if (workspace) {
        const googleConns = await db
          .select({ id: googleConnections.id })
          .from(googleConnections)
          .where(eq(googleConnections.workspaceId, workspace.id));
        googleConnIds = googleConns.map((c) => c.id).filter((id): id is string => id !== undefined);
      }

      // Delete sync configs that use Google connection (and their tracked documents)
      if (googleConnIds.length > 0) {
        // Get sync configs for these Google connections
        const syncConfigsToDelete = await db
          .select({ id: syncConfigs.id })
          .from(syncConfigs)
          .where(inArray(syncConfigs.googleConnectionId, googleConnIds));
        const syncConfigIds = syncConfigsToDelete
          .map((c) => c.id)
          .filter((id): id is string => id !== undefined);

        console.log(`Found ${syncConfigIds.length} sync configs to delete`);

        // Delete sync history for these sync configs (must be done before deleting sync configs)
        if (syncConfigIds.length > 0) {
          try {
            const result = await db
              .delete(syncHistory)
              .where(inArray(syncHistory.syncConfigId, syncConfigIds));
            console.log(`Deleted sync history entries`);
          } catch (e) {
            console.log("Error deleting sync history:", e);
          }
        }

        // Delete tracked documents for these sync configs
        if (syncConfigIds.length > 0) {
          try {
            const result = await db
              .delete(documents)
              .where(inArray(documents.syncConfigId, syncConfigIds));
            console.log(`Deleted tracked documents`);
          } catch (e) {
            console.log("Error deleting tracked documents:", e);
          }
        }

        // Delete sync configs
        if (googleConnIds.length > 0) {
          try {
            const result = await db
              .delete(syncConfigs)
              .where(inArray(syncConfigs.googleConnectionId, googleConnIds));
            console.log(`Deleted sync configs`);
          } catch (e) {
            console.log("Error deleting sync configs:", e);
          }
        }
      }

      // Delete Google connections (if they exist)
      if (workspace) {
        try {
          await db
            .delete(googleConnections)
            .where(eq(googleConnections.workspaceId, workspace.id));
        } catch (e) {
          // Ignore errors if no records exist
          console.log("No Google connections to delete or already deleted");
        }
      }

      // Delete the Google account from NextAuth
      await db
        .delete(accounts)
        .where(
          and(
            eq(accounts.userId, session.user.id!),
            eq(accounts.provider, "google")
          )
        );
    }

    return NextResponse.json(
      {
        success: true,
        message: `${provider} account disconnected successfully`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Disconnect API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
