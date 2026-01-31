/**
 * Unified Google Doc to Markdown Converter
 *
 * This is the single source of truth for document conversion.
 * Uses the pipeline architecture for modularity and testability.
 *
 * SUPPORTED FORMATS:
 * - Google Docs (via Google Docs API)
 * - .docx files (via mammoth.js)
 *
 * NOTE: .doc format (legacy Microsoft Word) is NOT supported.
 * Only .docx files can be converted. If you have a .doc file,
 * please save it as .docx in Microsoft Word or Google Docs first.
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as mammoth from 'mammoth';
import { uploadImageToCloudinary } from '@/lib/cloudinary';
import { createConversionCache, hashString } from '@/lib/cache';
import type { ConversionCacheManager } from '@/lib/cache';

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
  type: 'code_block' | 'heading' | 'table' | 'list' | 'formatting' | 'image';
  message: string;
  suggestion: string;
  context?: string;
}

export interface ConversionMetrics {
  totalTime: number;
  stages: Record<string, number>;
  cached?: boolean;
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
      finalMarkdown = await processImages(
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
      },
    };
  } catch (error: any) {
    console.error('Error converting Google Doc:', error);
    throw new Error(`Failed to convert Google Doc: ${error.message}`);
  }
}

/**
 * Converts a .docx file to Markdown
 * Uses mammoth.js for conversion
 *
 * NOTE: Only .docx format is supported. .doc files will be rejected.
 * If you have a .doc file, convert it to .docx first.
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
    }

    // Convert .docx to HTML using mammoth.js
    const convertStart = performance.now();
    const buffer = Buffer.isBuffer(fileContent)
      ? fileContent
      : Buffer.from(fileContent, 'base64');

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
      finalMarkdown = await processImagesForFile(
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
      },
      originalContent,
    };
  } catch (error: any) {
    console.error('Error converting .docx file:', error);
    throw new Error(`Failed to convert .docx file: ${error.message}`);
  }
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
          alt: embeddedObject?.title || 'image',
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

  // Track list state for better nesting handling
  const listState = {
    currentListId: null as string | null,
    currentNestingLevel: 0,
    isNumbered: false,
  };

  // Track heading hierarchy
  const headingState = {
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
    const { markdown: tableMarkdown, tableData, warnings: tableWarnings } =
      processTable(table);
    markdown += tableMarkdown;
    warnings.push(...tableWarnings);
  }

  return { markdown, warnings, headings };
}

function processParagraph(
  paragraph: any,
  images: Array<{ url: string; alt: string }>,
  headings: Array<{ text: string; level: number }>,
  listState: { currentListId: string | null; currentNestingLevel: number; isNumbered: boolean },
  headingState: { lastLevel: number; skippedLevels: number },
  warnings: ConversionWarning[]
): string {
  const elements = paragraph.elements || [];
  const paragraphStyle = paragraph.paragraphStyle;

  let text = '';
  let isHeading = false;
  let headingLevel = 0;
  let isCodeBlock = false;

  // Check for heading style
  if (paragraphStyle && paragraphStyle.namedStyleType) {
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

        // Handle links
        if (textStyle.link && textStyle.link.url) {
          const url = textStyle.link.url;
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
          const altText = image.alt || 'image';
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

    // Track list state
    const listChanged = listState.currentListId !== listId;
    const nestingChanged = listState.currentNestingLevel !== nestingLevel;
    const typeChanged = listState.isNumbered !== isNumbered;

    // Warn about mixed list types
    if (listChanged === false && typeChanged) {
      warnings.push({
        type: 'list',
        message: 'Mixed bullet and numbered list items detected in the same list',
        suggestion: 'Use consistent list types (all bullets or all numbers) for better readability',
        context: `List ID: ${listId}, Nesting level: ${nestingLevel}`,
      });
    }

    // Warn about large nesting level jumps
    if (nestingLevel > listState.currentNestingLevel + 1) {
      warnings.push({
        type: 'list',
        message: `List nesting level jumped from ${listState.currentNestingLevel} to ${nestingLevel}`,
        suggestion: 'Ensure proper list hierarchy - don\'t skip nesting levels',
        context: `List ID: ${listId}`,
      });
    }

    listState.currentListId = listId;
    listState.currentNestingLevel = nestingLevel;
    listState.isNumbered = isNumbered;

    const indent = '  '.repeat(nestingLevel);

    if (isNumbered) {
      return `${indent}1. ${text.trim()}\n`;
    }
    return `${indent}- ${text.trim()}\n`;
  }

  // Return formatted text
  if (isHeading) {
    // Validate heading hierarchy
    if (headingState.lastLevel > 0 && headingLevel > headingState.lastLevel + 1) {
      headingState.skippedLevels++;
      warnings.push({
        type: 'heading',
        message: `Heading level skipped from H${headingState.lastLevel} to H${headingLevel}`,
        suggestion: `Use H${headingState.lastLevel + 1} instead of H${headingLevel} for proper document structure`,
        context: `Heading: "${text.trim()}"`,
      });
    }

    headingState.lastLevel = headingLevel;

    const prefix = '#'.repeat(headingLevel);
    headings.push({ text: text.trim(), level: headingLevel });
    return `${prefix} ${text.trim()}\n\n`;
  } else if (isCodeBlock) {
    const language = detectCodeLanguage(text);
    const codeFence = language ? `\`\`\`${language}` : '```';

    if (!language) {
      warnings.push({
        type: 'code_block',
        message: 'Code block detected but no language specified',
        suggestion: 'Add a language identifier after the code fence (e.g., ```javascript)',
        context: `Code: ${text.substring(0, 50)}...`,
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
  tableData: string[][];
  warnings: ConversionWarning[];
} {
  const warnings: ConversionWarning[] = [];
  if (!table.tableRows || table.tableRows.length === 0) {
    return { markdown: '', tableData: [], warnings };
  }

  const rows = table.tableRows;
  const tableData: string[][] = [];

  for (const row of rows) {
    const rowData: string[] = [];
    const cells = row.tableCells || [];

    for (const cell of cells) {
      const cellContent = cell.content || [];
      let cellText = '';

      for (const content of cellContent) {
        if (content.paragraph) {
          const elements = content.paragraph.elements || [];
          for (const element of elements) {
            if (element.textRun && element.textRun.content) {
              cellText += element.textRun.content;
            }
          }
        }
      }

      // Check for empty cells (potential merged cells)
      if (!cellText.trim()) {
        warnings.push({
          type: 'table',
          message: 'Empty table cell detected',
          suggestion: 'This may be a merged cell. Markdown tables don\'t support cell merging - consider splitting the cell or using HTML tables',
          context: `Row ${tableData.length + 1}, Cell ${rowData.length + 1}`,
        });
      }

      rowData.push(cellText.trim());
    }

    tableData.push(rowData);
  }

  // Build Markdown table
  if (tableData.length === 0) {
    return { markdown: '', tableData: [], warnings };
  }

  const headers = tableData[0];
  const dataRows = tableData.slice(1);

  let markdown = '| ' + headers.join(' | ') + ' |\n';
  markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

  for (const row of dataRows) {
    markdown += '| ' + row.join(' | ') + ' |\n';
  }

  markdown += '\n';
  return { markdown, tableData, warnings };
}

// ============================================================================
// HTML to Markdown Parsing
// ============================================================================

function parseHtmlToMarkdown(html: string): {
  markdown: string;
  warnings: ConversionWarning[];
  headings: Array<{ text: string; level: number }>;
  tables: Array<{ rows: string[][] }>;
  images: Array<{ url: string; alt: string }>;
} {
  let markdown = html;
  const warnings: ConversionWarning[] = [];
  const headings: Array<{ text: string; level: number }> = [];
  const tables: Array<{ rows: string[][] }> = [];
  const images: Array<{ url: string; alt: string }> = [];

  // Remove script and style tags
  markdown = markdown.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  markdown = markdown.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Convert headings
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, (match, content) => {
    const text = content.replace(/<[^>]+>/g, '').trim();
    if (text) {
      headings.push({ text, level: 1 });
      return `# ${text}\n\n`;
    }
    return '';
  });

  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, (match, content) => {
    const text = content.replace(/<[^>]+>/g, '').trim();
    if (text) {
      headings.push({ text, level: 2 });
      return `## ${text}\n\n`;
    }
    return '';
  });

  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, (match, content) => {
    const text = content.replace(/<[^>]+>/g, '').trim();
    if (text) {
      headings.push({ text, level: 3 });
      return `### ${text}\n\n`;
    }
    return '';
  });

  markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, (match, content) => {
    const text = content.replace(/<[^>]+>/g, '').trim();
    if (text) {
      headings.push({ text, level: 4 });
      return `#### ${text}\n\n`;
    }
    return '';
  });

  markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, (match, content) => {
    const text = content.replace(/<[^>]+>/g, '').trim();
    if (text) {
      headings.push({ text, level: 5 });
      return `##### ${text}\n\n`;
    }
    return '';
  });

  markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, (match, content) => {
    const text = content.replace(/<[^>]+>/g, '').trim();
    if (text) {
      headings.push({ text, level: 6 });
      return `###### ${text}\n\n`;
    }
    return '';
  });

  // Convert bold and italic
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

  // Convert links
  markdown = markdown.replace(/<a[^>]*href=["'](.*?)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');

  // Convert images
  markdown = markdown.replace(/<img[^>]*src=["'](.*?)["'][^>]*alt=["'](.*?)["'][^>]*>/gi, (match, src, alt) => {
    images.push({ url: src, alt });
    return `![${alt}](${src})`;
  });
  markdown = markdown.replace(/<img[^>]*src=["'](.*?)["'][^>]*>/gi, (match, src) => {
    images.push({ url: src, alt: '' });
    return `![](${src})`;
  });

  // Convert paragraphs
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');

  // Convert line breaks
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');

  // Convert lists
  markdown = markdown.replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
    return content.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n') + '\n';
  });
  markdown = markdown.replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, content) => {
    let i = 1;
    return content.replace(/<li[^>]*>(.*?)<\/li>/gi, () => `${i++}. $1\n`) + '\n';
  });

  // Convert code blocks
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  markdown = markdown.replace(/<pre[^>]*>(.*?)<\/pre>/gis, '```\n$1\n```\n\n');

  // Convert blockquotes
  markdown = markdown.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (match, content) => {
    return content.split('\n').map((line: string) => line.trim() ? `> ${line}` : '').join('\n') + '\n\n';
  });

  // Convert tables
  markdown = markdown.replace(/<table[^>]*>(.*?)<\/table>/gis, (match, content) => {
    const tableMarkdown = convertHtmlTableToMarkdown(content);
    if (tableMarkdown) {
      tables.push({ rows: parseMarkdownTableRows(tableMarkdown) });
    }
    return tableMarkdown;
  });

  // Remove remaining HTML tags
  markdown = markdown.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  markdown = markdown
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™');

  // Clean up whitespace
  markdown = markdown
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

  return { markdown, warnings, headings, tables, images };
}

function convertHtmlTableToMarkdown(htmlTable: string): string {
  const rows: string[][] = [];

  const rowMatches = htmlTable.match(/<tr[^>]*>(.*?)<\/tr>/gis);
  if (!rowMatches) return '';

  rowMatches.forEach((rowMatch) => {
    const cells: string[] = [];
    const cellMatches = rowMatch.match(/<t[dh][^>]*>(.*?)<\/t[dh]>/gis);

    if (cellMatches) {
      cellMatches.forEach((cellMatch) => {
        const content = cellMatch
          .replace(/<t[dh][^>]*>/, '')
          .replace(/<\/t[dh]>/, '')
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        cells.push(content);
      });
    }

    rows.push(cells);
  });

  if (rows.length === 0) return '';

  const headers = rows[0];
  const dataRows = rows.slice(1);

  let markdown = '| ' + headers.join(' | ') + ' |\n';
  markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

  for (const row of dataRows) {
    markdown += '| ' + row.join(' | ') + ' |\n';
  }

  markdown += '\n';
  return markdown;
}

function parseMarkdownTableRows(markdown: string): string[][] {
  const rows: string[][] = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    if (line.match(/^\|.*\|$/)) {
      const cells = line
        .split('|')
        .map(c => c.trim())
        .filter(c => c.length > 0);
      rows.push(cells);
    }
  }

  return rows;
}

// ============================================================================
// Image Processing Functions
// ============================================================================

async function processImages(
  markdown: string,
  images: Array<{ url: string; alt: string }>,
  token: string,
  isAccessToken: boolean,
  cloudinaryFolder: string
): Promise<string> {
  let result = markdown;

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

  for (const image of images) {
    try {
      const cloudinaryUrl = await processGoogleDocImage(image.url, accessToken, cloudinaryFolder);

      // Replace the image URL in the markdown
      const escapedUrl = image.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const imageRegex = new RegExp(`!\\[(.*?)\\]\\(${escapedUrl}\\)`, 'g');
      result = result.replace(imageRegex, (match, altText) => {
        return `![${altText}](${cloudinaryUrl})`;
      });
    } catch (error) {
      console.error(`Failed to process image ${image.url}:`, error);
      // Keep original URL if upload fails
    }
  }

  return result;
}

async function processGoogleDocImage(
  imageUrl: string,
  accessToken: string,
  folder: string
): Promise<string> {
  try {
    // Google Docs images need to be fetched with the access token
    const response = await fetch(imageUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    // Get the image as a blob and convert to base64
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = blob.type || 'image/png';
    const dataUri = `data:${mimeType};base64,${base64}`;

    // Upload to Cloudinary
    const result = await uploadImageToCloudinary(dataUri, { folder });

    return result.secureUrl;
  } catch (error) {
    console.error('Error processing Google Doc image:', error);
    throw error;
  }
}

async function processImagesForFile(
  markdown: string,
  images: Array<{ url: string; alt: string }>,
  cloudinaryFolder: string
): Promise<string> {
  let result = markdown;

  for (const image of images) {
    try {
      // Fetch the image
      const response = await fetch(image.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = blob.type || 'image/png';
      const dataUri = `data:${mimeType};base64,${base64}`;

      // Upload to Cloudinary
      const uploadResult = await uploadImageToCloudinary(dataUri, { folder: cloudinaryFolder });

      // Replace the image URL in the markdown
      const escapedUrl = image.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const imageRegex = new RegExp(`!\\[(.*?)\\]\\(${escapedUrl}\\)`, 'g');
      result = result.replace(imageRegex, (match, altText) => {
        return `![${altText}](${uploadResult.secureUrl})`;
      });
    } catch (error) {
      console.error(`Failed to process image ${image.url}:`, error);
      // Keep original URL if upload fails
    }
  }

  return result;
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
        .filter(c => c.length > 0);
      currentTable.push(cells);
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

function validateMarkdown(content: string): { valid: boolean; warnings: ConversionWarning[] } {
  const warnings: ConversionWarning[] = [];

  // Check for unclosed code blocks
  const codeBlockMatches = content.match(/```/g);
  if (codeBlockMatches && codeBlockMatches.length % 2 !== 0) {
    warnings.push({
      type: 'code_block',
      message: 'Unclosed code block detected',
      suggestion: 'Ensure all code blocks are properly closed with ```',
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
    });
  }

  // Check for unclosed bold
  const boldMatches = content.match(/\*\*/g);
  if (boldMatches && boldMatches.length % 2 !== 0) {
    warnings.push({
      type: 'formatting',
      message: 'Unclosed bold formatting detected',
      suggestion: 'Ensure all bold text is properly closed with **',
    });
  }

  // Check for unclosed italic
  const italicMatches = content.match(/\*(?!\*)/g);
  if (italicMatches && italicMatches.length % 2 !== 0) {
    warnings.push({
      type: 'formatting',
      message: 'Unclosed italic formatting detected',
      suggestion: 'Ensure all italic text is properly closed with *',
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
  return cleaned;
}

// ============================================================================
// Code Block Detection Functions
// ============================================================================

const MONOSPACE_FONTS = ['Courier New', 'Consolas', 'Monaco', 'monospace', 'Courier'];
const SMALL_FONT_SIZE = 10; // Points - threshold for code block detection
const CODE_INDENTATION = 4; // Minimum spaces for code indentation

function detectCodeBlockInParagraph(
  textStyle: any,
  content: string,
  paragraphStyle?: any
): { isCodeBlock: boolean; reason: string | null } {
  const trimmedContent = content.trim();

  // Heuristic 1: Small font size (common for code)
  if (textStyle.fontSize && textStyle.fontSize.magnitude && textStyle.fontSize.magnitude < SMALL_FONT_SIZE) {
    return { isCodeBlock: true, reason: 'small_font_size' };
  }

  // Heuristic 2: Monospace font family
  const fontFamily = textStyle.weightedFontFamily?.fontFamily;
  if (fontFamily && MONOSPACE_FONTS.some(f => fontFamily.toLowerCase().includes(f.toLowerCase()))) {
    return { isCodeBlock: true, reason: 'monospace_font' };
  }

  // Heuristic 3: Indentation (4+ spaces suggests code)
  const leadingSpaces = content.match(/^(\s+)/)?.[1]?.length || 0;
  if (leadingSpaces >= CODE_INDENTATION && trimmedContent.length > 0) {
    return { isCodeBlock: true, reason: 'indentation' };
  }

  // Heuristic 4: Content patterns (common code syntax)
  const codePatterns = [
    /^function\s+\w+/, // function foo()
    /^const\s+\w+/, // const foo
    /^let\s+\w+/, // let foo
    /^var\s+\w+/, // var foo
    /^import\s+/, // import ...
    /^export\s+/, // export ...
    /^from\s+['"]/, // from '...'
    /^class\s+\w+/, // class Foo
    /^return\s+/, // return ...
    /^if\s*\(/, // if (
    /^else\s*{/, // else {
    /^for\s*\(/, // for (
    /^while\s*\(/, // while (
    /^try\s*{/, // try {
    /^catch\s*\(/, // catch (
    /^finally\s*{/, // finally {
    /^async\s+function/, // async function
    /^await\s+/, // await ...
    /^console\./, // console.log
    /^import\s+\{/, // import { ...
    /^export\s+\{/, // export { ...
    /^const\s+\{/, // const { ...
    /^let\s+\{/, // let { ...
    /^const\s+\[/, // const [
    /^let\s+\[/, // let [
    /^#/, // Python/shell comments
    /^\$/, // Shell commands
    /^\/\//, // Line comments
    /^\{/, // Object literal
    /^\[/, // Array literal
    /^</, // JSX/HTML
    /^\s*-\s+/, // YAML list item
    /^\s*\w+:\s+/, // YAML key-value
    /^[a-zA-Z_]\w*\s*=/, // Variable assignment
    /^\d+\s*$/, // Just a number
    /^[a-zA-Z_]\w*\s*\(/, // Function call
  ];

  if (trimmedContent && codePatterns.some(pattern => pattern.test(trimmedContent))) {
    return { isCodeBlock: true, reason: 'code_pattern' };
  }

  return { isCodeBlock: false, reason: null };
}

function detectCodeLanguage(content: string): string | null {
  const trimmed = content.trim();
  const lines = trimmed.split('\n');

  // Check for common language patterns
  const languagePatterns: Record<string, RegExp[]> = {
    javascript: [
      /function\s+\w+/, /const\s+\w+/, /let\s+\w+/, /var\s+\w+/, /=>/, /import\s+.*from/,
      /export\s+/, /console\./, /document\./, /window\./, /Promise/, /async\s+/, /await\s+/,
    ],
    typescript: [
      /interface\s+\w+/, /type\s+\w+/, /enum\s+\w+/, /:\s*\w+/, /<\w+>/, /public\s+/, /private\s+/, /protected\s+/,
    ],
    python: [
      /^def\s+\w+/, /^class\s+\w+/, /^import\s+/, /^from\s+/, /\s+pass\s*$/, /\s+return\s+/, /\s+if\s+.*:/,
      /\s+for\s+.*:/, /\s+while\s+.*:/, /\s+def\s+/, /\s+class\s+/, /print\(/,
    ],
    java: [
      /public\s+class\s+\w+/, /private\s+class\s+\w+/, /void\s+\w+/, /System\./, /import\s+java\./,
      /@\w+/, /throws\s+\w+/, /static\s+\w+/, /final\s+\w+/,
    ],
    cpp: [
      /#include\s+</, /#include\s+"/, /std::/, /cout\s*</, /cin\s*>>/, /\w+::\w+/, /->\w+/, /\*\w+/,
    ],
    csharp: [
      /using\s+\w+/, /namespace\s+\w+/, /public\s+class\s+\w+/, /private\s+class\s+\w+/, /void\s+\w+/, /var\s+\w+/, /=>/,
    ],
    go: [
      /package\s+\w+/, /func\s+\w+/, /var\s+\w+/, /:=/, /import\s+\(/, /fmt\./, /type\s+\w+\s+struct/,
    ],
    rust: [
      /fn\s+\w+/, /let\s+mut\s+/, /pub\s+/, /struct\s+\w+/, /enum\s+\w+/, /impl\s+\w+/, /::/, /->\s*\w+/,
    ],
    php: [
      /<\?php/, /function\s+\w+/, /\$\w+/, /echo\s+/, /public\s+/, /private\s+/, /class\s+\w+/,
    ],
    ruby: [
      /def\s+\w+/, /class\s+\w+/, /module\s+\w+/, /end\s*$/, /\|\w+\|/, /\.@\w+/, /require\s+['"]/,
    ],
    shell: [
      /^#!/, /^\$/, /\s+&&\s+/, /\s+\|\|\s+/, /grep\s+/, /ls\s+/, /cd\s+/, /npm\s+/, /yarn\s+/, /docker\s+/,
    ],
    json: [
      /^\{/, /^\[/, /"\w+"\s*:/, /:\s*"/, /:\s*\d+/, /:\s*\[/, /:\s*\{/,
    ],
    yaml: [
      /^\w+\s*:/, /^\s+-\s+\w+/, /^---/, /^(\.\.\.)/, /#\s+/, /:\s*\w+/,
    ],
    html: [
      /<\w+>/, /<\w+\s+/, /</, /\/>/, /<\?xml/, /<!DOCTYPE/, /<html/, /<body/, /<div/,
    ],
    css: [
      /\w+\s*\{/, /\}\s*$/, /\.[\w-]+/, /#[\w-]+/, /\s+!important/, /\s+\d+px/, /\s+\d+rem/,
    ],
    sql: [
      /SELECT\s+.*FROM/i, /INSERT\s+.*INTO/i, /UPDATE\s+.*SET/i, /DELETE\s+.*FROM/i, /CREATE\s+TABLE/i,
      /FROM\s+\w+/i, /WHERE\s+.*=/i, /JOIN\s+\w+/i, /GROUP\s+BY/i, /ORDER\s+BY/i,
    ],
  };

  // Check first few lines for language patterns
  const linesToCheck = lines.slice(0, 10);
  const combined = linesToCheck.join('\n');

  for (const [lang, patterns] of Object.entries(languagePatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(combined)) {
        return lang;
      }
    }
  }

  return null;
}

function shouldMergeWithPrevious(currentStyle: any, previousStyle: any, isHeading: boolean): boolean {
  const currentBold = currentStyle.bold && !isHeading;
  const previousBold = previousStyle.bold && !isHeading;
  const currentItalic = currentStyle.italic;
  const previousItalic = previousStyle.italic;
  const currentStrikethrough = currentStyle.strikethrough;
  const previousStrikethrough = previousStyle.strikethrough;

  const boldMatch = currentBold === previousBold;
  const italicMatch = currentItalic === previousItalic;
  const strikethroughMatch = currentStrikethrough === previousStrikethrough;

  return boldMatch && italicMatch && strikethroughMatch;
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
  if (previousStyle.bold && !isHeading && mergedText.endsWith('**')) {
    mergedText = mergedText.slice(0, -2);
  }
  if (previousStyle.italic && mergedText.endsWith('*')) {
    mergedText = mergedText.slice(0, -1);
  }
  if (previousStyle.strikethrough && mergedText.endsWith('~~')) {
    mergedText = mergedText.slice(0, -2);
  }

  // Add the new content (without opening markers since they're already there)
  let contentToAdd = currentText;

  // Remove opening markers from current text
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

  // Re-add closing markers
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
// Cache Functions
// ============================================================================

export async function getConversionResultFromCache(
  content: string,
  fileType: 'docx'
): Promise<ConversionOutput | null> {
  // Note: Only 'docx' is supported. .doc format is not cached.
  if (fileType !== 'docx') {
    return null;
  }
  try {
    const cache = await getCacheManager();
    const cached = await cache.getFileConversion(content, fileType);

    if (cached) {
      return {
        title: cached.metadata.title,
        content: cached.content,
        images: [],
        headings: [],
        tables: [],
        warnings: cached.warnings,
        metrics: cached.metrics,
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
  // Note: Only 'docx' is supported. .doc format is not cached.
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
          paragraphCount: 0,
          tableCount: result.tables.length,
          imageCount: result.images.length,
          codeBlockCount: 0,
          headingCount: result.headings.length,
          characterCount: result.content.length,
          timestamp: Date.now(),
        },
        warnings: result.warnings,
        metrics: result.metrics || { totalTime: 0, stages: {} },
        cacheInfo: {
          cachedAt: Date.now(),
          ttl: 3600000, // 1 hour
          key: cacheKey,
        },
      },
      3600000
    );
  } catch (error) {
    console.warn('Cache storage failed:', error);
  }
}
