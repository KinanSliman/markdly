import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/database";
import { accounts, workspaces, githubConnections, googleConnections } from "@/db/schema";
import { and, eq } from "drizzle-orm";

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
      // Delete GitHub connections
      if (workspace) {
        await db
          .delete(githubConnections)
          .where(eq(githubConnections.workspaceId, workspace.id));
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
      // Delete Google connections
      if (workspace) {
        await db
          .delete(googleConnections)
          .where(eq(googleConnections.workspaceId, workspace.id));
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
