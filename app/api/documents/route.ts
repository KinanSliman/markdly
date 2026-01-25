import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/database";
import { syncConfigs, googleConnections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { listFilesInFolder } from "@/lib/google";

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

    if (!configId) {
      return NextResponse.json(
        { error: "Missing required parameter: configId" },
        { status: 400 }
      );
    }

    // 3. Fetch sync configuration
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

    // 4. Fetch Google connection
    const [googleConn] = await db
      .select()
      .from(googleConnections)
      .where(eq(googleConnections.id, syncConfig.googleConnectionId!));

    if (!googleConn || (!googleConn.refreshToken && !googleConn.accessToken)) {
      return NextResponse.json(
        { error: "Google connection not found or not authorized" },
        { status: 400 }
      );
    }

    // 5. List Google Docs from the configured folder
    const folderId = googleConn.folderId;
    const googleToken = googleConn.refreshToken || googleConn.accessToken!;
    const isAccessToken = !googleConn.refreshToken;
    const files = await listFilesInFolder(folderId!, googleToken, !isAccessToken);

    // 6. Filter only Google Docs
    const googleDocs = files.filter(
      (file) => file.mimeType === "application/vnd.google-apps.document"
    );

    return NextResponse.json(
      {
        success: true,
        documents: googleDocs,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get documents error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
