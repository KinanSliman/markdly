/**
 * Process Stage
 *
 * Processes parsed paragraphs and tables into markdown content.
 * Handles code blocks, lists, headings, tables, and text formatting.
 */

import { PipelineStage, PipelineContext, PipelineError, ContentBlock, ConversionWarning } from '../types';

interface ListState {
  currentListId?: string;
  nestingLevel: number;
  listType: 'bullet' | 'numbered';
  startIndex: number;
}

interface HeadingState {
  lastLevel: number;
}

export class ProcessStage implements PipelineStage {
  name = 'process';
  description = 'Processes paragraphs and tables into markdown content blocks';

  async execute(context: PipelineContext): Promise<PipelineContext> {
    if (!context.paragraphs) {
      throw new PipelineError('No paragraphs to process', this.name, context);
    }

    const startTime = performance.now();

    try {
      const contentBlocks: ContentBlock[] = [];
      const warnings: ConversionWarning[] = [];

      // Initialize state trackers
      const listState: ListState = {
        currentListId: undefined,
        nestingLevel: 0,
        listType: 'bullet',
        startIndex: 1,
      };

      const headingState: HeadingState = {
        lastLevel: 0,
      };

      // Process paragraphs
      for (const paragraph of context.paragraphs) {
        const result = this.processParagraph(paragraph, listState, headingState, warnings);
        if (result) {
          contentBlocks.push(result);
        }
      }

      // Process tables (if any)
      const tables = context.stageData[this.name]?.tables || [];
      for (const table of tables) {
        const result = this.processTable(table, warnings);
        if (result) {
          contentBlocks.push(result);
        }
      }

      // Store processed blocks
      context.contentBlocks = contentBlocks;

      // Merge warnings
      context.warnings.push(...warnings);

      // Update metrics
      const endTime = performance.now();
      context.metrics.processTime = endTime - startTime;

      // Update metadata
      if (!context.stageData[this.name]) {
        context.stageData[this.name] = {};
      }
      context.stageData[this.name].contentBlockCount = contentBlocks.length;

      return context;
    } catch (error: any) {
      throw new PipelineError(
        `Failed to process content: ${error.message}`,
        this.name,
        context,
        error
      );
    }
  }

  /**
   * Processes a single paragraph into a content block
   */
  private processParagraph(
    paragraph: any,
    listState: ListState,
    headingState: HeadingState,
    warnings: ConversionWarning[]
  ): ContentBlock | null {
    if (!paragraph || !paragraph.elements) {
      return null;
    }

    // Check for list
    if (paragraph.bullet) {
      return this.processListParagraph(paragraph, listState, warnings);
    }

    // Check for heading
    const headingLevel = this.getHeadingLevel(paragraph);
    if (headingLevel > 0) {
      return this.processHeading(paragraph, headingLevel, headingState, warnings);
    }

    // Check for code block
    const codeBlockResult = this.detectCodeBlockInParagraph(paragraph);
    if (codeBlockResult.isCodeBlock) {
      return this.processCodeBlock(paragraph, codeBlockResult, warnings);
    }

    // Regular paragraph
    return this.processRegularParagraph(paragraph);
  }

  /**
   * Processes a list paragraph
   */
  private processListParagraph(
    paragraph: any,
    listState: ListState,
    warnings: ConversionWarning[]
  ): ContentBlock {
    const bullet = paragraph.bullet;
    const nestingLevel = bullet.nestingLevel || 0;
    const listId = bullet.listId;

    // Determine list type
    const listType = this.getListType(paragraph);

    // Check for list type mixing
    if (listState.currentListId && listState.currentListId === listId) {
      if (listState.listType !== listType) {
        warnings.push({
          type: 'list',
          message: 'Mixed bullet and numbered lists detected',
          suggestion: 'Use consistent list types within a single list',
          context: { paragraphIndex: paragraph.paragraphIndex },
        });
      }
    }

    // Check for nesting level jumps
    if (nestingLevel > listState.nestingLevel + 1) {
      warnings.push({
        type: 'list',
        message: `List nesting level jumped from ${listState.nestingLevel} to ${nestingLevel}`,
        suggestion: 'Use proper indentation (2 spaces per level)',
        context: { paragraphIndex: paragraph.paragraphIndex },
      });
    }

    // Update list state
    listState.currentListId = listId;
    listState.nestingLevel = nestingLevel;
    listState.listType = listType;

    // Generate markdown
    const indent = '  '.repeat(nestingLevel);
    const marker = listType === 'bullet' ? '-' : `${listState.startIndex}.`;
    const text = this.extractText(paragraph, false);

    // Increment start index for numbered lists
    if (listType === 'numbered') {
      listState.startIndex++;
    } else {
      listState.startIndex = 1; // Reset for bullet lists
    }

    return {
      type: 'list',
      content: `${indent}${marker} ${text}`,
      metadata: {
        nestingLevel,
        listType,
        listId,
      },
    };
  }

  /**
   * Processes a heading paragraph
   */
  private processHeading(
    paragraph: any,
    level: number,
    headingState: HeadingState,
    warnings: ConversionWarning[]
  ): ContentBlock {
    // Check for skipped heading levels
    if (headingState.lastLevel > 0 && level > headingState.lastLevel + 1) {
      warnings.push({
        type: 'heading',
        message: `Heading level skipped from H${headingState.lastLevel} to H${level}`,
        suggestion: `Use H${headingState.lastLevel + 1} before H${level}`,
        context: { paragraphIndex: paragraph.paragraphIndex, from: headingState.lastLevel, to: level },
      });
    }

    headingState.lastLevel = level;

    const text = this.extractText(paragraph, true);
    const prefix = '#'.repeat(level);

    return {
      type: 'heading',
      content: `${prefix} ${text}`,
      metadata: {
        level,
      },
    };
  }

  /**
   * Detects code block using multiple heuristics
   */
  private detectCodeBlockInParagraph(paragraph: any): {
    isCodeBlock: boolean;
    reason?: string;
    language?: string;
  } {
    const elements = paragraph.elements || [];

    // Heuristic 1: Small font size (< 10 points)
    const firstElement = elements[0];
    if (firstElement?.textStyle?.fontSize?.magnitude) {
      const fontSize = firstElement.textStyle.fontSize.magnitude;
      if (fontSize < 10) {
        return {
          isCodeBlock: true,
          reason: 'small_font_size',
        };
      }
    }

    // Heuristic 2: Monospace font family
    const fontFamily = firstElement?.textStyle?.weightedFontFamily?.fontFamily;
    if (fontFamily && this.isMonospaceFont(fontFamily)) {
      return {
        isCodeBlock: true,
        reason: 'monospace_font',
      };
    }

    // Heuristic 3: Indentation (4+ spaces)
    const text = this.extractText(paragraph, false);
    if (/^ {4,}/.test(text)) {
      return {
        isCodeBlock: true,
        reason: 'indentation',
      };
    }

    // Heuristic 4: Content patterns (function declarations, imports, etc.)
    if (this.matchesCodePattern(text)) {
      return {
        isCodeBlock: true,
        reason: 'code_pattern',
        language: this.detectCodeLanguage(text),
      };
    }

    // Heuristic 5: Named styles (e.g., "Code" style)
    const namedStyle = firstElement?.textStyle?.namedStyleType;
    if (namedStyle && namedStyle.toLowerCase().includes('code')) {
      return {
        isCodeBlock: true,
        reason: 'named_style',
      };
    }

    return { isCodeBlock: false };
  }

  /**
   * Processes a code block paragraph
   */
  private processCodeBlock(
    paragraph: any,
    detection: { isCodeBlock: boolean; reason?: string; language?: string },
    warnings: ConversionWarning[]
  ): ContentBlock {
    const text = this.extractText(paragraph, false);
    const language = detection.language || this.detectCodeLanguage(text);

    warnings.push({
      type: 'code_block',
      message: `Code block detected (${detection.reason})`,
      suggestion: language ? `Language detected: ${language}` : 'Consider adding language identifier',
      context: { reason: detection.reason, language },
    });

    return {
      type: 'code',
      content: `\`\`\`${language}\n${text}\n\`\`\``,
      metadata: {
        reason: detection.reason,
        language,
      },
    };
  }

  /**
   * Processes a regular paragraph
   */
  private processRegularParagraph(paragraph: any): ContentBlock | null {
    const text = this.extractText(paragraph, false);

    if (!text.trim()) {
      return null;
    }

    return {
      type: 'paragraph',
      content: text,
    };
  }

  /**
   * Processes a table
   */
  private processTable(table: any, warnings: ConversionWarning[]): ContentBlock | null {
    if (!table.tableRows || table.tableRows.length === 0) {
      return null;
    }

    const rows: string[] = [];
    let hasMergedCells = false;

    // Process header row
    if (table.tableRows.length > 0) {
      const headerRow = table.tableRows[0];
      const headerCells = this.extractTableCells(headerRow);
      rows.push(`| ${headerCells.join(' | ')} |`);
      rows.push(`| ${headerCells.map(() => '---').join(' | ')} |`);
    }

    // Process data rows
    for (let i = 1; i < table.tableRows.length; i++) {
      const row = table.tableRows[i];
      const cells = this.extractTableCells(row);

      // Check for merged cells (empty cells)
      if (cells.some(cell => !cell.trim())) {
        hasMergedCells = true;
      }

      rows.push(`| ${cells.join(' | ')} |`);
    }

    // Add warning for merged cells
    if (hasMergedCells) {
      warnings.push({
        type: 'table',
        message: 'Table contains empty cells (possibly merged cells)',
        suggestion: 'Markdown tables do not support cell merging. Consider using HTML tables for complex layouts.',
        context: { rowCount: table.tableRows.length },
      });
    }

    return {
      type: 'table',
      content: rows.join('\n'),
      metadata: {
        rowCount: table.tableRows.length,
        hasMergedCells,
      },
    };
  }

  /**
   * Extracts text from a paragraph
   * @param paragraph - The paragraph to extract text from
   * @param isHeading - If true, skip bold formatting (headings should not be bold)
   */
  private extractText(paragraph: any, isHeading = false): string {
    if (!paragraph.elements) {
      return '';
    }

    let text = '';
    let previousStyle: any = null;

    for (const element of paragraph.elements) {
      if (!element || !element.textRun) {
        continue;
      }

      const content = element.textRun.content || '';
      const style = element.textRun.textStyle || {};

      let formattedText = content;

      // Apply formatting
      // Skip bold for headings (headings should not be bold in markdown)
      if (style.bold && !isHeading) {
        formattedText = `**${formattedText}**`;
      }
      if (style.italic) {
        formattedText = `*${formattedText}*`;
      }
      if (style.strikethrough) {
        formattedText = `~~${formattedText}~~`;
      }
      if (style.underline && !style.link) {
        // Underline is not standard markdown, skip or convert to italic
        formattedText = `*${formattedText}*`;
      }

      // Handle links
      if (style.link && style.link.url) {
        formattedText = `[${formattedText}](${style.link.url})`;
      }

      // Check if we need to merge with previous element to avoid doubled markers
      // This happens when adjacent elements have the same formatting
      if (previousStyle && this.shouldMergeWithPrevious(style, previousStyle, isHeading)) {
        // Remove the closing markers from previous text and add new content
        text = this.mergeAdjacentFormattedText(text, formattedText, style, previousStyle);
      } else {
        text += formattedText;
      }

      previousStyle = style;
    }

    return text.trim();
  }

  /**
   * Determines if current element should merge with previous element
   * to avoid doubled formatting markers
   */
  private shouldMergeWithPrevious(currentStyle: any, previousStyle: any, isHeading: boolean): boolean {
    // Only merge if both have the same formatting
    const currentBold = currentStyle.bold && !isHeading;
    const previousBold = previousStyle.bold && !isHeading;
    const currentItalic = currentStyle.italic;
    const previousItalic = previousStyle.italic;
    const currentStrikethrough = currentStyle.strikethrough;
    const previousStrikethrough = previousStyle.strikethrough;

    // Check if formatting is the same
    const boldMatch = currentBold === previousBold;
    const italicMatch = currentItalic === previousItalic;
    const strikethroughMatch = currentStrikethrough === previousStrikethrough;

    return boldMatch && italicMatch && strikethroughMatch;
  }

  /**
   * Merges adjacent formatted text to avoid doubled markers
   */
  private mergeAdjacentFormattedText(
    previousText: string,
    currentText: string,
    currentStyle: any,
    previousStyle: any,
    isHeading = false
  ): string {
    // Remove closing markers from previous text
    let mergedText = previousText;

    // Remove closing bold marker if present
    if (previousStyle.bold && !isHeading && mergedText.endsWith('**')) {
      mergedText = mergedText.slice(0, -2);
    }

    // Remove closing italic marker if present
    if (previousStyle.italic && mergedText.endsWith('*')) {
      mergedText = mergedText.slice(0, -1);
    }

    // Remove closing strikethrough marker if present
    if (previousStyle.strikethrough && mergedText.endsWith('~~')) {
      mergedText = mergedText.slice(0, -2);
    }

    // Add the new content (without opening markers since they're already there)
    // Extract content without formatting markers
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

  /**
   * Extracts cells from a table row
   */
  private extractTableCells(row: any): string[] {
    if (!row.tableCells) {
      return [];
    }

    return row.tableCells.map((cell: any) => {
      if (!cell.content || cell.content.length === 0) {
        return '';
      }

      // Extract text from cell content
      let text = '';
      for (const paragraph of cell.content) {
        if (paragraph.paragraph) {
          text += this.extractText(paragraph.paragraph, false) + ' ';
        }
      }

      return text.trim();
    });
  }

  /**
   * Gets heading level from paragraph
   */
  private getHeadingLevel(paragraph: any): number {
    const headingId = paragraph.paragraphStyle?.headingId;
    if (!headingId) {
      return 0;
    }

    // Heading IDs in Google Docs are typically like "h.xxxxxxxx"
    // or just the heading level in some cases
    if (headingId.startsWith('h.')) {
      const level = parseInt(headingId.split('.')[1]?.charAt(0) || '0');
      return level;
    }

    // Check named style
    const namedStyle = paragraph.paragraphStyle?.namedStyleType;
    if (namedStyle) {
      const match = namedStyle.match(/HEADING_(\d+)/);
      if (match) {
        return parseInt(match[1]);
      }
    }

    return 0;
  }

  /**
   * Determines list type (bullet or numbered)
   */
  private getListType(paragraph: any): 'bullet' | 'numbered' {
    const bullet = paragraph.bullet;
    if (!bullet) {
      return 'bullet';
    }

    // Check glyph type
    const glyphType = bullet.nestingLevel?.glyphType;
    if (glyphType && glyphType.includes('NUMBER')) {
      return 'numbered';
    }

    // Check glyph symbol
    const glyphSymbol = bullet.textStyle?.glyphSymbol;
    if (glyphSymbol === '•' || !glyphSymbol) {
      return 'bullet';
    }

    return 'numbered';
  }

  /**
   * Checks if font is monospace
   */
  private isMonospaceFont(fontFamily: string): boolean {
    const monospaceFonts = [
      'Courier New',
      'Consolas',
      'Monaco',
      'Monospace',
      'monospace',
      'Courier',
      'Lucida Console',
      'Liberation Mono',
    ];

    return monospaceFonts.some(font => fontFamily.toLowerCase().includes(font.toLowerCase()));
  }

  /**
   * Checks if text matches code patterns
   */
  private matchesCodePattern(text: string): boolean {
    const codePatterns = [
      /^function\s+\w+/, // function declaration
      /^const\s+\w+\s*=/, // const declaration
      /^let\s+\w+\s*=/, // let declaration
      /^var\s+\w+\s*=/, // var declaration
      /^import\s+/, // import statement
      /^export\s+/, // export statement
      /^class\s+\w+/, // class declaration
      /^\s+def\s+\w+/, // Python function definition
      /^\s+class\s+\w+/, // Python class
      /^#include\s+/, // C/C++ include
      /^\s*public\s+class\s+/, // Java class
      /^\s*private\s+/, // Access modifier
      /^\s*return\s+/, // Return statement
      /^\s*console\.log/, // Console log
      /^\s*print\s*\(/, // Python print
      /^[a-zA-Z_]\w*\s*\(/, // Function call
      /^[a-zA-Z_]\w*\s*:/, // Label/object key
      /^\s*{/, // JSON/Object start
      /^\s*\[/, // Array start
      /^\s*"/, // String start
      /^\s*\d+\s*$/, // Number
      /^\s*true|false\s*$/, // Boolean
    ];

    return codePatterns.some(pattern => pattern.test(text));
  }

  /**
   * Detects code language from text patterns
   */
  private detectCodeLanguage(text: string): string {
    const trimmed = text.trim();

    // JavaScript/TypeScript patterns
    if (/function\s+\w+|const\s+\w+\s*=|let\s+\w+\s*=|=>|export\s+(default\s+)?(function|const|class)/.test(trimmed)) {
      if (/:\s*\w+/.test(text) || /interface\s+\w+/.test(text)) {
        return 'typescript';
      }
      return 'javascript';
    }

    // Python patterns
    if (/def\s+\w+|class\s+\w+|import\s+\w+|from\s+\w+|print\s*\(|:\s*$/.test(trimmed)) {
      return 'python';
    }

    // Java patterns
    if (/public\s+class\s+\w+|private\s+|protected\s+|System\.out\.println/.test(trimmed)) {
      return 'java';
    }

    // C++ patterns
    if (/#include\s+|std::|cout\s*<<|cin\s*>>/.test(trimmed)) {
      return 'cpp';
    }

    // C# patterns
    if (/using\s+\w+|namespace\s+\w+|Console\.WriteLine/.test(trimmed)) {
      return 'csharp';
    }

    // Go patterns
    if (/package\s+\w+|func\s+\w+|import\s+\(/.test(trimmed)) {
      return 'go';
    }

    // Rust patterns
    if (/fn\s+\w+|let\s+mut|pub\s+/.test(trimmed)) {
      return 'rust';
    }

    // PHP patterns
    if (/<?php|function\s+\w+|\$[a-zA-Z_]\w*/.test(trimmed)) {
      return 'php';
    }

    // Ruby patterns
    if (/def\s+\w+|class\s+\w+|puts\s+/.test(trimmed)) {
      return 'ruby';
    }

    // Shell/Bash patterns
    if (/^#!/.test(trimmed) || /^\$[a-zA-Z_]/.test(trimmed) || /echo\s+|cd\s+|ls\s+/.test(trimmed)) {
      return 'bash';
    }

    // JSON patterns
    if (/^\s*[{[]/.test(trimmed) && /}\s*$/.test(trimmed)) {
      return 'json';
    }

    // YAML patterns
    if (/^[a-zA-Z_]\w*:\s+/.test(trimmed) || /^---\s*$/.test(trimmed)) {
      return 'yaml';
    }

    // HTML patterns
    if (/^<!DOCTYPE|<html|<head|<body|<div|<span/.test(trimmed)) {
      return 'html';
    }

    // CSS patterns
    if (/\{[^}]*\}/.test(trimmed) && /:\s*[^;]+;/.test(trimmed)) {
      return 'css';
    }

    // SQL patterns
    if (/SELECT\s+\w+|INSERT\s+INTO|UPDATE\s+\w+|DELETE\s+FROM/i.test(trimmed)) {
      return 'sql';
    }

    // Default: no specific language detected
    return '';
  }

  async validate(context: PipelineContext): Promise<boolean> {
    if (!context.paragraphs) {
      throw new PipelineError('Validation failed: no paragraphs in context', this.name, context);
    }

    return true;
  }

  async cleanup(context: PipelineContext): Promise<void> {
    if (context.stageData[this.name]) {
      delete context.stageData[this.name];
    }
  }
}

// Factory function for easy instantiation
export const createProcessStage = (): PipelineStage => {
  return new ProcessStage();
};
