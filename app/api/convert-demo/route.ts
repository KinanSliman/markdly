import { NextRequest, NextResponse } from "next/server";
import { convertGoogleDocToMarkdown } from "@/lib/markdown/converter";
import * as mammoth from "mammoth";

/**
 * POST /api/convert-demo
 * Converts a Google Doc or uploaded file to Markdown without authentication (demo mode)
 * This is a public endpoint for trying Markdly without signing in
 *
 * Request 1 (JSON): { docId: string } - For Google Doc URLs
 * Request 2 (FormData): { file: File } - For uploaded files (HTML, TXT, RTF, DOCX)
 *
 * Note: This requires the Google Doc to be publicly accessible or shared with
 * the Google OAuth client. For private docs, users need to sign in.
 */

export async function POST(request: NextRequest) {
  try {
    // Check if this is a file upload (FormData) or JSON request
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data") || contentType.includes("form-data")) {
      // Handle file upload
      return await handleFileUpload(request);
    } else {
      // Handle JSON request (Google Doc URL)
      return await handleGoogleDocConversion(request);
    }
  } catch (error: any) {
    console.error("Demo conversion error:", error);

    return NextResponse.json(
      {
        error: "Conversion failed",
        details: error.message || "An unexpected error occurred"
      },
      { status: 500 }
    );
  }
}

/**
 * Handle Google Doc URL conversion
 */
async function handleGoogleDocConversion(request: NextRequest) {
  const body = await request.json();
  const { docId } = body;

  if (!docId) {
    return NextResponse.json(
      { error: "docId is required" },
      { status: 400 }
    );
  }

  // Check if we have a demo Google access token configured
  const demoAccessToken = process.env.GOOGLE_DEMO_ACCESS_TOKEN;

  if (!demoAccessToken) {
    return NextResponse.json(
      {
        error: "Demo conversion requires Google OAuth. Please sign in to convert private documents.",
        details: "This endpoint is designed for publicly shared Google Docs. Sign in for full access to your private documents."
      },
      { status: 401 }
    );
  }

  // Attempt to convert the document
  const result = await convertGoogleDocToMarkdown(
    docId,
    demoAccessToken,
    true, // isAccessToken
    undefined // Don't upload images to Cloudinary in demo mode
  );

  return NextResponse.json({
    success: true,
    title: result.title,
    content: result.content,
    images: result.images,
    headings: result.headings,
    tables: result.tables,
    sourceType: "google-doc",
  });
}

/**
 * Handle file upload conversion
 */
async function handleFileUpload(request: NextRequest) {
  // Get the form data
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json(
      { error: "No file provided" },
      { status: 400 }
    );
  }

  // Read the file content
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Convert based on file type
  const fileName = file.name.toLowerCase();
  let markdown: string;
  let originalContent: string;
  let title = file.name.replace(/\.[^/.]+$/, ""); // Remove extension

  if (fileName.endsWith(".html") || fileName.endsWith(".htm")) {
    const text = buffer.toString("utf-8");
    // Clean up excessive newlines
    originalContent = text
      .replace(/\n{4,}/g, "\n\n")
      .replace(/[ \t]+$/gm, "")
      .trim();
    markdown = convertHtmlToMarkdown(text);
  } else if (fileName.endsWith(".txt")) {
    const text = buffer.toString("utf-8");
    // Clean up excessive newlines
    originalContent = text
      .replace(/\n{4,}/g, "\n\n")
      .replace(/[ \t]+$/gm, "")
      .trim();
    markdown = convertTxtToMarkdown(text);
  } else if (fileName.endsWith(".rtf")) {
    const text = buffer.toString("utf-8");
    // Clean up excessive newlines
    originalContent = text
      .replace(/\n{4,}/g, "\n\n")
      .replace(/[ \t]+$/gm, "")
      .trim();
    markdown = convertRtfToMarkdown(text);
  } else if (fileName.endsWith(".docx")) {
    // For DOCX, use mammoth.js to convert to HTML first, then to Markdown
    const htmlResult = await mammoth.convertToHtml({ buffer });
    const html = htmlResult.value; // The HTML content
    markdown = convertHtmlToMarkdown(html);

    // Also extract raw text for the original content preview
    const textResult = await mammoth.extractRawText({ buffer });
    // Clean up excessive newlines from Word/Google Docs formatting
    originalContent = textResult.value
      .replace(/\n{4,}/g, "\n\n") // Max 2 newlines
      .replace(/[ \t]+$/gm, "") // Remove trailing spaces/tabs
      .trim(); // Trim leading/trailing whitespace
  } else if (fileName.endsWith(".doc")) {
    // For legacy .doc files, we can't directly convert with mammoth
    // Users should save as .docx or export as HTML first
    return NextResponse.json(
      { error: "Legacy .doc format not supported. Please save as .docx or export as HTML." },
      { status: 400 }
    );
  } else {
    return NextResponse.json(
      { error: "Unsupported file type. Please use HTML, RTF, TXT, or DOCX files." },
      { status: 400 }
    );
  }

  // Extract stats
  const headings = extractHeadings(markdown);
  const tables = extractTables(markdown);
  const images = extractImages(markdown);

  return NextResponse.json({
    success: true,
    title,
    content: markdown,
    images,
    headings,
    tables,
    sourceType: "file-upload",
    originalContent,
  });
}

/**
 * Convert HTML to Markdown
 */
function convertHtmlToMarkdown(html: string): string {
  let markdown = html;

  // Remove script and style tags
  markdown = markdown.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  markdown = markdown.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // Convert headings
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n");
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n");
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n");
  markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n");
  markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, "##### $1\n\n");
  markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, "###### $1\n\n");

  // Convert bold and italic
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
  markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");

  // Convert links
  markdown = markdown.replace(/<a[^>]*href=["'](.*?)["'][^>]*>(.*?)<\/a>/gi, "[$2]($1)");

  // Convert images
  markdown = markdown.replace(/<img[^>]*src=["'](.*?)["'][^>]*alt=["'](.*?)["'][^>]*>/gi, "![$2]($1)");
  markdown = markdown.replace(/<img[^>]*src=["'](.*?)["'][^>]*>/gi, "![]($1)");

  // Convert paragraphs
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n");

  // Convert line breaks
  markdown = markdown.replace(/<br\s*\/?>/gi, "\n");

  // Convert lists
  markdown = markdown.replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
    return content.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n") + "\n";
  });
  markdown = markdown.replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, content) => {
    let i = 1;
    return content.replace(/<li[^>]*>(.*?)<\/li>/gi, () => `${i++}. $1\n`) + "\n";
  });

  // Convert code blocks
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");
  markdown = markdown.replace(/<pre[^>]*>(.*?)<\/pre>/gis, "```\n$1\n```\n\n");

  // Convert blockquotes
  markdown = markdown.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (match, content) => {
    return content.split("\n").map((line: string) => line.trim() ? `> ${line}` : "").join("\n") + "\n\n";
  });

  // Convert tables
  markdown = markdown.replace(/<table[^>]*>(.*?)<\/table>/gis, (match, content) => {
    return convertHtmlTableToMarkdown(content);
  });

  // Remove remaining HTML tags
  markdown = markdown.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  markdown = markdown
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&copy;/g, "©")
    .replace(/&reg;/g, "®")
    .replace(/&trade;/g, "™");

  // Clean up whitespace
  markdown = markdown
    .replace(/\n{3,}/g, "\n\n") // Max 2 newlines
    .replace(/[ \t]+\n/g, "\n") // Remove trailing spaces
    .trim();

  return markdown;
}

/**
 * Convert HTML table to Markdown table
 */
function convertHtmlTableToMarkdown(htmlTable: string): string {
  const rows: string[][] = [];

  // Extract rows
  const rowMatches = htmlTable.match(/<tr[^>]*>(.*?)<\/tr>/gis);
  if (!rowMatches) return "";

  rowMatches.forEach((rowMatch, rowIndex) => {
    const cells: string[] = [];
    const cellMatches = rowMatch.match(/<t[dh][^>]*>(.*?)<\/t[dh]>/gis);

    if (cellMatches) {
      cellMatches.forEach((cellMatch) => {
        // Extract cell content and clean HTML
        const content = cellMatch
          .replace(/<t[dh][^>]*>/, "")
          .replace(/<\/t[dh]>/, "")
          .replace(/<[^>]+>/g, "") // Remove any remaining HTML tags
          .replace(/\s+/g, " ") // Normalize whitespace
          .trim();
        cells.push(content);
      });
    }

    rows.push(cells);
  });

  if (rows.length === 0) return "";

  // Build Markdown table
  const headers = rows[0];
  const dataRows = rows.slice(1);

  let markdown = "| " + headers.join(" | ") + " |\n";
  markdown += "| " + headers.map(() => "---").join(" | ") + " |\n";

  for (const row of dataRows) {
    markdown += "| " + row.join(" | ") + " |\n";
  }

  markdown += "\n";
  return markdown;
}

/**
 * Convert plain text to Markdown
 */
function convertTxtToMarkdown(text: string): string {
  // Simple text to markdown conversion
  // Preserve line breaks and basic formatting
  return text
    .replace(/\r\n/g, "\n") // Normalize line endings
    .replace(/\n{3,}/g, "\n\n") // Max 2 newlines
    .trim();
}

/**
 * Convert RTF to Markdown (basic implementation)
 */
function convertRtfToMarkdown(rtf: string): string {
  // Basic RTF to text conversion
  // Remove RTF control words and keep readable text
  let text = rtf
    .replace(/\{[^}]*\}/g, "") // Remove RTF groups
    .replace(/\\[a-z]+[ ]?/g, "") // Remove control words
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

/**
 * Extract headings from markdown
 */
function extractHeadings(markdown: string): Array<{ text: string; level: number }> {
  const headings: Array<{ text: string; level: number }> = [];
  const lines = markdown.split("\n");

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.*)$/);
    if (match) {
      headings.push({
        text: match[2].trim(),
        level: match[1].length
      });
    }
  }

  return headings;
}

/**
 * Extract tables from markdown
 */
function extractTables(markdown: string): Array<{ rows: string[][] }> {
  const tables: Array<{ rows: string[][] }> = [];
  const lines = markdown.split("\n");
  let currentTable: string[][] = [];
  let inTable = false;

  for (const line of lines) {
    // Check if line is a table row
    if (line.match(/^\|.*\|$/)) {
      inTable = true;
      const cells = line
        .split("|")
        .map(c => c.trim())
        .filter(c => c.length > 0);
      currentTable.push(cells);
    } else if (inTable) {
      // End of table
      if (currentTable.length > 1) {
        tables.push({ rows: currentTable });
      }
      currentTable = [];
      inTable = false;
    }
  }

  // Handle table at end of file
  if (inTable && currentTable.length > 1) {
    tables.push({ rows: currentTable });
  }

  return tables;
}

/**
 * Extract images from markdown
 */
function extractImages(markdown: string): Array<{ url: string; alt: string }> {
  const images: Array<{ url: string; alt: string }> = [];
  const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;

  while ((match = regex.exec(markdown)) !== null) {
    images.push({
      alt: match[1],
      url: match[2]
    });
  }

  return images;
}
