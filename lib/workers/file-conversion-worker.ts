/**
 * Web Worker for Client-Side File Conversion
 *
 * Handles conversion of HTML, TXT, RTF, and DOCX files to Markdown
 * Runs in a separate thread to avoid blocking the main UI
 *
 * Note: This worker only handles file-based conversions.
 * Google Docs conversions require OAuth tokens and API access,
 * which must be handled in the main thread.
 */

import type {
  WorkerMessage,
  WorkerConvertPayload,
  WorkerProgressPayload,
  WorkerResultPayload,
  WorkerErrorPayload,
} from './types/worker-messages';

// ============================================================================
// Worker State
// ============================================================================

let isProcessing = false;
let currentRequestId: string | null = null;

// ============================================================================
// Utility Functions (Worker-safe)
// ============================================================================

/**
 * Send progress update to main thread
 */
function sendProgress(stage: string, progress: number, message: string, context?: Record<string, any>) {
  const payload: WorkerProgressPayload = { stage, progress, message, context };
  self.postMessage({
    type: 'PROGRESS',
    payload,
    timestamp: Date.now(),
  } satisfies WorkerMessage<WorkerProgressPayload>);
}

/**
 * Send result to main thread
 */
function sendResult(result: WorkerResultPayload) {
  self.postMessage({
    type: 'RESULT',
    payload: result,
    timestamp: Date.now(),
  } satisfies WorkerMessage<WorkerResultPayload>);
}

/**
 * Send error to main thread
 */
function sendError(code: string, message: string, suggestion?: string, context?: Record<string, any>, stack?: string) {
  const payload: WorkerErrorPayload = { code, message, suggestion, context, stack };
  self.postMessage({
    type: 'ERROR',
    payload,
    timestamp: Date.now(),
  } satisfies WorkerMessage<WorkerErrorPayload>);
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert HTML to Markdown
 */
function convertHtmlToMarkdown(html: string, fileName: string): WorkerResultPayload {
  const startTime = performance.now();
  const metrics: Record<string, number> = {};

  sendProgress('parse', 20, 'Parsing HTML structure...');

  // Extract title from HTML or use file name
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch?.[1] || fileName.replace(/\.[^/.]+$/, '');

  // Decode HTML entities
  const decoded = html
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '-')
    .replace(/&hellip;/g, '...');

  sendProgress('process', 40, 'Converting HTML to Markdown...');

  let markdown = decoded;

  // Remove script and style tags
  markdown = markdown.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  markdown = markdown.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Handle headings
  markdown = markdown.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, content) => `# ${content.trim()}\n\n`);
  markdown = markdown.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, content) => `## ${content.trim()}\n\n`);
  markdown = markdown.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, content) => `### ${content.trim()}\n\n`);
  markdown = markdown.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, content) => `#### ${content.trim()}\n\n`);
  markdown = markdown.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, (_, content) => `##### ${content.trim()}\n\n`);
  markdown = markdown.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, (_, content) => `###### ${content.trim()}\n\n`);

  // Handle paragraphs
  markdown = markdown.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, content) => `${content.trim()}\n\n`);

  // Handle line breaks
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');

  // Handle bold and italic
  markdown = markdown.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  markdown = markdown.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  markdown = markdown.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  markdown = markdown.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');

  // Handle code blocks
  markdown = markdown.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n');
  markdown = markdown.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

  // Handle links
  markdown = markdown.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Handle images
  markdown = markdown.replace(/<img[^>]*src=["']([^"']*)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi, '![$2]($1)');
  markdown = markdown.replace(/<img[^>]*src=["']([^"']*)["'][^>]*\/?>/gi, '![]($1)');

  // Handle lists
  // Unordered lists
  markdown = markdown.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, content) => {
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n') + '\n';
  });

  // Ordered lists
  markdown = markdown.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, content) => {
    let index = 1;
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, () => `${index++}. $1\n`) + '\n';
  });

  // Handle blockquotes
  markdown = markdown.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
    return content.replace(/(<p[^>]*>|<\/p>)/gi, '').split('\n').map(line => line.trim() ? `> ${line}` : '').join('\n') + '\n\n';
  });

  // Clean up multiple newlines
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  markdown = markdown.trim();

  sendProgress('format', 80, 'Formatting output...');

  // Extract headings
  const headings: Array<{ text: string; level: number }> = [];
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let match;
  while ((match = headingRegex.exec(markdown)) !== null) {
    headings.push({ text: match[2].trim(), level: match[1].length });
  }

  // Count tables (simple markdown table detection)
  const tableRegex = /^\|.*\|$/gm;
  const tableMatches = markdown.match(tableRegex) || [];
  const tables = tableMatches.length > 0 ? Math.ceil(tableMatches.length / 2) : 0;

  // Count images
  const imageRegex = /!\[.*\]\(.*\)/g;
  const images = (markdown.match(imageRegex) || []).length;

  // Check for warnings
  const warnings: WorkerResultPayload['warnings'] = [];

  // Check for unclosed formatting
  const boldOpen = (markdown.match(/\*\*/g) || []).length;
  if (boldOpen % 2 !== 0) {
    warnings.push({
      type: 'formatting',
      message: 'Unclosed bold formatting detected',
      suggestion: 'Ensure all **bold** text has matching closing **',
    });
  }

  const italicOpen = (markdown.match(/\*(?!\*)/g) || []).length;
  if (italicOpen % 2 !== 0) {
    warnings.push({
      type: 'formatting',
      message: 'Unclosed italic formatting detected',
      suggestion: 'Ensure all *italic* text has matching closing *',
    });
  }

  // Check for missing H1
  if (!headings.some(h => h.level === 1)) {
    warnings.push({
      type: 'heading',
      message: 'No H1 heading found',
      suggestion: 'Add a main heading (#) to your document',
    });
  }

  const endTime = performance.now();
  metrics.parse = (endTime - startTime) * 0.2;
  metrics.process = (endTime - startTime) * 0.4;
  metrics.format = (endTime - startTime) * 0.2;
  metrics.validate = (endTime - startTime) * 0.2;

  sendProgress('validate', 95, 'Validating output...');

  return {
    content: markdown,
    title,
    headings,
    tables,
    images,
    warnings,
    metrics: {
      totalTime: endTime - startTime,
      stages: metrics,
    },
  };
}

/**
 * Convert TXT to Markdown
 */
function convertTxtToMarkdown(text: string, fileName: string): WorkerResultPayload {
  const startTime = performance.now();
  const metrics: Record<string, number> = {};

  sendProgress('parse', 30, 'Reading text content...');

  const title = fileName.replace(/\.[^/.]+$/, '');

  sendProgress('process', 60, 'Formatting text...');

  // Simple text processing - preserve line breaks
  let markdown = text.trim();

  // Detect potential headings (lines in ALL CAPS or ending with :)
  markdown = markdown.split('\n').map(line => {
    if (line.trim().length === 0) return '';
    // Check if line looks like a heading (all caps or ends with colon)
    if (/^[A-Z\s]+$/.test(line.trim()) || line.trim().endsWith(':')) {
      return `## ${line.trim()}`;
    }
    return line;
  }).join('\n');

  // Clean up multiple newlines
  markdown = markdown.replace(/\n{3,}/g, '\n\n');

  sendProgress('format', 85, 'Finalizing output...');

  const headings: Array<{ text: string; level: number }> = [];
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let match;
  while ((match = headingRegex.exec(markdown)) !== null) {
    headings.push({ text: match[2].trim(), level: match[1].length });
  }

  const endTime = performance.now();
  metrics.parse = (endTime - startTime) * 0.3;
  metrics.process = (endTime - startTime) * 0.5;
  metrics.format = (endTime - startTime) * 0.2;

  return {
    content: markdown,
    title,
    headings,
    tables: 0,
    images: 0,
    warnings: [],
    metrics: {
      totalTime: endTime - startTime,
      stages: metrics,
    },
  };
}

/**
 * Convert RTF to Markdown (basic support)
 */
function convertRtfToMarkdown(rtf: string, fileName: string): WorkerResultPayload {
  const startTime = performance.now();
  const metrics: Record<string, number> = {};

  sendProgress('parse', 25, 'Parsing RTF...');

  const title = fileName.replace(/\.[^/.]+$/, '');

  sendProgress('process', 50, 'Converting RTF to Markdown...');

  // Basic RTF parsing - remove control words and extract text
  let markdown = rtf
    // Remove RTF header
    .replace(/\{\\rtf1.*?\}/gs, '')
    // Remove control words (e.g., \b, \i, \par)
    .replace(/\\[a-z]+[0-9]*/g, '')
    // Remove special characters
    .replace(/[{}]/g, '')
    // Decode common RTF escapes
    .replace(/\\'([0-9a-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // Split into paragraphs
  markdown = markdown.split('\\par').map(p => p.trim()).filter(p => p).join('\n\n');

  sendProgress('format', 80, 'Formatting output...');

  const headings: Array<{ text: string; level: number }> = [];
  const tables = 0;
  const images = 0;

  const endTime = performance.now();
  metrics.parse = (endTime - startTime) * 0.25;
  metrics.process = (endTime - startTime) * 0.5;
  metrics.format = (endTime - startTime) * 0.25;

  return {
    content: markdown,
    title,
    headings,
    tables,
    images,
    warnings: [],
    metrics: {
      totalTime: endTime - startTime,
      stages: metrics,
    },
  };
}

/**
 * Convert DOCX to Markdown using mammoth.js
 */
async function convertDocxToMarkdown(base64Content: string, fileName: string): Promise<WorkerResultPayload> {
  const startTime = performance.now();
  const metrics: Record<string, number> = {};

  sendProgress('parse', 20, 'Loading DOCX file...');

  try {
    // Import mammoth dynamically
    // Note: mammoth must be bundled with the worker
    const mammoth = await import('mammoth');

    sendProgress('process', 40, 'Extracting content from DOCX...');

    // Convert base64 to ArrayBuffer
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Convert DOCX to HTML using mammoth
    const result = await mammoth.convertToHtml(
      { arrayBuffer: bytes.buffer },
      {
        styleMap: [
          'p[style-name="Title"] => h1:fresh',
          'p[style-name="Heading 1"] => h1:fresh',
          'p[style-name="Heading 2"] => h2:fresh',
          'p[style-name="Heading 3"] => h3:fresh',
          'p[style-name="Heading 4"] => h4:fresh',
          'p[style-name="Heading 5"] => h5:fresh',
          'p[style-name="Heading 6"] => h6:fresh',
        ],
      }
    );

    const html = result.value;
    const warnings = result.messages.map(msg => ({
      type: 'docx',
      message: msg.message,
      context: { type: msg.type },
    }));

    sendProgress('format', 70, 'Converting to Markdown...');

    // Convert HTML to Markdown
    const markdownResult = convertHtmlToMarkdown(html, fileName);

    const endTime = performance.now();
    metrics.parse = (endTime - startTime) * 0.3;
    metrics.process = (endTime - startTime) * 0.4;
    metrics.format = (endTime - startTime) * 0.3;

    return {
      ...markdownResult,
      warnings: [...warnings, ...markdownResult.warnings],
      metrics: {
        totalTime: endTime - startTime,
        stages: metrics,
      },
    };
  } catch (error) {
    throw new Error(
      `Failed to convert DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============================================================================
// Main Worker Handler
// ============================================================================

/**
 * Handle conversion request
 */
async function handleConvert(message: WorkerMessage<WorkerConvertPayload>) {
  if (isProcessing) {
    sendError(
      'BUSY',
      'Worker is already processing a conversion',
      'Please wait for the current conversion to complete'
    );
    return;
  }

  const { payload, requestId } = message;

  if (!payload || !isConvertPayload(payload)) {
    sendError(
      'INVALID_PAYLOAD',
      'Invalid conversion payload',
      'Ensure all required fields are provided'
    );
    return;
  }

  isProcessing = true;
  currentRequestId = requestId || null;

  try {
    sendProgress('init', 5, 'Initializing conversion...');

    let result: WorkerResultPayload;

    switch (payload.fileType) {
      case 'html':
        result = convertHtmlToMarkdown(payload.content, payload.fileName);
        break;

      case 'txt':
        result = convertTxtToMarkdown(payload.content, payload.fileName);
        break;

      case 'rtf':
        result = convertRtfToMarkdown(payload.content, payload.fileName);
        break;

      case 'docx':
        if (!payload.isBase64) {
          throw new Error('DOCX files must be base64 encoded');
        }
        result = await convertDocxToMarkdown(payload.content, payload.fileName);
        break;

      default:
        throw new Error(`Unsupported file type: ${payload.fileType}`);
    }

    sendProgress('complete', 100, 'Conversion complete!');
    sendResult(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;

    sendError(
      'CONVERSION_ERROR',
      errorMessage,
      'Please check the file format and try again',
      { fileType: payload.fileType, fileName: payload.fileName },
      stack
    );
  } finally {
    isProcessing = false;
    currentRequestId = null;
  }
}

/**
 * Handle cancel request
 */
function handleCancel() {
  if (isProcessing) {
    isProcessing = false;
    currentRequestId = null;
    sendProgress('cancel', 100, 'Conversion cancelled by user');
  }
}

// ============================================================================
// Worker Event Handlers
// ============================================================================

self.onmessage = (event: MessageEvent) => {
  const message = event.data;

  if (!isWorkerMessage(message)) {
    sendError('INVALID_MESSAGE', 'Invalid message format received');
    return;
  }

  switch (message.type) {
    case 'CONVERT':
      handleConvert(message);
      break;

    case 'CANCEL':
      handleCancel();
      break;

    default:
      sendError('UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${message.type}`);
  }
};

// Handle worker errors
self.onerror = (error: ErrorEvent) => {
  sendError(
    'WORKER_ERROR',
    error.message || 'Unknown worker error',
    'Worker encountered an error',
    {},
    error.error?.stack
  );
  return false; // Don't suppress default error handling
};

// Handle unhandled promise rejections
self.onunhandledrejection = (event: PromiseRejectionEvent) => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
  sendError(
    'UNHANDLED_REJECTION',
    `Unhandled promise rejection: ${reason}`,
    'An unexpected error occurred',
    {},
    event.reason instanceof Error ? event.reason.stack : undefined
  );
};

// Send ready signal when worker is initialized
self.postMessage({
  type: 'WORKER_READY',
  timestamp: Date.now(),
} satisfies WorkerMessage);
