import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { executeSync } from "@/lib/sync";
import { db } from "@/lib/database";
import { syncConfigs, githubConnections, googleConnections } from "@/db/schema";
import { eq } from "drizzle-orm";

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
    const { docId, configId } = body;

    if (!docId || !configId) {
      return NextResponse.json(
        { error: "Missing required fields: docId and configId are required" },
        { status: 400 }
      );
    }

    // 3. Validate sync config exists and belongs to user
    const [syncConfig] = await db
      .select()
      .from(syncConfigs)
      .where(eq(syncConfigs.id, configId));

    if (!syncConfig) {
      return NextResponse.json(
        { error: "Sync configuration not found" },
        { status: 404 }
      );
    }

    // 4. Check GitHub connection
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

    // 5. Check Google connection
    const [googleConn] = await db
      .select()
      .from(googleConnections)
      .where(eq(googleConnections.id, syncConfig.googleConnectionId!));

    if (!googleConn || !googleConn.refreshToken) {
      return NextResponse.json(
        { error: "Google connection not configured. Please connect your Google account." },
        { status: 400 }
      );
    }

    // 6. Execute sync in background (return immediately, let sync run)
    // Note: For production, this should use a queue system (BullMQ/Upstash Redis)
    // For MVP, we'll run it synchronously
    const result = await executeSync({
      docId,
      configId,
      userId: session.user.id,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.errorMessage || "Sync failed" },
        { status: 500 }
      );
    }

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

    if (!configId) {
      return NextResponse.json(
        { error: "Missing required parameter: configId" },
        { status: 400 }
      );
    }

    // 3. Fetch sync history
    const history = await db
      .select()
      .from(syncConfigs)
      .where(eq(syncConfigs.id, configId))
      .innerJoin(syncConfigs, eq(syncConfigs.id, configId));

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
