import { db } from "@/lib/database";
import { syncHistory, documents, syncConfigs, githubConnections, googleConnections } from "@/db/schema";
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
import { extractImageUrls, processImagesInMarkdown } from "@/lib/cloudinary";
import { createGitHubWorkflow } from "@/lib/github";
import { getGoogleDoc } from "@/lib/google";

export interface SyncResult {
  success: boolean;
  commitSha?: string;
  prUrl?: string;
  prNumber?: number;
  filesChanged?: number;
  errorMessage?: string;
}

export interface SyncOptions {
  docId: string;
  configId: string;
  userId: string;
}

/**
 * Main sync execution function
 * Orchestrates the entire workflow: Google Doc → Markdown → Images → GitHub PR
 */
export async function executeSync({ docId, configId, userId }: SyncOptions): Promise<SyncResult> {
  const startTime = new Date();
  let syncHistoryId: string | undefined;

  try {
    // 1. Start sync history tracking
    const [historyEntry] = await db
      .insert(syncHistory)
      .values({
        syncConfigId: configId,
        docId,
        status: "pending",
        startedAt: startTime,
      })
      .returning({ id: syncHistory.id });

    syncHistoryId = historyEntry?.id;

    // 2. Fetch sync configuration
    const [syncConfig] = await db
      .select()
      .from(syncConfigs)
      .where(eq(syncConfigs.id, configId));

    if (!syncConfig) {
      throw new Error("Sync configuration not found");
    }

    // 3. Fetch GitHub connection
    const [githubConn] = await db
      .select()
      .from(githubConnections)
      .where(eq(githubConnections.id, syncConfig.githubConnectionId!));

    if (!githubConn || !githubConn.accessToken) {
      throw new Error("GitHub connection not found or not authorized");
    }

    // 4. Fetch Google connection
    const [googleConn] = await db
      .select()
      .from(googleConnections)
      .where(eq(googleConnections.id, syncConfig.googleConnectionId!));

    if (!googleConn || (!googleConn.refreshToken && !googleConn.accessToken)) {
      throw new Error("Google connection not found or not authorized");
    }

    // 5. Fetch Google Doc and convert to Markdown
    // Use refresh token if available, otherwise use access token
    const googleToken = googleConn.refreshToken || googleConn.accessToken!;
    const isAccessToken = !googleConn.refreshToken;
    const googleDoc = await getGoogleDoc(docId, googleToken, !isAccessToken);
    const converted = await convertGoogleDocToMarkdown(docId, googleToken, !isAccessToken);

    // 6. Process code blocks
    let markdownContent = processCodeBlocks(converted.content);

    // 7. Fix heading hierarchy
    markdownContent = fixHeadingHierarchy(markdownContent);

    // 8. Normalize list markers
    markdownContent = normalizeListMarkers(markdownContent);

    // 9. Cleanup whitespace
    markdownContent = cleanupWhitespace(markdownContent);

    // 10. Validate markdown
    const validation = validateMarkdown(markdownContent);
    if (!validation.valid) {
      console.warn("Markdown validation warnings:", validation.warnings);
    }

    // 11. Extract and process images (Cloudinary)
    const imageUrls = extractImageUrls(markdownContent);
    if (imageUrls.length > 0 && syncConfig.imageStrategy === "cloudinary") {
      markdownContent = await processImagesInMarkdown(markdownContent, imageUrls, {
        folder: `markdly/${syncConfig.name}`,
      });
    }

    // 12. Generate front matter
    const variables = extractVariablesFromContent(markdownContent, googleDoc.name);
    const template = syncConfig.frontmatterTemplate || getTemplateByFramework(syncConfig.framework || "nextjs");
    const frontMatter = generateFrontMatter(template, variables);
    const finalContent = wrapWithFrontMatter(markdownContent, frontMatter);

    // 13. Generate file path
    const fileName = googleDoc.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") + ".md";
    const filePath = `${syncConfig.outputPath || "content/"}${fileName}`;

    // 14. Generate branch name
    const branchName = `markdly/${googleDoc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

    // 15. Commit to GitHub and create PR
    const { commitSha, prNumber, prUrl } = await createGitHubWorkflow({
      owner: githubConn.repoOwner!,
      repo: githubConn.repoName!,
      filePath,
      content: finalContent,
      message: `docs: sync "${googleDoc.name}" from Google Docs\n\nAutomated sync from Markdly`,
      title: `docs: sync "${googleDoc.name}"`,
      body: `This PR was automatically created by Markdly to sync content from Google Docs.\n\n- **Document**: ${googleDoc.name}\n- **Source**: Google Docs\n- **Synced at**: ${new Date().toISOString()}`,
      accessToken: githubConn.accessToken!,
    });

    // 16. Update or create document tracking
    const existingDoc = await db
      .select()
      .from(documents)
      .where(eq(documents.googleDocId, docId));

    if (existingDoc.length > 0) {
      await db
        .update(documents)
        .set({
          title: googleDoc.name,
          lastSynced: new Date(),
          lastModified: new Date(),
          metadata: {
            filePath,
            commitSha,
            prNumber,
            prUrl,
          },
        })
        .where(eq(documents.googleDocId, docId));
    } else {
      await db
        .insert(documents)
        .values({
          syncConfigId: configId,
          googleDocId: docId,
          title: googleDoc.name,
          lastSynced: new Date(),
          lastModified: new Date(),
          metadata: {
            filePath,
            commitSha,
            prNumber,
            prUrl,
          },
        });
    }

    // 17. Update sync history with success
    await db
      .update(syncHistory)
      .set({
        status: "success",
        commitSha,
        filesChanged: "1",
        completedAt: new Date(),
      })
      .where(eq(syncHistory.id, syncHistoryId!));

    return {
      success: true,
      commitSha,
      prNumber,
      prUrl,
      filesChanged: 1,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    // Update sync history with failure
    if (syncHistoryId) {
      await db
        .update(syncHistory)
        .set({
          status: "failed",
          errorMessage,
          completedAt: new Date(),
        })
        .where(eq(syncHistory.id, syncHistoryId));
    }

    return {
      success: false,
      errorMessage,
    };
  }
}

/**
 * Get sync history for a sync config
 */
export async function getSyncHistory(syncConfigId: string, limit = 20) {
  return db
    .select()
    .from(syncHistory)
    .where(eq(syncHistory.syncConfigId, syncConfigId))
    .orderBy(syncHistory.startedAt)
    .limit(limit);
}

/**
 * Get tracked documents for a sync config
 */
export async function getTrackedDocuments(syncConfigId: string) {
  return db
    .select()
    .from(documents)
    .where(eq(documents.syncConfigId, syncConfigId))
    .orderBy(documents.lastSynced);
}
