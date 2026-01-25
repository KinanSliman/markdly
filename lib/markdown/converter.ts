import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

// Google Docs API types (partial)
interface DocsParagraph {
  elements?: Array<{
    textRun?: {
      content?: string;
      textStyle?: {
        bold?: boolean;
        italic?: boolean;
        underline?: boolean;
        link?: { url?: string };
        fontSize?: { magnitude?: number; unit?: string };
      };
    };
    inlineObjectElement?: {
      inlineObjectId?: string;
    };
  }>;
  bullet?: {
    listId?: string;
    nestingLevel?: number;
  };
  paragraphStyle?: {
    namedStyleType?: "NORMAL_TEXT" | "HEADING_1" | "HEADING_2" | "HEADING_3" | "HEADING_4" | "HEADING_5" | "HEADING_6";
    alignment?: "START" | "CENTER" | "END" | "JUSTIFY";
  };
}

interface DocsTable {
  tableRows?: Array<{
    tableCells?: Array<{
      content?: Array<{
        paragraph?: DocsParagraph;
      }>;
    }>;
  }>;
}

interface DocsStructuralElement {
  paragraph?: DocsParagraph;
  table?: DocsTable;
  sectionBreak?: any;
}

interface DocsDocument {
  documentId?: string;
  title?: string;
  body?: {
    content?: DocsStructuralElement[];
  };
  inlineObjects?: {
    [key: string]: {
      inlineObjectProperties?: {
        embeddedObject?: {
          imageProperties?: {
            contentUri?: string;
            sourceUri?: string;
          };
        };
      };
    };
  };
}

export interface GoogleDocContent {
  title: string;
  content: string;
  images: Array<{ url: string; alt: string }>;
  headings: Array<{ text: string; level: number }>;
  tables: Array<{ rows: string[][] }>;
}

/**
 * Fetches a Google Doc and converts it to Markdown
 * Accepts either an access token or refresh token
 */
export async function convertGoogleDocToMarkdown(
  docId: string,
  token: string,
  isAccessToken = true
): Promise<GoogleDocContent> {
  // Create an OAuth2Client
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  if (isAccessToken) {
    oauth2Client.setCredentials({ access_token: token });
  } else {
    oauth2Client.setCredentials({ refresh_token: token });
  }

  const docs = google.docs({ version: "v1", auth: oauth2Client });

  try {
    const response = await docs.documents.get({
      documentId: docId,
    });

    const document = response.data as DocsDocument;
    const title = document.title || "Untitled";

    let markdown = "";
    const images: Array<{ url: string; alt: string }> = [];
    const headings: Array<{ text: string; level: number }> = [];
    const tables: Array<{ rows: string[][] }> = [];

    // Extract inline images for reference
    const inlineImages = extractInlineImages(document);

    if (document.body && document.body.content) {
      for (const element of document.body.content) {
        if (element.paragraph) {
          const paragraphMarkdown = processParagraph(element.paragraph, images, headings, inlineImages);
          markdown += paragraphMarkdown;
        } else if (element.table) {
          const { markdown: tableMarkdown, tableData } = processTable(element.table);
          markdown += tableMarkdown;
          if (tableData.length > 0) {
            tables.push({ rows: tableData });
          }
        }
      }
    }

    return {
      title,
      content: markdown.trim(),
      images,
      headings,
      tables,
    };
  } catch (error) {
    console.error("Error fetching Google Doc:", error);
    throw new Error("Failed to fetch Google Doc");
  }
}

/**
 * Extracts inline images from the document
 */
function extractInlineImages(document: DocsDocument): Map<string, string> {
  const images = new Map<string, string>();

  if (document.inlineObjects) {
    for (const [objectId, inlineObject] of Object.entries(document.inlineObjects)) {
      const embeddedObject = inlineObject.inlineObjectProperties?.embeddedObject;
      const imageProps = embeddedObject?.imageProperties;

      if (imageProps?.contentUri || imageProps?.sourceUri) {
        images.set(objectId, imageProps.contentUri || imageProps.sourceUri || "");
      }
    }
  }

  return images;
}

/**
 * Processes a paragraph and converts it to Markdown
 */
function processParagraph(
  paragraph: DocsParagraph,
  images: Array<{ url: string; alt: string }>,
  headings: Array<{ text: string; level: number }>,
  inlineImages: Map<string, string>
): string {
  const elements = paragraph.elements || [];
  const paragraphStyle = paragraph.paragraphStyle;

  let text = "";
  let isHeading = false;
  let headingLevel = 0;
  let isCodeBlock = false;

  // Check for heading style
  if (paragraphStyle && paragraphStyle.namedStyleType) {
    const style = paragraphStyle.namedStyleType;
    if (style.startsWith("HEADING_")) {
      isHeading = true;
      headingLevel = parseInt(style.replace("HEADING_", ""), 10);
    }
  }

  // Process text elements
  for (const element of elements) {
    if (element.textRun) {
      const content = element.textRun.content || "";
      const textStyle = element.textRun.textStyle || {};

      let formattedText = content;

      // Check for code block (monospace font or specific styling)
      if (textStyle.fontSize && textStyle.fontSize.magnitude && textStyle.fontSize.magnitude < 10) {
        isCodeBlock = true;
      }

      // Apply formatting (skip for code blocks)
      if (!isCodeBlock) {
        if (textStyle.bold) {
          formattedText = `**${formattedText}**`;
        }
        if (textStyle.italic) {
          formattedText = `*${formattedText}*`;
        }
        if (textStyle.underline && !textStyle.link) {
          formattedText = `<u>${formattedText}</u>`;
        }

        // Handle links
        if (textStyle.link && textStyle.link.url) {
          const url = textStyle.link.url;
          formattedText = `[${formattedText}](${url})`;
        }
      }

      text += formattedText;
    } else if (element.inlineObjectElement) {
      // Handle inline images
      const inlineObjectId = element.inlineObjectElement.inlineObjectId;
      if (inlineObjectId && inlineImages.has(inlineObjectId)) {
        const imageUrl = inlineImages.get(inlineObjectId)!;
        const altText = "image"; // Could extract from document if available
        images.push({ url: imageUrl, alt: altText });
        text += `![${altText}](${imageUrl})`;
      }
    }
  }

  // Handle bullet points and numbered lists
  if (paragraph.bullet) {
    const nestingLevel = paragraph.bullet.nestingLevel || 0;
    const indent = "  ".repeat(nestingLevel);

    // Check if it's a numbered list (Google Docs uses list IDs that start with numbers)
    const isNumbered = paragraph.bullet.listId && /^\d+/.test(paragraph.bullet.listId);

    if (isNumbered) {
      return `${indent}1. ${text.trim()}\n`;
    }
    return `${indent}- ${text.trim()}\n`;
  }

  // Return formatted text
  if (isHeading) {
    const prefix = "#".repeat(headingLevel);
    headings.push({ text: text.trim(), level: headingLevel });
    return `${prefix} ${text.trim()}\n\n`;
  } else if (isCodeBlock) {
    // Handle code blocks (monospace text)
    return `\`\`\`\n${text}\n\`\`\`\n\n`;
  } else if (text.trim()) {
    return `${text.trim()}\n\n`;
  }

  return "";
}

/**
 * Processes a table and converts it to Markdown
 */
function processTable(table: DocsTable): { markdown: string; tableData: string[][] } {
  if (!table.tableRows || table.tableRows.length === 0) {
    return { markdown: "", tableData: [] };
  }

  const rows = table.tableRows;

  // Extract all cell data
  const tableData: string[][] = [];

  for (const row of rows) {
    const rowData: string[] = [];
    const cells = row.tableCells || [];

    for (const cell of cells) {
      const cellContent = cell.content || [];
      let cellText = "";

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

      rowData.push(cellText.trim());
    }

    tableData.push(rowData);
  }

  // Build Markdown table
  if (tableData.length === 0) {
    return { markdown: "", tableData: [] };
  }

  const headers = tableData[0];
  const dataRows = tableData.slice(1);

  let markdown = "| " + headers.join(" | ") + " |\n";
  markdown += "| " + headers.map(() => "---").join(" | ") + " |\n";

  for (const row of dataRows) {
    markdown += "| " + row.join(" | ") + " |\n";
  }

  markdown += "\n";
  return { markdown, tableData };
}

/**
 * Processes code blocks in the markdown content
 * Detects code patterns and wraps them in proper code fences
 */
export function processCodeBlocks(content: string): string {
  const lines = content.split("\n");
  let result = "";
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check if line is already in a code block
    if (line.trim().startsWith("```")) {
      // Already in code block, copy as-is
      result += line + "\n";
      i++;
      continue;
    }

    // Detect code-like patterns
    const isCodeLine = detectCodeLine(line);

    if (isCodeLine) {
      // Start of code block
      result += "```\n";

      // Collect all consecutive code lines
      while (i < lines.length && detectCodeLine(lines[i])) {
        result += lines[i] + "\n";
        i++;
      }

      // End of code block
      result += "```\n\n";
    } else {
      result += line + "\n";
      i++;
    }
  }

  return result;
}

/**
 * Detects if a line contains code-like patterns
 */
function detectCodeLine(line: string): boolean {
  const trimmed = line.trim();

  // Empty lines don't count as code
  if (!trimmed) return false;

  // Common code patterns
  const codePatterns = [
    /^function\s+\w+/,                    // function foo()
    /^const\s+\w+/,                       // const foo
    /^let\s+\w+/,                         // let foo
    /^var\s+\w+/,                         // var foo
    /^import\s+/,                         // import ...
    /^export\s+/,                         // export ...
    /^from\s+['"]/,                       // from '...'
    /^class\s+\w+/,                       // class Foo
    /^return\s+/,                         // return ...
    /^if\s*\(/,                           // if (
    /^else\s*{/,                          // else {
    /^for\s*\(/,                          // for (
    /^while\s*\(/,                        // while (
    /^try\s*{/,                           // try {
    /^catch\s*\(/,                        // catch (
    /^finally\s*{/,                       // finally {
    /^async\s+function/,                  // async function
    /^await\s+/,                          // await ...
    /^\s+/,                               // Indented code
    /^console\./,                         // console.log
    /^import\s+\{/,                       // import { ...
    /^export\s+\{/,                       // export { ...
    /^const\s+\{/,                        // const { ...
    /^let\s+\{/,                          // let { ...
    /^const\s+\[/,                        // const [
    /^let\s+\[/,                          // let [
    /^#/,                                 // Python/shell comments
    /^\$/,                                // Shell commands
    /^\/\//,                              // Line comments
    /^\{/,                                // Object literal
    /^\[/,                                // Array literal
    /^</,                                 // JSX/HTML
    /^\s*-\s+/,                           // YAML list item
    /^\s*\w+:\s+/,                        // YAML key-value
  ];

  return codePatterns.some((pattern) => pattern.test(trimmed));
}

/**
 * Fixes heading hierarchy in markdown content
 * Ensures proper heading levels without skipping (e.g., H1 -> H3)
 */
export function fixHeadingHierarchy(content: string): string {
  const lines = content.split("\n");
  let currentLevel = 0;
  let result = "";

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.*)$/);

    if (match) {
      const level = match[1].length;
      const text = match[2];

      // Ensure proper hierarchy (no skipping levels)
      if (currentLevel === 0) {
        // First heading - use as-is
        currentLevel = level;
      } else if (level > currentLevel + 1) {
        // Skipping levels - fix it (e.g., H1 -> H3 becomes H1 -> H2)
        const newLevel = currentLevel + 1;
        result += `${"#".repeat(newLevel)} ${text}\n`;
        currentLevel = newLevel;
        continue;
      } else if (level <= currentLevel) {
        // Going back up or same level - use as-is
        currentLevel = level;
      }

      result += line + "\n";
    } else {
      result += line + "\n";
    }
  }

  return result;
}

/**
 * Extracts images from Google Doc content
 * Handles both inline objects and embedded images
 */
export function extractImagesFromDoc(document: any): Array<{ url: string; alt: string }> {
  const images: Array<{ url: string; alt: string }> = [];

  if (!document.body || !document.body.content) {
    return images;
  }

  // Extract from inline objects
  if (document.inlineObjects) {
    for (const [objectId, inlineObject] of Object.entries(document.inlineObjects as Record<string, any>)) {
      const embeddedObject = inlineObject.inlineObjectProperties?.embeddedObject;
      const imageProps = embeddedObject?.imageProperties;

      if (imageProps?.contentUri || imageProps?.sourceUri) {
        images.push({
          url: imageProps.contentUri || imageProps.sourceUri,
          alt: embeddedObject?.title || "image",
        });
      }
    }
  }

  return images;
}

/**
 * Strips comments from Google Doc content
 * Google Docs stores comments in a separate structure
 */
export function stripComments(content: string): string {
  // Google Docs comments are typically not in the main content
  // This is a placeholder for future implementation
  // Real implementation would need to access the document's comments field
  return content;
}

/**
 * Cleans up excessive whitespace in markdown content
 */
export function cleanupWhitespace(content: string): string {
  // Remove multiple consecutive empty lines (keep max 2)
  let cleaned = content.replace(/\n{3,}/g, "\n\n");

  // Remove trailing whitespace on lines
  cleaned = cleaned.split("\n").map(line => line.trimEnd()).join("\n");

  return cleaned;
}

/**
 * Validates and sanitizes markdown output
 */
export function validateMarkdown(content: string): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Check for unclosed code blocks
  const codeBlockMatches = content.match(/```/g);
  if (codeBlockMatches && codeBlockMatches.length % 2 !== 0) {
    warnings.push("Unclosed code block detected");
  }

  // Check for unclosed links
  const linkMatches = content.match(/\[[^\]]*\]\([^)]*\)/g);
  const openBrackets = (content.match(/\[/g) || []).length;
  const closeBrackets = (content.match(/\]/g) || []).length;
  if (openBrackets !== closeBrackets) {
    warnings.push("Unmatched brackets detected");
  }

  // Check for unclosed bold/italic
  const boldMatches = content.match(/\*\*/g);
  if (boldMatches && boldMatches.length % 2 !== 0) {
    warnings.push("Unclosed bold formatting detected");
  }

  const italicMatches = content.match(/\*(?!\*)/g);
  if (italicMatches && italicMatches.length % 2 !== 0) {
    warnings.push("Unclosed italic formatting detected");
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Converts Google Docs list IDs to proper list markers
 */
export function normalizeListMarkers(content: string): string {
  // Google Docs uses special list IDs that we need to handle
  // This function ensures consistent list formatting
  const lines = content.split("\n");
  let result = "";
  let listIndent = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect list items (already processed by processParagraph)
    if (trimmed.match(/^(\s*)[-*+]\s+/)) {
      const indent = (line.match(/^(\s*)/)?.[1] || "").length;
      listIndent = indent;
      result += line + "\n";
    } else if (trimmed === "" && listIndent > 0) {
      // Empty line in list - keep it
      result += line + "\n";
    } else if (trimmed !== "") {
      // Non-list content - reset indent
      listIndent = 0;
      result += line + "\n";
    } else {
      result += line + "\n";
    }
  }

  return result;
}
