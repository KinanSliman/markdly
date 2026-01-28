/**
 * Pipeline-Based Google Doc to Markdown Converter
 *
 * This is the new modular converter using the pipeline architecture.
 * It provides better maintainability, testability, and performance.
 */

import { createDefaultPipeline, PipelineOutput } from './pipeline';
import { GoogleDocContent, ConversionWarning } from './converter';

/**
 * Converts a Google Doc to Markdown using the new pipeline architecture
 *
 * @param docId - Google Doc ID or URL
 * @param token - Google OAuth access token or refresh token
 * @param isAccessToken - Whether the token is an access token (default: true)
 * @param cloudinaryFolder - Optional Cloudinary folder for image uploads
 * @returns Promise<GoogleDocContent> - Converted content with metadata
 */
export async function convertGoogleDocToMarkdownWithPipeline(
  docId: string,
  token: string,
  isAccessToken = true,
  cloudinaryFolder?: string
): Promise<GoogleDocContent> {
  try {
    // Use the new pipeline architecture
    const pipeline = createDefaultPipeline();

    const result: PipelineOutput = await pipeline.execute({
      docId,
      token,
      isAccessToken,
      cloudinaryFolder,
    });

    // Convert PipelineOutput to GoogleDocContent for backward compatibility
    const images: Array<{ url: string; alt: string }> = [];
    const headings: Array<{ text: string; level: number }> = [];
    const tables: Array<{ rows: string[][] }> = [];

    return {
      title: result.metadata.title,
      content: result.content,
      images,
      headings,
      tables,
      warnings: result.warnings,
    };
  } catch (error: any) {
    console.error("Error converting Google Doc:", error);
    throw new Error(`Failed to convert Google Doc: ${error.message}`);
  }
}

/**
 * Converts a Google Doc to Markdown using demo mode (no image processing)
 *
 * @param docId - Google Doc ID or URL
 * @param token - Google OAuth access token
 * @returns Promise<GoogleDocContent> - Converted content with metadata
 */
export async function convertGoogleDocToMarkdownDemo(
  docId: string,
  token: string
): Promise<GoogleDocContent> {
  try {
    // Use demo pipeline (no image processing)
    const pipeline = createDefaultPipeline();

    const result: PipelineOutput = await pipeline.execute({
      docId,
      token,
      isAccessToken: true,
      cloudinaryFolder: undefined, // No image processing for demo
    });

    return {
      title: result.metadata.title,
      content: result.content,
      images: [],
      headings: [],
      tables: [],
      warnings: result.warnings,
    };
  } catch (error: any) {
    console.error("Error converting Google Doc (demo):", error);
    throw new Error(`Failed to convert Google Doc: ${error.message}`);
  }
}

/**
 * Gets conversion metrics from a pipeline output
 *
 * @param result - Pipeline output from conversion
 * @returns Performance metrics and statistics
 */
export function getConversionMetrics(result: PipelineOutput) {
  return {
    // Performance metrics
    totalTime: result.metrics.totalTime,
    fetchTime: result.metrics.fetchTime,
    parseTime: result.metrics.parseTime,
    processTime: result.metrics.processTime,
    imageUploadTime: result.metrics.imageUploadTime,
    formatTime: result.metrics.formatTime,
    validateTime: result.metrics.validateTime,

    // Document statistics
    title: result.metadata.title,
    paragraphCount: result.metadata.paragraphCount,
    tableCount: result.metadata.tableCount,
    imageCount: result.metadata.imageCount,
    codeBlockCount: result.metadata.codeBlockCount,
    headingCount: result.metadata.headingCount,
    characterCount: result.metadata.characterCount,

    // Warnings
    warningCount: result.warnings.length,
    warnings: result.warnings,
  };
}

/**
 * Validates a Google Doc ID
 *
 * @param docId - Google Doc ID or URL to validate
 * @returns The extracted document ID
 * @throws Error if the document ID is invalid
 */
export function validateGoogleDocId(docId: string): string {
  // Extract ID from URL if needed
  const urlMatch = docId.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch) {
    return urlMatch[1];
  }

  // Check if it's a valid document ID format
  const idPattern = /^[a-zA-Z0-9-_]+$/;
  if (!idPattern.test(docId)) {
    throw new Error('Invalid Google Doc ID format');
  }

  return docId;
}

/**
 * Converts a Google Doc URL to a document ID
 *
 * @param url - Google Doc URL
 * @returns Extracted document ID
 */
export function extractDocIdFromUrl(url: string): string {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    throw new Error('Invalid Google Doc URL format');
  }
  return match[1];
}
