import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/database";
import { syncHistory, syncConfigs, workspaces } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Missing sync history ID" },
        { status: 400 }
      );
    }

    // 2. Get user's workspace
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

    // 3. Verify the sync history belongs to the user's workspace
    // First get the sync config for this history entry
    const [historyEntry] = await db
      .select()
      .from(syncHistory)
      .where(eq(syncHistory.id, id));

    if (!historyEntry || !historyEntry.syncConfigId) {
      return NextResponse.json(
        { error: "Sync history entry not found" },
        { status: 404 }
      );
    }

    // Verify the sync config belongs to the user's workspace
    const [syncConfig] = await db
      .select()
      .from(syncConfigs)
      .where(
        and(
          eq(syncConfigs.id, historyEntry.syncConfigId),
          eq(syncConfigs.workspaceId, workspace.id)
        )
      );

    if (!syncConfig) {
      return NextResponse.json(
        { error: "Sync history entry not found or access denied" },
        { status: 404 }
      );
    }

    // 4. Delete the sync history entry
    await db
      .delete(syncHistory)
      .where(eq(syncHistory.id, id));

    return NextResponse.json(
      {
        success: true,
        message: "Sync history entry deleted successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete sync history error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
