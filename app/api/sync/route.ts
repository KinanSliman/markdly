import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { executeSync } from "@/lib/sync";
import { db } from "@/lib/database";
import { syncConfigs, githubConnections, googleConnections, documents, workspaces, accounts } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { checkSyncLimit, incrementSyncCount } from "@/lib/sync/limits";

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

    // 2. Check sync limit
    const syncLimit = await checkSyncLimit(session.user.id);
    if (!syncLimit.canSync) {
      return NextResponse.json(
        {
          error: `Sync limit reached. You've used ${syncLimit.limit} syncs this month. Upgrade to Pro for unlimited syncs.`,
          limitReached: true,
          remainingSyncs: 0,
          resetDate: syncLimit.resetDate,
        },
        { status: 429 }
      );
    }

    // 3. Parse request body
    const body = await request.json();
    const { docId, configId } = body;

    if (!docId) {
      return NextResponse.json(
        { error: "Missing required field: docId is required" },
        { status: 400 }
      );
    }

    // 3. Get user's workspace
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerId, session.user.id));

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // 4. Find sync config for this document
    let syncConfig;
    if (configId) {
      // If configId is provided, use it directly
      [syncConfig] = await db
        .select()
        .from(syncConfigs)
        .where(eq(syncConfigs.id, configId));
    } else {
      // Find sync config by looking up the document's syncConfigId
      const [trackedDoc] = await db
        .select()
        .from(documents)
        .where(and(
          eq(documents.googleDocId, docId),
          eq(documents.syncConfigId, workspace.id) // This won't work, need to join
        ));

      // Get all sync configs for this workspace
      const workspaceConfigs = await db
        .select()
        .from(syncConfigs)
        .where(eq(syncConfigs.workspaceId, workspace.id));

      // Find the config that has this document
      const configIds = workspaceConfigs.map(c => c.id).filter((id): id is string => id !== undefined);

      if (configIds.length > 0) {
        const [docWithConfig] = await db
          .select()
          .from(documents)
          .where(and(
            eq(documents.googleDocId, docId),
            inArray(documents.syncConfigId, configIds)
          ));

        if (docWithConfig) {
          syncConfig = workspaceConfigs.find(c => c.id === docWithConfig.syncConfigId);
        }
      }
    }

    if (!syncConfig) {
      return NextResponse.json(
        { error: "Sync configuration not found for this document" },
        { status: 404 }
      );
    }

    // 5. Check GitHub connection (only for github mode)
    if (syncConfig.mode === "github") {
      const [githubConn] = await db
        .select()
        .from(githubConnections)
        .where(eq(githubConnections.id, syncConfig.githubConnectionId!));

      if (!githubConn || !githubConn.accessToken) {
        return NextResponse.json(
          { error: "GitHub connection not configured. Please connect your GitHub account." },
          { status: 400 }
        );
      }
    }

    // 6. Check Google connection and refresh access token if needed
    const [googleConn] = await db
      .select()
      .from(googleConnections)
      .where(eq(googleConnections.id, syncConfig.googleConnectionId!));

    if (!googleConn || (!googleConn.refreshToken && !googleConn.accessToken)) {
      return NextResponse.json(
        { error: "Google connection not configured. Please connect your Google account." },
        { status: 400 }
      );
    }

    // Get fresh access token from accounts table (Google OAuth)
    const [googleAccount] = await db
      .select({ access_token: accounts.access_token })
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, session.user.id),
          eq(accounts.provider, "google")
        )
      );

    // Update Google connection with fresh access token if available
    if (googleAccount?.access_token) {
      await db
        .update(googleConnections)
        .set({ accessToken: googleAccount.access_token })
        .where(eq(googleConnections.id, googleConn.id));
    }

    // 7. Execute sync in background (return immediately, let sync run)
    // Note: For production, this should use a queue system (BullMQ/Upstash Redis)
    // For MVP, we'll run it synchronously
    const result = await executeSync({
      docId,
      configId: syncConfig.id!,
      userId: session.user.id,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.errorMessage || "Sync failed" },
        { status: 500 }
      );
    }

    // 8. Increment sync count after successful sync
    await incrementSyncCount(session.user.id);

    return NextResponse.json(
      {
        success: true,
        message: "Sync completed successfully",
        data: {
          commitSha: result.commitSha,
          prNumber: result.prNumber,
          prUrl: result.prUrl,
          filesChanged: result.filesChanged,
        },
        syncUsage: {
          currentCount: syncLimit.remainingSyncs === Infinity ? Infinity : syncLimit.limit - syncLimit.remainingSyncs + 1,
          limit: syncLimit.limit,
          remainingSyncs: syncLimit.remainingSyncs === Infinity ? Infinity : syncLimit.remainingSyncs - 1,
          resetDate: syncLimit.resetDate,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Sync API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // 1. Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Get query parameters
    const { searchParams } = new URL(request.url);
    const configId = searchParams.get("configId");
    const limit = parseInt(searchParams.get("limit") || "20");

    // 3. Check if requesting sync usage
    if (searchParams.get("usage") === "true") {
      const syncLimit = await checkSyncLimit(session.user.id);
      return NextResponse.json(
        {
          success: true,
          data: {
            currentCount: syncLimit.remainingSyncs === Infinity ? Infinity : syncLimit.limit - syncLimit.remainingSyncs,
            limit: syncLimit.limit,
            remainingSyncs: syncLimit.remainingSyncs,
            resetDate: syncLimit.resetDate,
          },
        },
        { status: 200 }
      );
    }

    if (!configId) {
      return NextResponse.json(
        { error: "Missing required parameter: configId" },
        { status: 400 }
      );
    }

    // 4. Fetch sync history
    const history = await db
      .select()
      .from(syncHistory)
      .where(eq(syncHistory.syncConfigId, configId))
      .orderBy(syncHistory.startedAt);

    return NextResponse.json(
      {
        success: true,
        data: history,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get sync history error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
