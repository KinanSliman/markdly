import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/database";
import { syncHistory, syncConfigs, githubConnections, workspaces } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { Octokit } from "@octokit/rest";

/**
 * GET /api/download?syncId=<syncId>
 * Downloads the file from GitHub for a specific sync history entry
 */
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const syncId = searchParams.get("syncId");

  if (!syncId) {
    return NextResponse.json({ error: "syncId is required" }, { status: 400 });
  }

  try {
    // Get user's workspace
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerId, session.user.id!));

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Get the sync history entry
    const [historyEntry] = await db
      .select()
      .from(syncHistory)
      .where(eq(syncHistory.id, syncId));

    if (!historyEntry) {
      return NextResponse.json({ error: "Sync history not found" }, { status: 404 });
    }

    // Check if the sync belongs to the user's workspace
    const [syncConfig] = await db
      .select()
      .from(syncConfigs)
      .where(eq(syncConfigs.id, historyEntry.syncConfigId!));

    if (!syncConfig || syncConfig.workspaceId !== workspace.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get GitHub connection
    const [githubConn] = await db
      .select()
      .from(githubConnections)
      .where(eq(githubConnections.id, syncConfig.githubConnectionId!));

    if (!githubConn || !githubConn.accessToken) {
      return NextResponse.json({ error: "GitHub connection not found" }, { status: 404 });
    }

    // Check if we have the required data
    if (!historyEntry.commitSha || !historyEntry.filePath) {
      return NextResponse.json(
        { error: "File information not available for this sync" },
        { status: 404 }
      );
    }

    // Fetch file content from GitHub
    const octokit = new Octokit({ auth: githubConn.accessToken });

    const { data: fileData } = await octokit.repos.getContent({
      owner: githubConn.repoOwner!,
      repo: githubConn.repoName!,
      path: historyEntry.filePath,
      ref: historyEntry.commitSha,
    });

    if (Array.isArray(fileData)) {
      return NextResponse.json({ error: "Path is a directory, not a file" }, { status: 400 });
    }

    if (fileData.type !== "file" || !("content" in fileData)) {
      return NextResponse.json({ error: "Not a file" }, { status: 400 });
    }

    // Decode the base64 content
    const content = Buffer.from(fileData.content, "base64").toString("utf-8");

    // Return the file as a downloadable response
    const fileName = historyEntry.filePath.split("/").pop() || "download.md";

    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Failed to download file" },
      { status: 500 }
    );
  }
}
