import { db } from "@/lib/database";
import { syncHistory, documents, syncConfigs, githubConnections, googleConnections } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  convertGoogleDocToMarkdown,
  processCodeBlocks,
  fixHeadingHierarchy,
  cleanupWhitespace,
  validateMarkdown,
  normalizeListMarkers
} from "@/lib/markdown/converter";
import { generateFrontMatter, wrapWithFrontMatter, getTemplateByFramework, extractVariablesFromContent } from "@/lib/markdown/frontmatter";
import { createGitHubWorkflow } from "@/lib/github";
import { getGoogleDoc, refreshGoogleAccessToken } from "@/lib/google";
import { trackSync } from "@/lib/analytics";
import { hashGoogleDoc } from "@/lib/utils/hashing";
import { detectDocumentChanges, shouldSkipSync, getChangeDescription } from "@/lib/sync/change-detector";

export interface SyncResult {
  success: boolean;
  commitSha?: string;
  prUrl?: string;
  prNumber?: number;
  filesChanged?: number;
  errorMessage?: string;
  skipped?: boolean;
  skipReason?: string;
  changeType?: string;
}

export interface SyncOptions {
  docId: string;
  configId: string;
  userId: string;
  skipUnchanged?: boolean; // Skip sync if content hasn't changed
}

/**
 * Main sync execution function
 * Orchestrates the entire workflow: Google Doc → Images to Cloudinary → Markdown → GitHub PR
 */
export async function executeSync({ docId, configId, userId, skipUnchanged = true }: SyncOptions): Promise<SyncResult> {
  const startTime = new Date();
  let syncHistoryId: string | undefined;

  try {
    // 1. Start sync history tracking
    const [historyEntry] = await db
      .insert(syncHistory)
      .values({
        userId,
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

    // 3. Fetch GitHub connection (only for github mode)
    let githubConn = null;
    if (syncConfig.mode === "github") {
      [githubConn] = await db
        .select()
        .from(githubConnections)
        .where(eq(githubConnections.id, syncConfig.githubConnectionId!));

      if (!githubConn || !githubConn.accessToken) {
        throw new Error("GitHub connection not found or not authorized");
      }
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
    let googleToken = googleConn.refreshToken || googleConn.accessToken!;
    let isAccessToken = !googleConn.refreshToken;
    let googleDoc;
    let converted;

    // Determine Cloudinary folder based on sync config
    const cloudinaryFolder = syncConfig.imageStrategy === "cloudinary"
      ? `markdly/${syncConfig.name}`
      : undefined;

    try {
      googleDoc = await getGoogleDoc(docId, googleToken, !isAccessToken);
      converted = await convertGoogleDocToMarkdown(docId, googleToken, !isAccessToken, cloudinaryFolder);
    } catch (error) {
      // If the error is "Invalid Credentials", try refreshing the access token
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("Invalid Credentials") || errorMessage.includes("invalid_grant")) {
        console.log("Google access token expired, refreshing...");

        if (googleConn.refreshToken) {
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
            throw new Error(`Failed to refresh Google access token: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`);
          }
        } else {
          throw new Error("Google access token expired and no refresh token available. Please reconnect your Google account.");
        }
      } else {
        throw error;
      }
    }

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

    // 11. Generate front matter
    const variables = extractVariablesFromContent(markdownContent, googleDoc.name);
    const template = syncConfig.frontmatterTemplate || getTemplateByFramework(syncConfig.framework || "nextjs");
    const frontMatter = generateFrontMatter(template, variables);
    const finalContent = wrapWithFrontMatter(markdownContent, frontMatter);

    // 12. Generate file path
    const fileName = googleDoc.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") + ".md";
    const filePath = `${syncConfig.outputPath || "content/"}${fileName}`;

    // 13. CHANGE DETECTION - Check if content has changed
    const [existingDoc] = await db
      .select()
      .from(documents)
      .where(eq(documents.googleDocId, docId));

    const changeResult = detectDocumentChanges(
      existingDoc?.metadata?.content || null,
      finalContent,
      existingDoc ? {
        title: existingDoc.title,
        contentHash: existingDoc.contentHash,
        paragraphCount: existingDoc.metadata?.paragraphCount,
        tableCount: existingDoc.metadata?.tableCount,
        imageCount: existingDoc.metadata?.imageCount,
      } : null,
      {
        title: googleDoc.name,
        paragraphCount: converted.metadata?.paragraphCount,
        tableCount: converted.metadata?.tableCount,
        imageCount: converted.metadata?.imageCount,
      },
      docId
    );

    const shouldSkip = shouldSkipSync(changeResult, { skipUnchanged });

    if (shouldSkip) {
      // Content unchanged - skip sync
      const skipReason = getChangeDescription(changeResult);

      // Update sync history with skipped status
      await db
        .update(syncHistory)
        .set({
          status: "skipped",
          docTitle: googleDoc.name,
          contentHash: changeResult.hashComparison.newHash,
          changeType: changeResult.summary.changeType,
          changeReason: skipReason,
          completedAt: new Date(),
        })
        .where(eq(syncHistory.id, syncHistoryId!));

      // Update document tracking with new hash
      if (existingDoc) {
        await db
          .update(documents)
          .set({
            title: googleDoc.name,
            lastSynced: new Date(),
            contentHash: changeResult.hashComparison.newHash,
            contentSize: finalContent.length,
            metadata: {
              ...existingDoc.metadata,
              paragraphCount: converted.metadata?.paragraphCount,
              tableCount: converted.metadata?.tableCount,
              imageCount: converted.metadata?.imageCount,
            },
          })
          .where(eq(documents.googleDocId, docId));
      }

      return {
        success: true,
        skipped: true,
        skipReason,
        changeType: changeResult.summary.changeType,
        filesChanged: 0,
      };
    }

    // 14. Handle sync based on mode (only if content changed)
    let commitSha: string | undefined;
    let prNumber: number | undefined;
    let prUrl: string | undefined;

    if (syncConfig.mode === "github") {
      // Generate branch name
      const branchName = `markdly/${googleDoc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

      // Commit to GitHub and create PR
      const result = await createGitHubWorkflow({
        owner: githubConn!.repoOwner!,
        repo: githubConn!.repoName!,
        filePath,
        content: finalContent,
        message: `docs: sync "${googleDoc.name}" from Google Docs\n\nAutomated sync from Markdly`,
        title: `docs: sync "${googleDoc.name}"`,
        body: `This PR was automatically created by Markdly to sync content from Google Docs.\n\n- **Document**: ${googleDoc.name}\n- **Source**: Google Docs\n- **Synced at**: ${new Date().toISOString()}\n- **Change**: ${changeResult.summary.reason}`,
        accessToken: githubConn!.accessToken!,
      });
      commitSha = result.commitSha;
      prNumber = result.prNumber;
      prUrl = result.prUrl;
    } else {
      // Convert-only mode: generate a commit SHA for tracking (random UUID)
      commitSha = randomUUID();
    }

    // 15. Update or create document tracking
    if (existingDoc) {
      await db
        .update(documents)
        .set({
          title: googleDoc.name,
          lastSynced: new Date(),
          lastModified: new Date(),
          contentHash: changeResult.hashComparison.newHash,
          contentSize: finalContent.length,
          metadata: {
            filePath,
            commitSha,
            prNumber,
            prUrl,
            paragraphCount: converted.metadata?.paragraphCount,
            tableCount: converted.metadata?.tableCount,
            imageCount: converted.metadata?.imageCount,
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
          contentHash: changeResult.hashComparison.newHash,
          contentSize: finalContent.length,
          metadata: {
            filePath,
            commitSha,
            prNumber,
            prUrl,
            paragraphCount: converted.metadata?.paragraphCount,
            tableCount: converted.metadata?.tableCount,
            imageCount: converted.metadata?.imageCount,
          },
        });
    }

    // 16. Update sync history with success
    await db
      .update(syncHistory)
      .set({
        status: "success",
        docTitle: googleDoc.name,
        commitSha,
        filePath,
        filesChanged: "1",
        contentHash: changeResult.hashComparison.newHash,
        changeType: changeResult.summary.changeType,
        changeReason: changeResult.summary.reason,
        completedAt: new Date(),
      })
      .where(eq(syncHistory.id, syncHistoryId!));

    // 17. Track analytics event
    await trackSync(userId, configId, syncConfig.mode, true, {
      docTitle: googleDoc.name,
      filePath,
      prUrl,
      changeType: changeResult.summary.changeType,
    });

    return {
      success: true,
      commitSha,
      prNumber,
      prUrl,
      filesChanged: 1,
      changeType: changeResult.summary.changeType,
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

    // Track failed sync analytics
    try {
      const [syncConfig] = await db
        .select()
        .from(syncConfigs)
        .where(eq(syncConfigs.id, configId));

      if (syncConfig) {
        await trackSync(userId, configId, syncConfig.mode, false, {
          errorMessage,
        });
      }
    } catch (e) {
      // Ignore analytics errors during error handling
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

/**
 * Get the last sync hash for a document
 */
export async function getLastSyncHash(docId: string): Promise<string | null> {
  const [doc] = await db
    .select({ contentHash: documents.contentHash })
    .from(documents)
    .where(eq(documents.googleDocId, docId));

  return doc?.contentHash || null;
}

/**
 * Get sync statistics with change detection insights
 */
export async function getSyncStats(syncConfigId: string) {
  const history = await db
    .select()
    .from(syncHistory)
    .where(eq(syncHistory.syncConfigId, syncConfigId))
    .orderBy(desc(syncHistory.startedAt))
    .limit(100);

  const stats = {
    total: history.length,
    successful: history.filter(h => h.status === 'success').length,
    failed: history.filter(h => h.status === 'failed').length,
    skipped: history.filter(h => h.status === 'skipped').length,
    byChangeType: {} as Record<string, number>,
    lastSync: history[0]?.startedAt,
  };

  // Count by change type
  for (const entry of history) {
    if (entry.changeType) {
      stats.byChangeType[entry.changeType] = (stats.byChangeType[entry.changeType] || 0) + 1;
    }
  }

  return stats;
}
