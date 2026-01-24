import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/database";
import { syncConfigs, githubConnections, googleConnections, workspaces } from "@/db/schema";
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
      folderId,
      framework,
      outputPath,
      imageStrategy,
      frontmatterTemplate,
      syncSchedule,
    } = body;

    // 3. Validate required fields
    if (!name || !repoOwner || !repoName || !folderId) {
      return NextResponse.json(
        { error: "Missing required fields: name, repoOwner, repoName, folderId are required" },
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

    // 5. Get GitHub connection for this workspace
    const [githubConn] = await db
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
      return NextResponse.json(
        { error: "GitHub connection not found for this repository. Please connect GitHub first." },
        { status: 400 }
      );
    }

    // 6. Get Google connection for this workspace
    const [googleConn] = await db
      .select()
      .from(googleConnections)
      .where(eq(googleConnections.workspaceId, workspace.id));

    if (!googleConn) {
      return NextResponse.json(
        { error: "Google connection not found. Please connect Google first." },
        { status: 400 }
      );
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
