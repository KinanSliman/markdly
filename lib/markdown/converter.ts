import { google } from "googleapis";

export interface GoogleDocContent {
  title: string;
  content: string;
  images: Array<{ url: string; alt: string }>;
  headings: Array<{ text: string; level: number }>;
  tables: Array<{ rows: string[][] }>;
}

/**
 * Fetches a Google Doc and converts it to Markdown
 */
export async function convertGoogleDocToMarkdown(
  docId: string,
  accessToken: string
): Promise<GoogleDocContent> {
  const docs = google.docs({ version: "v1", auth: accessToken });

  try {
    const response = await docs.documents.get({
      documentId: docId,
    });

    const document = response.data;
    const title = document.title || "Untitled";

    let markdown = "";
    const images: Array<{ url: string; alt: string }> = [];
    const headings: Array<{ text: string; level: number }> = [];
    const tables: Array<{ rows: string[][] }> = [];

    if (document.body && document.body.content) {
      for (const element of document.body.content) {
        if (element.paragraph) {
          const paragraphMarkdown = processParagraph(element.paragraph, images, headings);
          markdown += paragraphMarkdown;
        } else if (element.table) {
          const tableMarkdown = processTable(element.table);
          markdown += tableMarkdown;
          tables.push({ rows: element.table.tableRows?.map(row =>
            row.tableCells?.map(cell =>
              cell.content?.map(c => c.paragraph?.elements?.map(e => e.textRun?.content || "").join("") || "").join("") || ""
            ) || []
          ) || [] });
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

function processParagraph(
  paragraph: any,
  images: Array<{ url: string; alt: string }>,
  headings: Array<{ text: string; level: number }>
): string {
  const elements = paragraph.elements || [];
  const paragraphStyle = paragraph.paragraphStyle;

  let text = "";
  let isHeading = false;
  let headingLevel = 0;

  // Check for heading
  if (paragraphStyle && paragraphStyle.namedStyleType) {
    const style = paragraphStyle.namedStyleType;
    if (style === "HEADING_1") {
      isHeading = true;
      headingLevel = 1;
    } else if (style === "HEADING_2") {
      isHeading = true;
      headingLevel = 2;
    } else if (style === "HEADING_3") {
      isHeading = true;
      headingLevel = 3;
    } else if (style === "HEADING_4") {
      isHeading = true;
      headingLevel = 4;
    } else if (style === "HEADING_5") {
      isHeading = true;
      headingLevel = 5;
    } else if (style === "HEADING_6") {
      isHeading = true;
      headingLevel = 6;
    }
  }

  // Process text elements
  for (const element of elements) {
    if (element.textRun) {
      const content = element.textRun.content || "";
      const textStyle = element.textRun.textStyle || {};

      let formattedText = content;

      // Apply formatting
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
      if (textStyle.link) {
        const url = textStyle.link.url;
        formattedText = `[${formattedText}](${url})`;
      }

      text += formattedText;
    } else if (element.inlineObjectElement) {
      // Handle inline images
      const inlineObjectId = element.inlineObjectElement.inlineObjectId;
      // Note: Image extraction would need the full document with inlineObjects
      // This is a simplified version
    }
  }

  // Handle bullet points
  if (paragraph.bullet) {
    const prefix = paragraph.bullet.listId ? "- " : "";
    return `${prefix}${text}\n`;
  }

  // Return formatted text
  if (isHeading) {
    const prefix = "#".repeat(headingLevel);
    headings.push({ text: text.trim(), level: headingLevel });
    return `${prefix} ${text.trim()}\n\n`;
  } else if (text.trim()) {
    return `${text.trim()}\n\n`;
  }

  return "";
}

function processTable(table: any): string {
  if (!table.tableRows || table.tableRows.length === 0) {
    return "";
  }

  const rows = table.tableRows;
  const headerRow = rows[0];
  const dataRows = rows.slice(1);

  // Extract header cells
  const headers = headerRow.tableCells?.map((cell: any) => {
    return cell.content?.map((c: any) =>
      c.paragraph?.elements?.map((e: any) => e.textRun?.content || "").join("") || ""
    ).join("") || "";
  }) || [];

  // Extract data cells
  const data = dataRows.map((row: any) => {
    return row.tableCells?.map((cell: any) => {
      return cell.content?.map((c: any) =>
        c.paragraph?.elements?.map((e: any) => e.textRun?.content || "").join("") || ""
      ).join("") || "";
    }) || [];
  });

  // Build Markdown table
  let markdown = "| " + headers.join(" | ") + " |\n";
  markdown += "| " + headers.map(() => "---").join(" | ") + " |\n";

  for (const row of data) {
    markdown += "| " + row.join(" | ") + " |\n";
  }

  markdown += "\n";
  return markdown;
}

/**
 * Processes code blocks in the markdown content
 */
export function processCodeBlocks(content: string): string {
  // Detect code blocks based on indentation or specific patterns
  // This is a simplified version - real implementation would be more sophisticated
  const lines = content.split("\n");
  let inCodeBlock = false;
  let result = "";

  for (const line of lines) {
    // Check for code block indicators
    if (line.trim().startsWith("function ") ||
        line.trim().startsWith("const ") ||
        line.trim().startsWith("let ") ||
        line.trim().startsWith("import ") ||
        line.trim().startsWith("export ") ||
        line.trim().startsWith("class ") ||
        line.trim().startsWith("return ") ||
        line.trim().startsWith("if ") ||
        line.trim().startsWith("for ") ||
        line.trim().startsWith("while ")) {

      if (!inCodeBlock) {
        result += "```\n";
        inCodeBlock = true;
      }
      result += line + "\n";
    } else {
      if (inCodeBlock) {
        result += "```\n\n";
        inCodeBlock = false;
      }
      result += line + "\n";
    }
  }

  if (inCodeBlock) {
    result += "```\n";
  }

  return result;
}

/**
 * Fixes heading hierarchy in markdown content
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
        currentLevel = level;
      } else if (level > currentLevel + 1) {
        // Fix skipped levels
        const newLevel = currentLevel + 1;
        result += `${"#".repeat(newLevel)} ${text}\n`;
        currentLevel = newLevel;
        continue;
      }

      currentLevel = level;
      result += line + "\n";
    } else {
      result += line + "\n";
    }
  }

  return result;
}
