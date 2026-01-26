import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/database";
import { syncConfigs, googleConnections, workspaces, accounts, documents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  convertGoogleDocToMarkdown,
  processCodeBlocks,
  fixHeadingHierarchy,
  cleanupWhitespace,
  validateMarkdown,
  normalizeListMarkers
} from "@/lib/markdown/converter";
import { generateFrontMatter, wrapWithFrontMatter, getTemplateByFramework, extractVariablesFromContent } from "@/lib/markdown/frontmatter";
import { getGoogleDoc, refreshGoogleAccessToken } from "@/lib/google";

/**
 * POST /api/convert-and-download
 * Converts a Google Doc to Markdown and returns the content for download
 * This is for "convert-only" mode - no GitHub sync
 */
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { docId, configId } = body;

    if (!docId) {
      return NextResponse.json(
        { error: "docId is required" },
        { status: 400 }
      );
    }

    // Get user's workspace
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerId, session.user.id!));

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Get sync config (if provided)
    let syncConfig = null;
    if (configId) {
      [syncConfig] = await db
        .select()
        .from(syncConfigs)
        .where(eq(syncConfigs.id, configId));
    }

    // Get Google connection
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

    // Get Google connection for token refresh
    let [googleConn] = await db
      .select()
      .from(googleConnections)
      .where(eq(googleConnections.workspaceId, workspace.id));

    // Use access token from accounts table (most fresh)
    let googleToken = googleAccount.access_token;
    let isAccessToken = true;
    let googleDoc;
    let converted;

    // Determine Cloudinary folder based on sync config
    const cloudinaryFolder = syncConfig && syncConfig.imageStrategy === "cloudinary"
      ? `markdly/${syncConfig.name}`
      : undefined;

    try {
      googleDoc = await getGoogleDoc(docId, googleToken, isAccessToken);
      converted = await convertGoogleDocToMarkdown(docId, googleToken, isAccessToken, cloudinaryFolder);
    } catch (error) {
      // If the error is "Invalid Credentials", try refreshing the access token
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("Invalid Credentials") || errorMessage.includes("invalid_grant")) {
        console.log("Google access token expired, refreshing...");

        if (googleConn?.refreshToken) {
          try {
            const { access_token } = await refreshGoogleAccessToken(googleConn.refreshToken);

            // Update the Google connection with the new access token
            await db
              .update(googleConnections)
              .set({ accessToken: access_token })
              .where(eq(googleConnections.id, googleConn.id));

            // Retry with the new access token
            googleToken = access_token;
            isAccessToken = true;
            googleDoc = await getGoogleDoc(docId, googleToken, true);
            converted = await convertGoogleDocToMarkdown(docId, googleToken, true, cloudinaryFolder);
          } catch (refreshError) {
            return NextResponse.json(
              { error: `Failed to refresh Google access token: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}` },
              { status: 500 }
            );
          }
        } else {
          return NextResponse.json(
            { error: "Google access token expired and no refresh token available. Please reconnect your Google account." },
            { status: 400 }
          );
        }
      } else {
        throw error;
      }
    }

    // Process code blocks
    let markdownContent = processCodeBlocks(converted.content);

    // Fix heading hierarchy
    markdownContent = fixHeadingHierarchy(markdownContent);

    // Normalize list markers
    markdownContent = normalizeListMarkers(markdownContent);

    // Cleanup whitespace
    markdownContent = cleanupWhitespace(markdownContent);

    // Validate markdown
    const validation = validateMarkdown(markdownContent);
    if (!validation.valid) {
      console.warn("Markdown validation warnings:", validation.warnings);
    }

    // Generate front matter
    const variables = extractVariablesFromContent(markdownContent, googleDoc.name);
    const template = syncConfig?.frontmatterTemplate || getTemplateByFramework(syncConfig?.framework || "nextjs");
    const frontMatter = generateFrontMatter(template, variables);
    const finalContent = wrapWithFrontMatter(markdownContent, frontMatter);

    // Generate file name
    const fileName = googleDoc.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") + ".md";

    // Return the markdown content as a downloadable response
    return new NextResponse(finalContent, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Convert and download error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to convert document" },
      { status: 500 }
    );
  }
}
