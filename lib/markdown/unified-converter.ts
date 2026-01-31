/**
 * Unified Google Doc to Markdown Converter - BULLETPROOF EDITION
 *
 * This is the single source of truth for document conversion.
 * Features:
 * - Security hardened against ReDoS and injection attacks
 * - Optimized parallel processing for images
 * - Comprehensive error handling with retry logic
 * - Smart caching with complete data preservation
 * - Advanced code detection with minimal false positives
 * - Robust table and list processing
 * - Complete HTML entity support
 *
 * SUPPORTED FORMATS:
 * - Google Docs (via Google Docs API)
 * - .docx files (via mammoth.js)
 *
 * NOTE: .doc format (legacy Microsoft Word) is NOT supported.
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as mammoth from 'mammoth';
import { uploadImageToCloudinary } from '@/lib/cloudinary';
import { createConversionCache, hashString } from '@/lib/cache';
import type { ConversionCacheManager } from '@/lib/cache';

// ============================================================================
// Constants
// ============================================================================

const MAX_INPUT_SIZE = 50 * 1024 * 1024; // 50MB max input
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
const IMAGE_UPLOAD_CONCURRENCY = 5; // Process 5 images at a time
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds

// Code detection thresholds
const MONOSPACE_FONTS = ['Courier New', 'Consolas', 'Monaco', 'monospace', 'Courier', 'Source Code Pro'];
const SMALL_FONT_SIZE = 10; // Points
const CODE_INDENTATION = 4; // Spaces

// ============================================================================
// Types
// ============================================================================

export interface ConversionInput {
  /** Google Doc ID or URL (for Google Docs) */
  docId?: string;
  /** Google OAuth access token (for Google Docs) */
  token?: string;
  /** Whether token is an access token (true) or refresh token (false) */
  isAccessToken?: boolean;
  /** Cloudinary folder for image uploads */
  cloudinaryFolder?: string;
  /** File content for .docx conversion (base64 or buffer) */
  fileContent?: Buffer | string;
  /** File name for .docx conversion */
  fileName?: string;
  /** Demo mode - skip image processing */
  isDemo?: boolean;
}

export interface ConversionOutput {
  title: string;
  content: string;
  images: Array<{ url: string; alt: string }>;
  headings: Array<{ text: string; level: number }>;
  tables: Array<{ rows: string[][] }>;
  warnings: ConversionWarning[];
  metrics?: ConversionMetrics;
  originalContent?: string;
  cached?: boolean;
}

export interface ConversionWarning {
  type: 'code_block' | 'heading' | 'table' | 'list' | 'formatting' | 'image' | 'security';
  message: string;
  suggestion: string;
  context?: string;
  severity?: 'low' | 'medium' | 'high';
}

export interface ConversionMetrics {
  totalTime: number;
  stages: Record<string, number>;
  cached?: boolean;
  imageCount?: number;
  parallelProcessing?: boolean;
}

interface ListState {
  currentListId: string | null;
  currentNestingLevel: number;
  isNumbered: boolean;
  lastParagraphWasList: boolean;
}

interface HeadingState {
  lastLevel: number;
  skippedLevels: number;
}

// ============================================================================
// Cache Manager (Singleton)
// ============================================================================

let cacheManager: ConversionCacheManager | null = null;

async function getCacheManager(): Promise<ConversionCacheManager> {
  if (!cacheManager) {
    cacheManager = await createConversionCache({
      maxSize: 1000,
      defaultTTL: 3600000, // 1 hour
      enableMetrics: true,
    });
  }
  return cacheManager;
}

// ============================================================================
// Main Conversion Functions
// ============================================================================

/**
 * Converts a Google Doc to Markdown
 * Uses the Google Docs API to fetch and convert the document
 */
export async function convertGoogleDocToMarkdown(
  docId: string,
  token: string,
  isAccessToken = true,
  cloudinaryFolder?: string,
  isDemo = false
): Promise<ConversionOutput> {
  const startTime = performance.now();
  const stages: Record<string, number> = {};

  try {
    // Validate inputs
    validateDocId(docId);
    validateToken(token);

    // Stage 1: Fetch document from Google Docs API
    const fetchStart = performance.now();
    const document = await fetchGoogleDoc(docId, token, isAccessToken);
    stages.fetch = performance.now() - fetchStart;

    // Stage 2: Parse document structure
    const parseStart = performance.now();
    const { paragraphs, tables, images, title } = parseDocument(document);
    stages.parse = performance.now() - parseStart;

    // Stage 3: Process content to Markdown
    const processStart = performance.now();
    const { markdown, warnings, headings } = processContent(paragraphs, tables, images);
    stages.process = performance.now() - processStart;

    // Stage 4: Process images (skip in demo mode)
    let finalMarkdown = markdown;
    if (!isDemo && cloudinaryFolder && images.length > 0) {
      const imageStart = performance.now();
      finalMarkdown = await processImagesParallel(
        markdown,
        images,
        token,
        isAccessToken,
        cloudinaryFolder
      );
      stages.imageUpload = performance.now() - imageStart;
    }

    // Stage 5: Format and validate
    const formatStart = performance.now();
    const formatted = formatMarkdown(finalMarkdown);
    stages.format = performance.now() - formatStart;

    const totalTime = performance.now() - startTime;

    return {
      title,
      content: formatted.content,
      images: formatted.images,
      headings,
      tables: formatted.tables,
      warnings: [...warnings, ...formatted.warnings],
      metrics: {
        totalTime,
        stages,
        imageCount: images.length,
        parallelProcessing: images.length > 1,
      },
    };
  } catch (error: any) {
    console.error('Error converting Google Doc:', error);
    throw new Error(`Failed to convert Google Doc: ${sanitizeErrorMessage(error.message)}`);
  }
}

/**
 * Converts a .docx file to Markdown
 * Uses mammoth.js for conversion
 */
export async function convertDocxToMarkdown(
  fileContent: Buffer | string,
  fileName?: string,
  cloudinaryFolder?: string,
  isDemo = false
): Promise<ConversionOutput> {
  const startTime = performance.now();
  const stages: Record<string, number> = {};

  try {
    // Validate file extension - only .docx is supported
    if (fileName) {
      const extension = fileName.toLowerCase().split('.').pop();
      if (extension === 'doc') {
        throw new Error(
          'Unsupported file format: .doc files are not supported. ' +
          'Please convert your file to .docx format first. ' +
          'You can do this by opening the file in Microsoft Word or Google Docs and saving it as .docx.'
        );
      }
      if (!['docx', 'DOCX'].includes(extension || '')) {
        throw new Error(
          `Unsupported file format: .${extension}. Only .docx files are supported.`
        );
      }
    }

    // Convert to buffer and validate size
    const convertStart = performance.now();
    const buffer = Buffer.isBuffer(fileContent)
      ? fileContent
      : Buffer.from(fileContent, 'base64');

    if (buffer.length > MAX_INPUT_SIZE) {
      throw new Error(
        `File size exceeds maximum limit of ${MAX_INPUT_SIZE / 1024 / 1024}MB`
      );
    }

    // Convert .docx to HTML using mammoth.js
    const htmlResult = await mammoth.convertToHtml({ buffer });
    const html = htmlResult.value;
    stages.convert = performance.now() - convertStart;

    // Extract raw text for original content preview
    const textResult = await mammoth.extractRawText({ buffer });
    const originalContent = textResult.value
      .replace(/\n{4,}/g, '\n\n')
      .replace(/[ \t]+$/gm, '')
      .trim();

    // Parse HTML to Markdown
    const parseStart = performance.now();
    const { markdown, warnings, headings, tables, images } = parseHtmlToMarkdown(html);
    stages.parse = performance.now() - parseStart;

    // Process images (skip in demo mode)
    let finalMarkdown = markdown;
    if (!isDemo && cloudinaryFolder && images.length > 0) {
      const imageStart = performance.now();
      finalMarkdown = await processImagesForFileParallel(
        markdown,
        images,
        cloudinaryFolder
      );
      stages.imageUpload = performance.now() - imageStart;
    }

    // Format and validate
    const formatStart = performance.now();
    const formatted = formatMarkdown(finalMarkdown);
    stages.format = performance.now() - formatStart;

    const totalTime = performance.now() - startTime;
    const title = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'Document';

    return {
      title,
      content: formatted.content,
      images: formatted.images,
      headings,
      tables: formatted.tables,
      warnings: [...warnings, ...formatted.warnings],
      metrics: {
        totalTime,
        stages,
        imageCount: images.length,
        parallelProcessing: images.length > 1,
      },
      originalContent,
    };
  } catch (error: any) {
    console.error('Error converting .docx file:', error);
    throw new Error(`Failed to convert .docx file: ${sanitizeErrorMessage(error.message)}`);
  }
}

// ============================================================================
// Validation Functions
// ============================================================================

function validateDocId(docId: string): void {
  if (!docId || typeof docId !== 'string') {
    throw new Error('Invalid document ID');
  }
  if (docId.length > 200) {
    throw new Error('Document ID too long');
  }
  // Google Doc IDs are alphanumeric with hyphens and underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(docId)) {
    throw new Error('Invalid document ID format');
  }
}

function validateToken(token: string): void {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid authentication token');
  }
  if (token.length > 10000) {
    throw new Error('Authentication token too long');
  }
}

function sanitizeErrorMessage(message: string): string {
  // Remove sensitive information from error messages
  return message
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
    .replace(/token[=:]\s*[^\s&]+/gi, 'token=[REDACTED]')
    .replace(/key[=:]\s*[^\s&]+/gi, 'key=[REDACTED]');
}

// ============================================================================
// Google Docs API Functions
// ============================================================================

async function fetchGoogleDoc(
  docId: string,
  token: string,
  isAccessToken: boolean
): Promise<any> {
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  if (isAccessToken) {
    oauth2Client.setCredentials({ access_token: token });
  } else {
    oauth2Client.setCredentials({ refresh_token: token });
  }

  const docs = google.docs({ version: 'v1', auth: oauth2Client });

  const response = await docs.documents.get({
    documentId: docId,
  });

  if (!response.data) {
    throw new Error('Empty response from Google Docs API');
  }

  return response.data;
}

// ============================================================================
// Parsing Functions
// ============================================================================

function parseDocument(document: any): {
  title: string;
  paragraphs: any[];
  tables: any[];
  images: Array<{ url: string; alt: string }>;
} {
  const title = document.title || 'Untitled Document';
  const paragraphs: any[] = [];
  const tables: any[] = [];
  const images: Array<{ url: string; alt: string }> = [];

  // Extract inline images
  const inlineImages = extractInlineImages(document);

  if (document.body && document.body.content) {
    for (const element of document.body.content) {
      if (element.paragraph) {
        paragraphs.push(element.paragraph);
      } else if (element.table) {
        tables.push(element.table);
      }
    }
  }

  return { title, paragraphs, tables, images: inlineImages };
}

function extractInlineImages(document: any): Array<{ url: string; alt: string }> {
  const images: Array<{ url: string; alt: string }> = [];

  if (document.inlineObjects) {
    for (const [objectId, inlineObject] of Object.entries(document.inlineObjects)) {
      const embeddedObject = (inlineObject as any).inlineObjectProperties?.embeddedObject;
      const imageProps = embeddedObject?.imageProperties;

      if (imageProps?.contentUri || imageProps?.sourceUri) {
        images.push({
          url: imageProps.contentUri || imageProps.sourceUri,
          alt: sanitizeText(embeddedObject?.title || 'image'),
        });
      }
    }
  }

  return images;
}

// ============================================================================
// Content Processing Functions
// ============================================================================

function processContent(
  paragraphs: any[],
  tables: any[],
  images: Array<{ url: string; alt: string }>
): {
  markdown: string;
  warnings: ConversionWarning[];
  headings: Array<{ text: string; level: number }>;
} {
  let markdown = '';
  const warnings: ConversionWarning[] = [];
  const headings: Array<{ text: string; level: number }> = [];

  // Track list state with proper reset logic
  const listState: ListState = {
    currentListId: null,
    currentNestingLevel: 0,
    isNumbered: false,
    lastParagraphWasList: false,
  };

  // Track heading hierarchy
  const headingState: HeadingState = {
    lastLevel: 0,
    skippedLevels: 0,
  };

  // Process paragraphs
  for (const paragraph of paragraphs) {
    const result = processParagraph(
      paragraph,
      images,
      headings,
      listState,
      headingState,
      warnings
    );
    markdown += result;
  }

  // Process tables
  for (const table of tables) {
    const { markdown: tableMarkdown, warnings: tableWarnings } = processTable(table);
    markdown += tableMarkdown;
    warnings.push(...tableWarnings);
  }

  return { markdown, warnings, headings };
}

function processParagraph(
  paragraph: any,
  images: Array<{ url: string; alt: string }>,
  headings: Array<{ text: string; level: number }>,
  listState: ListState,
  headingState: HeadingState,
  warnings: ConversionWarning[]
): string {
  const elements = paragraph.elements || [];
  const paragraphStyle = paragraph.paragraphStyle;

  let text = '';
  let isHeading = false;
  let headingLevel = 0;
  let isCodeBlock = false;

  // Check for heading style
  if (paragraphStyle?.namedStyleType) {
    const style = paragraphStyle.namedStyleType;
    if (style.startsWith('HEADING_')) {
      isHeading = true;
      headingLevel = parseInt(style.replace('HEADING_', ''), 10);
    }
  }

  // Process text elements
  let previousStyle: any = null;
  for (const element of elements) {
    if (element.textRun) {
      const content = element.textRun.content || '';
      const textStyle = element.textRun.textStyle || {};

      let formattedText = content;

      // Enhanced code block detection
      const codeBlockDetection = detectCodeBlockInParagraph(textStyle, content, paragraphStyle);
      if (codeBlockDetection.isCodeBlock && !isCodeBlock) {
        isCodeBlock = true;
      }

      // Apply formatting (skip for code blocks)
      if (!isCodeBlock) {
        // Skip bold for headings
        if (textStyle.bold && !isHeading) {
          formattedText = `**${formattedText}**`;
        }
        if (textStyle.italic) {
          formattedText = `*${formattedText}*`;
        }
        if (textStyle.strikethrough) {
          formattedText = `~~${formattedText}~~`;
        }
        if (textStyle.underline && !textStyle.link) {
          formattedText = `<u>${formattedText}</u>`;
        }

        // Handle links with URL validation
        if (textStyle.link?.url) {
          const url = sanitizeUrl(textStyle.link.url);
          formattedText = `[${formattedText}](${url})`;
        }

        // Check if we need to merge with previous element
        if (previousStyle && shouldMergeWithPrevious(textStyle, previousStyle, isHeading)) {
          text = mergeAdjacentFormattedText(text, formattedText, textStyle, previousStyle, isHeading);
          previousStyle = textStyle;
          continue;
        }
      }

      text += formattedText;
      previousStyle = textStyle;
    } else if (element.inlineObjectElement) {
      // Handle inline images
      const inlineObjectId = element.inlineObjectElement.inlineObjectId;
      if (inlineObjectId) {
        const image = images.find((img) => img.url === inlineObjectId);
        if (image) {
          const altText = sanitizeText(image.alt || 'image');
          text += `![${altText}](${image.url})`;
        }
      }
      previousStyle = null;
    }
  }

  // Handle bullet points and numbered lists
  if (paragraph.bullet) {
    const nestingLevel = paragraph.bullet.nestingLevel || 0;
    const listId = paragraph.bullet.listId || null;
    const isNumbered = !!(listId && /^\d+/.test(listId));

    // Reset list state if we're starting a new list
    if (listState.currentListId !== listId && listState.lastParagraphWasList) {
      // Different list, reset nesting
      if (nestingLevel > 0) {
        warnings.push({
          type: 'list',
          message: 'New list started with non-zero nesting level',
          suggestion: 'Start new lists at nesting level 0',
          context: `List ID: ${listId}, Nesting: ${nestingLevel}`,
          severity: 'low',
        });
      }
    }

    // Warn about mixed list types within same list
    if (listState.currentListId === listId && listState.isNumbered !== isNumbered) {
      warnings.push({
        type: 'list',
        message: 'Mixed bullet and numbered list items in the same list',
        suggestion: 'Use consistent list types (all bullets or all numbers)',
        context: `List ID: ${listId}`,
        severity: 'medium',
      });
    }

    // Warn about large nesting jumps
    if (nestingLevel > listState.currentNestingLevel + 1 && listState.lastParagraphWasList) {
      warnings.push({
        type: 'list',
        message: `List nesting jumped from ${listState.currentNestingLevel} to ${nestingLevel}`,
        suggestion: "Don't skip nesting levels",
        context: `List ID: ${listId}`,
        severity: 'medium',
      });
    }

    listState.currentListId = listId;
    listState.currentNestingLevel = nestingLevel;
    listState.isNumbered = isNumbered;
    listState.lastParagraphWasList = true;

    const indent = '  '.repeat(nestingLevel);
    return isNumbered
      ? `${indent}1. ${text.trim()}\n`
      : `${indent}- ${text.trim()}\n`;
  }

  // Reset list state when not in a list
  if (listState.lastParagraphWasList) {
    listState.currentListId = null;
    listState.currentNestingLevel = 0;
    listState.lastParagraphWasList = false;
  }

  // Return formatted text
  if (isHeading) {
    // Validate heading hierarchy
    if (headingState.lastLevel > 0 && headingLevel > headingState.lastLevel + 1) {
      headingState.skippedLevels++;
      warnings.push({
        type: 'heading',
        message: `Heading level skipped from H${headingState.lastLevel} to H${headingLevel}`,
        suggestion: `Use H${headingState.lastLevel + 1} for proper document structure`,
        context: `Heading: "${text.trim()}"`,
        severity: 'medium',
      });
    }

    headingState.lastLevel = headingLevel;

    const prefix = '#'.repeat(headingLevel);
    const headingText = sanitizeText(text.trim());
    headings.push({ text: headingText, level: headingLevel });
    return `${prefix} ${headingText}\n\n`;
  } else if (isCodeBlock) {
    const language = detectCodeLanguage(text);
    const codeFence = language ? `\`\`\`${language}` : '```';

    if (!language) {
      warnings.push({
        type: 'code_block',
        message: 'Code block detected but language could not be determined',
        suggestion: 'Consider adding a language identifier manually',
        context: `Code: ${text.substring(0, 50)}...`,
        severity: 'low',
      });
    }

    return `${codeFence}\n${text.trim()}\n\`\`\`\n\n`;
  } else if (text.trim()) {
    return `${text.trim()}\n\n`;
  }

  return '';
}

function processTable(table: any): {
  markdown: string;
  warnings: ConversionWarning[];
} {
  const warnings: ConversionWarning[] = [];

  if (!table.tableRows || table.tableRows.length === 0) {
    return { markdown: '', warnings };
  }

  const rows = table.tableRows;
  const tableData: string[][] = [];
  let expectedColumnCount: number | null = null;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const rowData: string[] = [];
    const cells = row.tableCells || [];

    for (let cellIndex = 0; cellIndex < cells.length; cellIndex++) {
      const cell = cells[cellIndex];
      const cellContent = cell.content || [];
      let cellText = '';

      for (const content of cellContent) {
        if (content.paragraph) {
          const elements = content.paragraph.elements || [];
          for (const element of elements) {
            if (element.textRun?.content) {
              cellText += element.textRun.content;
            }
          }
        }
      }

      const sanitizedCell = sanitizeText(cellText.trim());

      // Check for empty cells
      if (!sanitizedCell) {
        warnings.push({
          type: 'table',
          message: 'Empty table cell detected',
          suggestion: "May indicate merged cell - Markdown doesn't support cell merging",
          context: `Row ${rowIndex + 1}, Cell ${cellIndex + 1}`,
          severity: 'low',
        });
      }

      rowData.push(sanitizedCell);
    }

    // Validate column count consistency
    if (expectedColumnCount === null) {
      expectedColumnCount = rowData.length;
    } else if (rowData.length !== expectedColumnCount) {
      warnings.push({
        type: 'table',
        message: `Inconsistent column count in table`,
        suggestion: 'Ensure all rows have the same number of columns',
        context: `Expected ${expectedColumnCount} columns, got ${rowData.length} in row ${rowIndex + 1}`,
        severity: 'high',
      });
    }

    tableData.push(rowData);
  }

  // Build Markdown table
  if (tableData.length === 0) {
    return { markdown: '', warnings };
  }

  // Check if we have at least a header and one data row
  if (tableData.length === 1) {
    warnings.push({
      type: 'table',
      message: 'Table has only a header row with no data',
      suggestion: 'Add at least one data row',
      severity: 'medium',
    });
  }

  const headers = tableData[0];
  const dataRows = tableData.slice(1);

  let markdown = '| ' + headers.join(' | ') + ' |\n';
  markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

  for (const row of dataRows) {
    // Pad row if it has fewer columns than header
    const paddedRow = [...row];
    while (paddedRow.length < headers.length) {
      paddedRow.push('');
    }
    markdown += '| ' + paddedRow.slice(0, headers.length).join(' | ') + ' |\n';
  }

  markdown += '\n';
  return { markdown, warnings };
}

// ============================================================================
// HTML to Markdown Parsing (SECURE VERSION)
// ============================================================================

function parseHtmlToMarkdown(html: string): {
  markdown: string;
  warnings: ConversionWarning[];
  headings: Array<{ text: string; level: number }>;
  tables: Array<{ rows: string[][] }>;
  images: Array<{ url: string; alt: string }>;
} {
  const warnings: ConversionWarning[] = [];
  const headings: Array<{ text: string; level: number }> = [];
  const tables: Array<{ rows: string[][] }> = [];
  const images: Array<{ url: string; alt: string }> = [];

  // Security: Check input size
  if (html.length > MAX_INPUT_SIZE) {
    throw new Error('HTML content exceeds maximum size limit');
  }

  let markdown = html;

  // SECURITY FIX: Use simple, non-backtracking removal for script/style tags
  // Instead of complex nested regex, use a simple iterative approach
  markdown = removeHtmlTags(markdown, 'script');
  markdown = removeHtmlTags(markdown, 'style');

  // Convert headings (priority order for specificity)
  for (let level = 1; level <= 6; level++) {
    const regex = new RegExp(`<h${level}[^>]*>(.*?)<\/h${level}>`, 'gi');
    markdown = markdown.replace(regex, (match, content) => {
      const text = sanitizeText(stripHtmlTags(content).trim());
      if (text) {
        headings.push({ text, level });
        return `${'#'.repeat(level)} ${text}\n\n`;
      }
      return '';
    });
  }

  // Convert bold and italic
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

  // Convert links with URL sanitization
  markdown = markdown.replace(/<a[^>]*href=["'](.*?)["'][^>]*>(.*?)<\/a>/gi, (match, url, text) => {
    const sanitizedUrl = sanitizeUrl(url);
    const sanitizedText = sanitizeText(text);
    return `[${sanitizedText}](${sanitizedUrl})`;
  });

  // Convert images with validation
  markdown = markdown.replace(
    /<img[^>]*src=["'](.*?)["'][^>]*alt=["'](.*?)["'][^>]*>/gi,
    (match, src, alt) => {
      const sanitizedSrc = sanitizeUrl(src);
      const sanitizedAlt = sanitizeText(alt);
      images.push({ url: sanitizedSrc, alt: sanitizedAlt });
      return `![${sanitizedAlt}](${sanitizedSrc})`;
    }
  );
  markdown = markdown.replace(/<img[^>]*src=["'](.*?)["'][^>]*>/gi, (match, src) => {
    const sanitizedSrc = sanitizeUrl(src);
    images.push({ url: sanitizedSrc, alt: '' });
    return `![](${sanitizedSrc})`;
  });

  // Convert paragraphs
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');

  // Convert line breaks
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');

  // Convert lists
  markdown = markdown.replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
    return content.replace(/<li[^>]*>(.*?)<\/li>/gi, (m: string, item: string) => `- ${item.trim()}\n`) + '\n';
  });
  markdown = markdown.replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, content) => {
    let i = 1;
    return content.replace(/<li[^>]*>(.*?)<\/li>/gi, (m: string, item: string) => `${i++}. ${item.trim()}\n`) + '\n';
  });

  // Convert code blocks
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  markdown = markdown.replace(/<pre[^>]*>(.*?)<\/pre>/gis, '```\n$1\n```\n\n');

  // Convert blockquotes
  markdown = markdown.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (match, content) => {
    return content
      .split('\n')
      .map((line: string) => line.trim() ? `> ${line}` : '')
      .join('\n') + '\n\n';
  });

  // Convert tables
  markdown = markdown.replace(/<table[^>]*>(.*?)<\/table>/gis, (match, content) => {
    const tableResult = convertHtmlTableToMarkdown(content);
    if (tableResult.markdown) {
      tables.push({ rows: tableResult.rows });
      return tableResult.markdown;
    }
    return '';
  });

  // Remove remaining HTML tags
  markdown = stripHtmlTags(markdown);

  // Decode HTML entities (COMPREHENSIVE)
  markdown = decodeHtmlEntities(markdown);

  // Clean up whitespace
  markdown = markdown
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

  return { markdown, warnings, headings, tables, images };
}

// SECURITY: Safe HTML tag removal without ReDoS vulnerability
function removeHtmlTags(html: string, tagName: string): string {
  const openTag = `<${tagName}`;
  const closeTag = `</${tagName}>`;

  let result = html;
  let attempts = 0;
  const maxAttempts = 1000; // Prevent infinite loops

  while (attempts < maxAttempts) {
    const startIndex = result.toLowerCase().indexOf(openTag.toLowerCase());
    if (startIndex === -1) break;

    const endIndex = result.toLowerCase().indexOf(closeTag.toLowerCase(), startIndex);
    if (endIndex === -1) {
      // Malformed tag, remove to end of string
      result = result.substring(0, startIndex);
      break;
    }

    result = result.substring(0, startIndex) + result.substring(endIndex + closeTag.length);
    attempts++;
  }

  return result;
}

function stripHtmlTags(html: string): string {
  // Simple tag stripper without complex regex
  return html.replace(/<[^>]+>/g, '');
}

function convertHtmlTableToMarkdown(htmlTable: string): {
  markdown: string;
  rows: string[][];
} {
  const rows: string[][] = [];
  const rowMatches = htmlTable.match(/<tr[^>]*>(.*?)<\/tr>/gis);

  if (!rowMatches) {
    return { markdown: '', rows: [] };
  }

  for (const rowMatch of rowMatches) {
    const cells: string[] = [];
    const cellMatches = rowMatch.match(/<t[dh][^>]*>(.*?)<\/t[dh]>/gis);

    if (cellMatches) {
      for (const cellMatch of cellMatches) {
        const content = cellMatch
          .replace(/<t[dh][^>]*>/, '')
          .replace(/<\/t[dh]>/, '')
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        cells.push(sanitizeText(content));
      }
    }

    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  if (rows.length === 0) {
    return { markdown: '', rows: [] };
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  let markdown = '| ' + headers.join(' | ') + ' |\n';
  markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

  for (const row of dataRows) {
    // Pad or trim to match header count
    const paddedRow = [...row];
    while (paddedRow.length < headers.length) {
      paddedRow.push('');
    }
    markdown += '| ' + paddedRow.slice(0, headers.length).join(' | ') + ' |\n';
  }

  markdown += '\n';
  return { markdown, rows };
}

// COMPREHENSIVE HTML entity decoder
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&copy;': 'Â©',
    '&reg;': 'Â®',
    '&trade;': 'â„¢',
    '&euro;': 'â‚¬',
    '&pound;': 'Â£',
    '&yen;': 'Â¥',
    '&cent;': 'Â¢',
    '&sect;': 'Â§',
    '&para;': 'Â¶',
    '&dagger;': 'â€ ',
    '&Dagger;': 'â€¡',
    '&bull;': 'â€¢',
    '&hellip;': 'â€¦',
    '&prime;': 'â€²',
    '&Prime;': 'â€³',
    '&lsaquo;': 'â€¹',
    '&rsaquo;': 'â€º',
    '&laquo;': 'Â«',
    '&raquo;': 'Â»',
    '&lsquo;': '\u2018',
    '&rsquo;': '\u2019',
    '&ldquo;': '\u201C',
    '&rdquo;': '\u201D',
    '&ndash;': 'â€“',
    '&mdash;': 'â€”',
    '&iexcl;': 'Â¡',
    '&iquest;': 'Â¿',
    '&divide;': 'Ã·',
    '&times;': 'Ã—',
    '&plusmn;': 'Â±',
    '&ne;': 'â‰ ',
    '&le;': 'â‰¤',
    '&ge;': 'â‰¥',
    '&infin;': 'âˆž',
    '&sum;': 'âˆ‘',
    '&prod;': 'âˆ',
    '&radic;': 'âˆš',
    '&int;': 'âˆ«',
    '&part;': 'âˆ‚',
    '&deg;': 'Â°',
    '&micro;': 'Âµ',
    '&alpha;': 'Î±',
    '&beta;': 'Î²',
    '&gamma;': 'Î³',
    '&delta;': 'Î´',
    '&epsilon;': 'Îµ',
    '&theta;': 'Î¸',
    '&lambda;': 'Î»',
    '&pi;': 'Ï€',
    '&sigma;': 'Ïƒ',
    '&tau;': 'Ï„',
    '&phi;': 'Ï†',
    '&omega;': 'Ï‰',
  };

  let result = text;

  // Replace named entities
  for (const [entity, char] of Object.entries(entities)) {
    result = result.split(entity).join(char);
  }

  // Replace numeric entities (&#123; and &#x7B;)
  result = result.replace(/&#(\d+);/g, (match, dec) => {
    return String.fromCharCode(parseInt(dec, 10));
  });
  result = result.replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  return result;
}

// ============================================================================
// Image Processing Functions (PARALLEL + RETRY)
// ============================================================================

async function processImagesParallel(
  markdown: string,
  images: Array<{ url: string; alt: string }>,
  token: string,
  isAccessToken: boolean,
  cloudinaryFolder: string
): Promise<string> {
  if (images.length === 0) return markdown;

  // Create OAuth2 client for fetching images
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  if (isAccessToken) {
    oauth2Client.setCredentials({ access_token: token });
  } else {
    oauth2Client.setCredentials({ refresh_token: token });
  }

  const accessTokenResponse = isAccessToken
    ? { token }
    : await oauth2Client.getAccessToken();
  const accessToken = accessTokenResponse.token!;

  // Process images in parallel with concurrency limit
  const processImage = async (image: { url: string; alt: string }) => {
    try {
      const cloudinaryUrl = await retryWithBackoff(
        () => processGoogleDocImage(image.url, accessToken, cloudinaryFolder),
        MAX_RETRY_ATTEMPTS,
        RETRY_DELAY_MS
      );
      return { original: image.url, cloudinary: cloudinaryUrl, success: true };
    } catch (error) {
      console.error(`Failed to process image ${image.url}:`, error);
      return { original: image.url, cloudinary: null, success: false };
    }
  };

  // Process in batches to limit concurrency
  const results = await processBatched(images, processImage, IMAGE_UPLOAD_CONCURRENCY);

  // Replace URLs in markdown
  let result = markdown;
  for (const { original, cloudinary, success } of results) {
    if (success && cloudinary) {
      const escapedUrl = escapeRegex(original);
      const imageRegex = new RegExp(`!\\[([^\\]]*)\\]\\(${escapedUrl}\\)`, 'g');
      result = result.replace(imageRegex, (match, altText) => {
        return `![${altText}](${cloudinary})`;
      });
    }
  }

  return result;
}

async function processImagesForFileParallel(
  markdown: string,
  images: Array<{ url: string; alt: string }>,
  cloudinaryFolder: string
): Promise<string> {
  if (images.length === 0) return markdown;

  const processImage = async (image: { url: string; alt: string }) => {
    try {
      const cloudinaryUrl = await retryWithBackoff(
        () => processFileImage(image.url, cloudinaryFolder),
        MAX_RETRY_ATTEMPTS,
        RETRY_DELAY_MS
      );
      return { original: image.url, cloudinary: cloudinaryUrl, success: true };
    } catch (error) {
      console.error(`Failed to process image ${image.url}:`, error);
      return { original: image.url, cloudinary: null, success: false };
    }
  };

  const results = await processBatched(images, processImage, IMAGE_UPLOAD_CONCURRENCY);

  let result = markdown;
  for (const { original, cloudinary, success } of results) {
    if (success && cloudinary) {
      const escapedUrl = escapeRegex(original);
      const imageRegex = new RegExp(`!\\[([^\\]]*)\\]\\(${escapedUrl}\\)`, 'g');
      result = result.replace(imageRegex, (match, altText) => {
        return `![${altText}](${cloudinary})`;
      });
    }
  }

  return result;
}

async function processGoogleDocImage(
  imageUrl: string,
  accessToken: string,
  folder: string
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(imageUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const blob = await response.blob();

    // Validate image size
    if (blob.size > 10 * 1024 * 1024) { // 10MB limit
      throw new Error('Image size exceeds 10MB limit');
    }

    const arrayBuffer = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = blob.type || 'image/png';

    // Validate mime type
    if (!mimeType.startsWith('image/')) {
      throw new Error('Invalid image mime type');
    }

    const dataUri = `data:${mimeType};base64,${base64}`;
    const result = await uploadImageToCloudinary(dataUri, { folder });

    return result.secureUrl;
  } finally {
    clearTimeout(timeout);
  }
}

async function processFileImage(imageUrl: string, cloudinaryFolder: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(imageUrl, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const blob = await response.blob();

    if (blob.size > 10 * 1024 * 1024) {
      throw new Error('Image size exceeds 10MB limit');
    }

    const arrayBuffer = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = blob.type || 'image/png';

    if (!mimeType.startsWith('image/')) {
      throw new Error('Invalid image mime type');
    }

    const dataUri = `data:${mimeType};base64,${base64}`;
    const uploadResult = await uploadImageToCloudinary(dataUri, { folder: cloudinaryFolder });

    return uploadResult.secureUrl;
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  baseDelay: number
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (attempt < maxAttempts - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Retry failed');
}

async function processBatched<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }

  return results;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeText(text: string): string {
  // Remove potential XSS vectors
  return text
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

function sanitizeUrl(url: string): string {
  // Only allow http, https, and relative URLs
  const trimmed = url.trim();

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
    // Remove javascript: and data: protocols
    if (trimmed.toLowerCase().includes('javascript:') || trimmed.toLowerCase().startsWith('data:')) {
      return '#';
    }
    return trimmed;
  }

  // Relative URLs are ok
  if (!trimmed.includes(':')) {
    return trimmed;
  }

  return '#';
}

// ============================================================================
// Formatting and Validation Functions
// ============================================================================

function formatMarkdown(markdown: string): {
  content: string;
  images: Array<{ url: string; alt: string }>;
  tables: Array<{ rows: string[][] }>;
  warnings: ConversionWarning[];
} {
  const warnings: ConversionWarning[] = [];
  const images: Array<{ url: string; alt: string }> = [];
  const tables: Array<{ rows: string[][] }> = [];

  // Extract images
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = imageRegex.exec(markdown)) !== null) {
    images.push({
      alt: match[1],
      url: match[2],
    });
  }

  // Extract tables
  const lines = markdown.split('\n');
  let currentTable: string[][] = [];
  let inTable = false;

  for (const line of lines) {
    if (line.match(/^\|.*\|$/)) {
      inTable = true;
      const cells = line
        .split('|')
        .map(c => c.trim())
      .filter(c => c.length > 0 && !c.match(/^-+$/));

      if (cells.length > 0) {
        currentTable.push(cells);
      }
    } else if (inTable) {
      if (currentTable.length > 1) {
        tables.push({ rows: currentTable });
      }
      currentTable = [];
      inTable = false;
    }
  }

  if (inTable && currentTable.length > 1) {
    tables.push({ rows: currentTable });
  }

  // Validate markdown
  const validation = validateMarkdown(markdown);
  warnings.push(...validation.warnings);

  // Cleanup whitespace
  const cleaned = cleanupWhitespace(markdown);

  return {
    content: cleaned,
    images,
    tables,
    warnings,
  };
}

function validateMarkdown(content: string): {
  valid: boolean;
  warnings: ConversionWarning[]
} {
  const warnings: ConversionWarning[] = [];

  // Check for unclosed code blocks
  const codeBlockMatches = content.match(/```/g);
  if (codeBlockMatches && codeBlockMatches.length % 2 !== 0) {
    warnings.push({
      type: 'code_block',
      message: 'Unclosed code block detected',
      suggestion: 'Ensure all code blocks are properly closed with ```',
      severity: 'high',
    });
  }

  // Check for unclosed links
  const openBrackets = (content.match(/\[/g) || []).length;
  const closeBrackets = (content.match(/\]/g) || []).length;
  if (openBrackets !== closeBrackets) {
    warnings.push({
      type: 'formatting',
      message: 'Unmatched brackets detected',
      suggestion: 'Check for properly closed link brackets [text](url)',
      severity: 'medium',
    });
  }

  // Check for unclosed bold
  const boldMatches = content.match(/\*\*/g);
  if (boldMatches && boldMatches.length % 2 !== 0) {
    warnings.push({
      type: 'formatting',
      message: 'Unclosed bold formatting detected',
      suggestion: 'Ensure all bold text is properly closed with **',
      severity: 'medium',
    });
  }

  // Check for unclosed italic (but not bold)
  const italicMatches = content.match(/(?<!\*)\*(?!\*)/g);
  if (italicMatches && italicMatches.length % 2 !== 0) {
    warnings.push({
      type: 'formatting',
      message: 'Unclosed italic formatting detected',
      suggestion: 'Ensure all italic text is properly closed with *',
      severity: 'medium',
    });
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

function cleanupWhitespace(content: string): string {
  let cleaned = content.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.split('\n').map(line => line.trimEnd()).join('\n');
  return cleaned.trim();
}

// ============================================================================
// Code Block Detection Functions (IMPROVED)
// ============================================================================

function detectCodeBlockInParagraph(
  textStyle: any,
  content: string,
  paragraphStyle?: any
): { isCodeBlock: boolean; reason: string | null } {
  const trimmedContent = content.trim();

  // Heuristic 1: Small font size
  if (textStyle.fontSize?.magnitude && textStyle.fontSize.magnitude < SMALL_FONT_SIZE) {
    return { isCodeBlock: true, reason: 'small_font_size' };
  }

  // Heuristic 2: Monospace font family
  const fontFamily = textStyle.weightedFontFamily?.fontFamily;
  if (fontFamily && MONOSPACE_FONTS.some(f => fontFamily.toLowerCase().includes(f.toLowerCase()))) {
    return { isCodeBlock: true, reason: 'monospace_font' };
  }

  // Heuristic 3: Indentation (4+ spaces)
  const leadingSpaces = content.match(/^(\s+)/)?.[1]?.length || 0;
  if (leadingSpaces >= CODE_INDENTATION && trimmedContent.length > 0) {
    return { isCodeBlock: true, reason: 'indentation' };
  }

  // Heuristic 4: Code patterns (IMPROVED - more specific)
  if (trimmedContent.length > 0 && hasCodePattern(trimmedContent)) {
    return { isCodeBlock: true, reason: 'code_pattern' };
  }

  return { isCodeBlock: false, reason: null };
}

function hasCodePattern(text: string): boolean {
  // More specific patterns to reduce false positives
  const codePatterns = [
    /^(function|const|let|var|class|interface|type|enum)\s+\w+/,
    /^(import|export|from|require)\s+/,
    /^(async|await|return|yield)\s+/,
    /^(if|else|for|while|switch|case|try|catch|finally)\s*[\(\{]/,
    /^(public|private|protected|static|final|abstract)\s+/,
    /^(def|class|import|from|pass|lambda)\s+/,
    /^(package|func|var|type|struct|interface)\s+/,
    /^(using|namespace|void)\s+/,
    /^(fn|let|mut|pub|impl|trait)\s+/,
    /^#include\s*[<\"]/,
    /^<\?php/,
    /^#!/,
    /console\.(log|error|warn|info)\s*\(/,
    /System\.(out|err)\.print/,
    /println!\s*\(/,
    /fmt\.(Print|Sprintf)/,
    /std::(cout|cin|cerr)/,
    /^SELECT\s+.+\s+FROM\s+/i,
    /^(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s+/i,
    /=>\s*\{/, // Arrow functions
    /\?\s*\./, // Optional chaining
    /\|\s*\w+\s*\|/, // Rust/Ruby closures
    /::\w+/, // C++/Rust namespaces
  ];

  return codePatterns.some(pattern => pattern.test(text));
}

function detectCodeLanguage(content: string): string | null {
  const trimmed = content.trim();
  const lines = trimmed.split('\n');
  const linesToCheck = lines.slice(0, 10).join('\n');

  // Check in priority order (more specific first)
  const languagePatterns: Array<[string, RegExp[]]> = [
    ['rust', [
      /fn\s+\w+/,
      /let\s+mut\s+/,
      /impl\s+/,
      /pub\s+/,
      /::\w+/,
      /println!\s*\(/,
      /->\s*\w+/
    ]],
    ['typescript', [
      /interface\s+\w+/,
      /type\s+\w+\s*=/,
      /enum\s+\w+/,
      /:\s*(string|number|boolean|any|void)\s*[,;)=]/,
      /public\s+\w+\s*:/,
      /private\s+\w+\s*:/,
      /<\w+>/
    ]],
    ['python', [
      /^def\s+\w+/m,
      /^class\s+\w+/m,
      /^import\s+/m,
      /^from\s+.+\s+import/m,
      /print\s*\(/,
      /:\s*$/m,
      /\s+pass\s*$/m
    ]],
    ['java', [
      /public\s+(class|interface|enum)/,
      /private\s+(class|interface)/,
      /void\s+\w+\s*\(/,
      /System\.(out|err)/,
      /import\s+java\./,
      /@\w+/,
      /throws\s+\w+/
    ]],
    ['cpp', [
      /#include\s*[<\"]/,
      /std::/,
      /cout\s*</,
      /cin\s*>>/,
      /->\w+/,
      /\w+::\w+/
    ]],
    ['csharp', [
      /using\s+\w+/,
      /namespace\s+\w+/,
      /public\s+class/,
      /Console\.(Write|Read)/,
      /var\s+\w+\s*=/
    ]],
    ['go', [
      /package\s+\w+/,
      /func\s+\w+/,
      /:=/,
      /fmt\./,
      /import\s*\(/,
      /type\s+\w+\s+struct/
    ]],
    ['php', [
      /<\?php/,
      /\$\w+/,
      /echo\s+/,
      /function\s+\w+/,
      /->/
    ]],
    ['ruby', [
      /def\s+\w+/,
      /end\s*$/m,
      /class\s+\w+/,
      /module\s+\w+/,
      /\.\@\w+/,
      /\|\w+\|/
    ]],
    ['sql', [
      /SELECT\s+.+\s+FROM/i,
      /INSERT\s+INTO/i,
      /UPDATE\s+.+\s+SET/i,
      /DELETE\s+FROM/i,
      /CREATE\s+TABLE/i,
      /WHERE\s+.+=/i,
      /JOIN\s+\w+/i
    ]],
    ['javascript', [
      /function\s+\w+/,
      /const\s+\w+/,
      /let\s+\w+/,
      /=>/,
      /console\./,
      /import\s+.+\s+from/,
      /document\./,
      /window\./,
      /async\s+/,
      /await\s+/
    ]],
    ['bash', [
      /^#!/,
      /^\$/,
      /\s+&&\s+/,
      /\s+\|\|\s+/,
      /\|/,
      /grep\s+/,
      /npm\s+/,
      /docker\s+/
    ]],
    ['json', [
      /^\s*\{/,
      /^\s*\[/,
      /"\w+"\s*:/,
      /:\s*"[^"]*"/,
      /:\s*\d+/,
      /:\s*\{/
    ]],
    ['yaml', [
      /^\w+\s*:/m,
      /^\s+-\s+\w+/m,
      /^---/m,
      /:\s*\w+/
    ]],
    ['html', [
      /<!DOCTYPE/i,
      /<html/i,
      /<head/i,
      /<body/i,
      /<div/i,
      /<\/\w+>/
    ]],
    ['css', [
      /\w+\s*\{/,
      /\}\s*$/m,
      /\.[\w-]+\s*\{/,
      /#[\w-]+\s*\{/,
      /:\s*\d+px/,
      /!important/
    ]],
  ];

  for (const [lang, patterns] of languagePatterns) {
    let matchCount = 0;
    for (const pattern of patterns) {
      if (pattern.test(linesToCheck)) {
        matchCount++;
      }
    }
    // Require at least 2 pattern matches for confidence
    if (matchCount >= 2) {
      return lang;
    }
  }

  return null;
}

function shouldMergeWithPrevious(
  currentStyle: any,
  previousStyle: any,
  isHeading: boolean
): boolean {
  const currentBold = currentStyle.bold && !isHeading;
  const previousBold = previousStyle.bold && !isHeading;
  const currentItalic = currentStyle.italic;
  const previousItalic = previousStyle.italic;
  const currentStrikethrough = currentStyle.strikethrough;
  const previousStrikethrough = previousStyle.strikethrough;

  return (
    currentBold === previousBold &&
    currentItalic === previousItalic &&
    currentStrikethrough === previousStrikethrough
  );
}

function mergeAdjacentFormattedText(
  previousText: string,
  currentText: string,
  currentStyle: any,
  previousStyle: any,
  isHeading = false
): string {
  let mergedText = previousText;

  // Remove closing markers from previous text
  if (previousStyle.strikethrough && mergedText.endsWith('~~')) {
    mergedText = mergedText.slice(0, -2);
  }
  if (previousStyle.italic && mergedText.endsWith('*')) {
    mergedText = mergedText.slice(0, -1);
  }
  if (previousStyle.bold && !isHeading && mergedText.endsWith('**')) {
    mergedText = mergedText.slice(0, -2);
  }

  // Add the new content (without opening markers)
  let contentToAdd = currentText;

  if (currentStyle.bold && !isHeading && contentToAdd.startsWith('**')) {
    contentToAdd = contentToAdd.slice(2);
  }
  if (currentStyle.italic && contentToAdd.startsWith('*')) {
    contentToAdd = contentToAdd.slice(1);
  }
  if (currentStyle.strikethrough && contentToAdd.startsWith('~~')) {
    contentToAdd = contentToAdd.slice(2);
  }

  mergedText += contentToAdd;

  // Re-add closing markers (in reverse order of opening)
  if (currentStyle.strikethrough) {
    mergedText += '~~';
  }
  if (currentStyle.italic) {
    mergedText += '*';
  }
  if (currentStyle.bold && !isHeading) {
    mergedText += '**';
  }

  return mergedText;
}

// ============================================================================
// Cache Functions (IMPROVED - Complete Data Storage)
// ============================================================================

export async function getConversionResultFromCache(
  content: string,
  fileType: 'docx'
): Promise<ConversionOutput | null> {
  if (fileType !== 'docx') {
    return null;
  }

  try {
    const cache = await getCacheManager();
    const cached = await cache.getFileConversion(content, fileType);

    if (cached) {
      // Parse stored metadata to reconstruct full output
      const images = cached.metadata.images || [];
      const headings = cached.metadata.headings || [];
      const tables = cached.metadata.tables || [];

      return {
        title: cached.metadata.title,
        content: cached.content,
        images,
        headings,
        tables,
        warnings: cached.warnings,
        metrics: { ...cached.metrics, cached: true },
        cached: true,
      };
    }
  } catch (error) {
    console.warn('Cache retrieval failed:', error);
  }

  return null;
}

export async function setConversionResultInCache(
  content: string,
  fileType: 'docx',
  result: ConversionOutput
): Promise<void> {
  if (fileType !== 'docx') {
    return;
  }

  try {
    const cache = await getCacheManager();
    const cacheKey = hashString(content + fileType);

    await cache.setFileConversion(
      content,
      fileType,
      {
        content: result.content,
        metadata: {
          title: result.title,
          paragraphCount: result.content.split('\n\n').length,
          tableCount: result.tables.length,
          imageCount: result.images.length,
          codeBlockCount: (result.content.match(/```/g) || []).length / 2,
          headingCount: result.headings.length,
          characterCount: result.content.length,
          timestamp: Date.now(),
          // FIXED: Store complete data
          images: result.images,
          headings: result.headings,
          tables: result.tables,
        } as any,
        warnings: result.warnings,
        metrics: result.metrics || { totalTime: 0, stages: {} },
        cacheInfo: {
          cachedAt: Date.now(),
          ttl: 3600000,
          key: cacheKey,
        },
      },
      3600000
    );
  } catch (error) {
    console.warn('Cache storage failed:', error);
  }
}