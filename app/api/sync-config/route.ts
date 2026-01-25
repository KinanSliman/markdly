import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/database";
import { syncConfigs, githubConnections, googleConnections, workspaces, accounts, documents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

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
    const {
      name,
      repoOwner,
      repoName,
      docId,
      docName,
      framework,
      outputPath,
      imageStrategy,
      frontmatterTemplate,
      syncSchedule,
    } = body;

    // 3. Validate required fields
    if (!name || !repoOwner || !repoName || !docId) {
      return NextResponse.json(
        { error: "Missing required fields: name, repoOwner, repoName, docId are required" },
        { status: 400 }
      );
    }

    // 4. Get or create workspace for user
    let [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerId, session.user.id));

    if (!workspace) {
      const [newWorkspace] = await db
        .insert(workspaces)
        .values({
          name: `${session.user.name || "User"}'s Workspace`,
          ownerId: session.user.id,
          plan: "free",
        })
        .returning();
      workspace = newWorkspace;
    }

    // 5. Get GitHub access token from OAuth accounts
    const [githubAccount] = await db
      .select({ access_token: accounts.access_token })
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, session.user.id),
          eq(accounts.provider, "github")
        )
      );

    if (!githubAccount?.access_token) {
      return NextResponse.json(
        { error: "GitHub account not connected. Please connect GitHub first." },
        { status: 400 }
      );
    }

    // 6. Get or create GitHub connection for this workspace
    let [githubConn] = await db
      .select()
      .from(githubConnections)
      .where(
        and(
          eq(githubConnections.workspaceId, workspace.id),
          eq(githubConnections.repoOwner, repoOwner),
          eq(githubConnections.repoName, repoName)
        )
      );

    if (!githubConn) {
      const [newGithubConn] = await db
        .insert(githubConnections)
        .values({
          workspaceId: workspace.id,
          repoOwner,
          repoName,
          accessToken: githubAccount.access_token,
        })
        .returning();
      githubConn = newGithubConn;
    }

    // 7. Get Google access token from OAuth accounts
    const [googleAccount] = await db
      .select({ access_token: accounts.access_token, refresh_token: accounts.refresh_token })
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, session.user.id),
          eq(accounts.provider, "google")
        )
      );

    if (!googleAccount?.access_token) {
      return NextResponse.json(
        { error: "Google account not connected. Please connect Google first." },
        { status: 400 }
      );
    }

    // 8. Get or create Google connection for this workspace
    let [googleConn] = await db
      .select()
      .from(googleConnections)
      .where(eq(googleConnections.workspaceId, workspace.id));

    if (!googleConn) {
      // Create new Google connection
      const [newGoogleConn] = await db
        .insert(googleConnections)
        .values({
          workspaceId: workspace.id,
          folderId: "root", // Default to root since we're selecting individual docs
          accessToken: googleAccount.access_token,
          refreshToken: googleAccount.refresh_token || null,
        })
        .returning();
      googleConn = newGoogleConn;
    } else {
      // Update existing Google connection with fresh tokens from accounts table
      // This handles the case where access token has expired
      await db
        .update(googleConnections)
        .set({
          accessToken: googleAccount.access_token,
          // Only update refresh token if we have a new one (Google only returns it on first auth)
          ...(googleAccount.refresh_token ? { refreshToken: googleAccount.refresh_token } : {}),
        })
        .where(eq(googleConnections.id, googleConn.id));

      // Refresh the googleConn variable with updated data
      [googleConn] = await db
        .select()
        .from(googleConnections)
        .where(eq(googleConnections.id, googleConn.id));
    }

    // 7. Create sync configuration
    const [syncConfig] = await db
      .insert(syncConfigs)
      .values({
        workspaceId: workspace.id,
        githubConnectionId: githubConn.id,
        googleConnectionId: googleConn.id,
        name,
        framework: framework || "nextjs",
        outputPath: outputPath || "content/posts/",
        frontmatterTemplate: frontmatterTemplate || "",
        imageStrategy: imageStrategy || "cloudinary",
        imagePath: "public/images/",
        isActive: true,
        syncSchedule: syncSchedule || "manual",
      })
      .returning();

    // 8. Create a tracked document entry for the selected Google Doc
    // This allows the document picker to show this document for syncing
    await db
      .insert(documents)
      .values({
        syncConfigId: syncConfig.id,
        googleDocId: docId,
        title: docName,
        createdAt: new Date(),
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        message: "Sync configuration created successfully",
        data: syncConfig,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create sync config error:", error);
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

    // 2. Get user's workspace
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerId, session.user.id));

    if (!workspace) {
      return NextResponse.json(
        {
          success: true,
          data: [],
        },
        { status: 200 }
      );
    }

    // 3. Get sync configurations
    const configs = await db
      .select()
      .from(syncConfigs)
      .where(eq(syncConfigs.workspaceId, workspace.id));

    return NextResponse.json(
      {
        success: true,
        data: configs,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get sync configs error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
