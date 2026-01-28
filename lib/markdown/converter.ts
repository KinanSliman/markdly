import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

// Constants for code block detection
const MONOSPACE_FONTS = ["Courier New", "Consolas", "Monaco", "monospace", "Courier"];
const SMALL_FONT_SIZE = 10; // Points - threshold for code block detection
const CODE_INDENTATION = 4; // Minimum spaces for code indentation

// Node.js Buffer for converting blobs to base64
const Buffer = globalThis.Buffer || require("buffer").Buffer;

// Google Docs API types (partial)
interface DocsParagraph {
  elements?: Array<{
    textRun?: {
      content?: string;
      textStyle?: {
        bold?: boolean;
        italic?: boolean;
        underline?: boolean;
        strikethrough?: boolean;
        link?: { url?: string };
        fontSize?: { magnitude?: number; unit?: string };
        weightedFontFamily?: { fontFamily?: string };
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
    direction?: "LEFT_TO_RIGHT" | "RIGHT_TO_LEFT";
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
  warnings: ConversionWarning[];
}

export interface ConversionWarning {
  type: "code_block" | "heading" | "table" | "list" | "formatting";
  message: string;
  suggestion: string;
  context?: string;
}

/**
 * Fetches a Google Doc and converts it to Markdown
 * Accepts either an access token or refresh token
 * Optionally processes images and uploads to Cloudinary
 */
export async function convertGoogleDocToMarkdown(
  docId: string,
  token: string,
  isAccessToken = true,
  cloudinaryFolder?: string
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
    const warnings: ConversionWarning[] = [];

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

    // Extract inline images for reference
    const inlineImages = extractInlineImages(document);

    if (document.body && document.body.content) {
      for (const element of document.body.content) {
        if (element.paragraph) {
          const result = processParagraph(
            element.paragraph,
            images,
            headings,
            inlineImages,
            listState,
            headingState,
            warnings
          );
          markdown += result;
        } else if (element.table) {
          const { markdown: tableMarkdown, tableData, warnings: tableWarnings } = processTable(element.table);
          markdown += tableMarkdown;
          if (tableData.length > 0) {
            tables.push({ rows: tableData });
          }
          warnings.push(...tableWarnings);
        }
      }
    }

    // Process images and upload to Cloudinary if folder is specified
    if (cloudinaryFolder && images.length > 0) {
      // Get the access token for fetching images
      const accessTokenResponse = isAccessToken ? { token } : await oauth2Client.getAccessToken();
      const accessToken = accessTokenResponse.token!;

      for (const image of images) {
        try {
          const cloudinaryUrl = await processGoogleDocImage(image.url, accessToken, cloudinaryFolder);
          // Replace the image URL in the markdown
          const escapedUrl = image.url.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
          const imageRegex = new RegExp(`!\\[(.*?)\\]\\(${escapedUrl}\\)`, "g");
          markdown = markdown.replace(imageRegex, (match, altText) => {
            return `![${altText}](${cloudinaryUrl})`;
          });
        } catch (error) {
          console.error(`Failed to process image ${image.url}:`, error);
          // Keep original URL if upload fails
        }
      }
    }

    return {
      title,
      content: markdown.trim(),
      images,
      headings,
      tables,
      warnings,
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
 * Fetches an image from Google Docs with authentication and uploads to Cloudinary
 * Google Docs images require authentication via the access token
 */
export async function processGoogleDocImage(
  imageUrl: string,
  accessToken: string,
  folder: string
): Promise<string> {
  try {
    // Google Docs images need to be fetched with the access token
    // The contentUri is a direct URL but requires OAuth authentication
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
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = blob.type || "image/png";
    const dataUri = `data:${mimeType};base64,${base64}`;

    // Upload to Cloudinary
    const result = await uploadImageToCloudinary(dataUri, { folder });

    return result.secureUrl;
  } catch (error) {
    console.error("Error processing Google Doc image:", error);
    throw error;
  }
}

/**
 * Processes a paragraph and converts it to Markdown
 * Enhanced with Phase 2 improvements: code block detection, list nesting, heading validation
 */
function processParagraph(
  paragraph: DocsParagraph,
  images: Array<{ url: string; alt: string }>,
  headings: Array<{ text: string; level: number }>,
  inlineImages: Map<string, string>,
  listState: { currentListId: string | null; currentNestingLevel: number; isNumbered: boolean },
  headingState: { lastLevel: number; skippedLevels: number },
  warnings: ConversionWarning[]
): string {
  const elements = paragraph.elements || [];
  const paragraphStyle = paragraph.paragraphStyle;

  let text = "";
  let isHeading = false;
  let headingLevel = 0;
  let isCodeBlock = false;
  let codeBlockReason: string | null = null;

  // Check for heading style
  if (paragraphStyle && paragraphStyle.namedStyleType) {
    const style = paragraphStyle.namedStyleType;
    if (style.startsWith("HEADING_")) {
      isHeading = true;
      headingLevel = parseInt(style.replace("HEADING_", ""), 10);
    }
  }

  // Process text elements with enhanced code block detection
  for (const element of elements) {
    if (element.textRun) {
      const content = element.textRun.content || "";
      const textStyle = element.textRun.textStyle || {};

      let formattedText = content;

      // Enhanced code block detection using multiple heuristics
      const codeBlockDetection = detectCodeBlockInParagraph(textStyle, content, paragraphStyle);
      if (codeBlockDetection.isCodeBlock && !isCodeBlock) {
        isCodeBlock = true;
        codeBlockDetection.reason && (codeBlockReason = codeBlockDetection.reason);
      }

      // Apply formatting (skip for code blocks)
      if (!isCodeBlock) {
        if (textStyle.bold) {
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

  // Handle bullet points and numbered lists with enhanced nesting
  if (paragraph.bullet) {
    const nestingLevel = paragraph.bullet.nestingLevel || 0;
    const listId = paragraph.bullet.listId || null;

    // Check if it's a numbered list
    const isNumbered = !!(listId && /^\d+/.test(listId));

    // Track list state for better nesting handling
    const listChanged = listState.currentListId !== listId;
    const nestingChanged = listState.currentNestingLevel !== nestingLevel;
    const typeChanged = listState.isNumbered !== isNumbered;

    // Warn about mixed list types in the same list
    if (listChanged === false && typeChanged) {
      warnings.push({
        type: "list",
        message: "Mixed bullet and numbered list items detected in the same list",
        suggestion: "Use consistent list types (all bullets or all numbers) for better readability",
        context: `List ID: ${listId}, Nesting level: ${nestingLevel}`,
      });
    }

    // Warn about large nesting level jumps
    if (nestingLevel > listState.currentNestingLevel + 1) {
      warnings.push({
        type: "list",
        message: `List nesting level jumped from ${listState.currentNestingLevel} to ${nestingLevel}`,
        suggestion: "Ensure proper list hierarchy - don't skip nesting levels",
        context: `List ID: ${listId}`,
      });
    }

    listState.currentListId = listId;
    listState.currentNestingLevel = nestingLevel;
    listState.isNumbered = isNumbered;

    const indent = "  ".repeat(nestingLevel);

    if (isNumbered) {
      return `${indent}1. ${text.trim()}\n`;
    }
    return `${indent}- ${text.trim()}\n`;
  }

  // Return formatted text
  if (isHeading) {
    // Validate heading hierarchy - detect skipped levels
    if (headingState.lastLevel > 0 && headingLevel > headingState.lastLevel + 1) {
      headingState.skippedLevels++;
      warnings.push({
        type: "heading",
        message: `Heading level skipped from H${headingState.lastLevel} to H${headingLevel}`,
        suggestion: `Use H${headingState.lastLevel + 1} instead of H${headingLevel} for proper document structure`,
        context: `Heading: "${text.trim()}"`,
      });
    }

    headingState.lastLevel = headingLevel;

    const prefix = "#".repeat(headingLevel);
    headings.push({ text: text.trim(), level: headingLevel });
    return `${prefix} ${text.trim()}\n\n`;
  } else if (isCodeBlock) {
    // Handle code blocks with language detection
    const language = detectCodeLanguage(text);
    const codeFence = language ? `\`\`\`${language}` : "```";

    // Warn about code blocks without language
    if (!language && codeBlockReason) {
      warnings.push({
        type: "code_block",
        message: "Code block detected but no language specified",
        suggestion: "Add a language identifier after the code fence (e.g., ```javascript)",
        context: `Detection reason: ${codeBlockReason}`,
      });
    }

    return `${codeFence}\n${text.trim()}\n\`\`\`\n\n`;
  } else if (text.trim()) {
    return `${text.trim()}\n\n`;
  }

  return "";
}

/**
 * Enhanced code block detection using multiple heuristics
 * Returns whether the paragraph is likely a code block and the detection reason
 */
function detectCodeBlockInParagraph(
  textStyle: any,
  content: string,
  paragraphStyle?: any
): { isCodeBlock: boolean; reason: string | null } {
  const trimmedContent = content.trim();

  // Heuristic 1: Small font size (common for code)
  if (textStyle.fontSize && textStyle.fontSize.magnitude && textStyle.fontSize.magnitude < SMALL_FONT_SIZE) {
    return { isCodeBlock: true, reason: "small_font_size" };
  }

  // Heuristic 2: Monospace font family
  const fontFamily = textStyle.weightedFontFamily?.fontFamily;
  if (fontFamily && MONOSPACE_FONTS.some(f => fontFamily.toLowerCase().includes(f.toLowerCase()))) {
    return { isCodeBlock: true, reason: "monospace_font" };
  }

  // Heuristic 3: Indentation (4+ spaces suggests code)
  const leadingSpaces = content.match(/^(\s+)/)?.[1]?.length || 0;
  if (leadingSpaces >= CODE_INDENTATION && trimmedContent.length > 0) {
    return { isCodeBlock: true, reason: "indentation" };
  }

  // Heuristic 4: Content patterns (common code syntax)
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
    /^async\s+function/,                   // async function
    /^await\s+/,                          // await ...
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
    /^[a-zA-Z_]\w*\s*=/,                  // Variable assignment
    /^\d+\s*$/,                           // Just a number
    /^[a-zA-Z_]\w*\s*\(/,                 // Function call
  ];

  if (trimmedContent && codePatterns.some(pattern => pattern.test(trimmedContent))) {
    return { isCodeBlock: true, reason: "code_pattern" };
  }

  return { isCodeBlock: false, reason: null };
}

/**
 * Detects the programming language of a code block based on content patterns
 */
function detectCodeLanguage(content: string): string | null {
  const trimmed = content.trim();
  const lines = trimmed.split("\n");

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
  const combined = linesToCheck.join("\n");

  for (const [lang, patterns] of Object.entries(languagePatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(combined)) {
        return lang;
      }
    }
  }

  return null;
}

/**
 * Processes a table and converts it to Markdown
 * Enhanced with Phase 2 improvements: merged cell detection
 */
function processTable(table: DocsTable): { markdown: string; tableData: string[][]; warnings: ConversionWarning[] } {
  const warnings: ConversionWarning[] = [];
  if (!table.tableRows || table.tableRows.length === 0) {
    return { markdown: "", tableData: [], warnings };
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

      // Check for empty cells (potential merged cells)
      if (!cellText.trim()) {
        warnings.push({
          type: "table",
          message: "Empty table cell detected",
          suggestion: "This may be a merged cell. Markdown tables don't support cell merging - consider splitting the cell or using HTML tables",
          context: `Row ${tableData.length + 1}, Cell ${rowData.length + 1}`,
        });
      }

      rowData.push(cellText.trim());
    }

    tableData.push(rowData);
  }

  // Build Markdown table
  if (tableData.length === 0) {
    return { markdown: "", tableData: [], warnings };
  }

  const headers = tableData[0];
  const dataRows = tableData.slice(1);

  let markdown = "| " + headers.join(" | ") + " |\n";
  markdown += "| " + headers.map(() => "---").join(" | ") + " |\n";

  for (const row of dataRows) {
    markdown += "| " + row.join(" | ") + " |\n";
  }

  markdown += "\n";
  return { markdown, tableData, warnings };
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
