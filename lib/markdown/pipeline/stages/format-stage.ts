/**
 * Format Stage
 *
 * Formats content blocks into final markdown content.
 * Handles front matter generation and image URL replacement.
 */

import { PipelineStage, PipelineContext, PipelineError, ContentBlock, ImageData } from '../types';

export interface FrontmatterTemplate {
  title: string;
  date: string;
  author?: string;
  tags?: string[];
  draft?: boolean;
  [key: string]: any;
}

export class FormatStage implements PipelineStage {
  name = 'format';
  description = 'Formats content blocks into final markdown with front matter';

  async execute(context: PipelineContext): Promise<PipelineContext> {
    if (!context.contentBlocks || context.contentBlocks.length === 0) {
      throw new PipelineError('No content blocks to format', this.name, context);
    }

    const startTime = performance.now();

    try {
      // Generate front matter
      const frontmatter = this.generateFrontmatter(context);

      // Format content blocks into markdown
      let markdown = this.formatContentBlocks(context.contentBlocks);

      // Replace image URLs with Cloudinary URLs if available
      if (context.images && context.images.length > 0) {
        markdown = this.replaceImageUrls(markdown, context.images);
      }

      // Combine front matter and content
      const finalContent = `${frontmatter}\n\n${markdown}`;

      // Store in context
      context.markdown = finalContent;

      // Update metrics
      const endTime = performance.now();
      context.metrics.formatTime = endTime - startTime;

      // Update metadata
      if (!context.stageData[this.name]) {
        context.stageData[this.name] = {};
      }
      context.stageData[this.name].characterCount = finalContent.length;

      return context;
    } catch (error: any) {
      throw new PipelineError(
        `Failed to format content: ${error.message}`,
        this.name,
        context,
        error
      );
    }
  }

  /**
   * Generates front matter from context
   */
  private generateFrontmatter(context: PipelineContext): string {
    const metadata = context.stageData[this.name]?.metadata || {};
    const title = context.stageData['fetch']?.documentTitle || 'Untitled';

    const frontmatterData: FrontmatterTemplate = {
      title: title,
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      ...metadata,
    };

    // Convert to YAML format
    const yamlLines: string[] = ['---'];

    for (const [key, value] of Object.entries(frontmatterData)) {
      if (value === undefined || value === null) {
        continue;
      }

      if (Array.isArray(value)) {
        yamlLines.push(`${key}:`);
        value.forEach((item) => {
          yamlLines.push(`  - ${this.formatYamlValue(item)}`);
        });
      } else if (typeof value === 'boolean') {
        yamlLines.push(`${key}: ${value}`);
      } else if (typeof value === 'string' && value.includes('\n')) {
        // Multi-line string
        yamlLines.push(`${key}: |`);
        value.split('\n').forEach((line) => {
          yamlLines.push(`  ${line}`);
        });
      } else {
        yamlLines.push(`${key}: ${this.formatYamlValue(value)}`);
      }
    }

    yamlLines.push('---');

    return yamlLines.join('\n');
  }

  /**
   * Formats a value for YAML output
   */
  private formatYamlValue(value: any): string {
    if (typeof value === 'string') {
      // Escape quotes and wrap in quotes if needed
      const escaped = value.replace(/"/g, '\\"');
      if (value.includes(' ') || value.includes(':') || value.includes('#')) {
        return `"${escaped}"`;
      }
      return escaped;
    }
    return String(value);
  }

  /**
   * Formats content blocks into markdown
   */
  private formatContentBlocks(blocks: ContentBlock[]): string {
    const lines: string[] = [];
    let lastType: string | null = null;

    for (const block of blocks) {
      // Add spacing between different block types
      if (lastType && lastType !== block.type) {
        // Different spacing rules based on block type
        if (block.type === 'heading' || block.type === 'code') {
          lines.push('');
        } else if (lastType === 'heading' || lastType === 'code') {
          lines.push('');
        } else {
          lines.push('');
        }
      }

      // Add the block content
      lines.push(block.content);

      // Track last type
      lastType = block.type;
    }

    // Clean up excessive whitespace
    return this.cleanupWhitespace(lines.join('\n'));
  }

  /**
   * Replaces image URLs in markdown with Cloudinary URLs
   */
  private replaceImageUrls(markdown: string, images: ImageData[]): string {
    let updatedMarkdown = markdown;

    for (const image of images) {
      if (image.uploadResult?.url) {
        // Replace Google Docs image URLs with Cloudinary URLs
        // Pattern: ![alt](url)
        const escapedUrl = escapeRegex(image.url);
        const pattern = new RegExp(
          `!\\[([^\\]]*)\\]\\(${escapedUrl}\\)`,
          'g'
        );

        updatedMarkdown = updatedMarkdown.replace(
          pattern,
          `![$1](${image.uploadResult.url})`
        );

        // Also handle reference-style image links
        const refPattern = new RegExp(
          `\\[${escapeRegex(image.id)}\\]:\\s*${escapedUrl}`,
          'g'
        );
        updatedMarkdown = updatedMarkdown.replace(
          refPattern,
          `[${image.id}]: ${image.uploadResult.url}`
        );
      }
    }

    return updatedMarkdown;
  }

  /**
   * Cleans up excessive whitespace in markdown
   */
  private cleanupWhitespace(markdown: string): string {
    // Remove multiple consecutive empty lines (more than 2)
    let cleaned = markdown.replace(/\n{3,}/g, '\n\n');

    // Remove trailing whitespace on each line
    cleaned = cleaned
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n');

    // Remove leading/trailing whitespace
    cleaned = cleaned.trim();

    return cleaned;
  }

  async validate(context: PipelineContext): Promise<boolean> {
    if (!context.contentBlocks || context.contentBlocks.length === 0) {
      throw new PipelineError(
        'Validation failed: no content blocks in context',
        this.name,
        context
      );
    }

    return true;
  }

  async cleanup(context: PipelineContext): Promise<void> {
    if (context.stageData[this.name]) {
      delete context.stageData[this.name];
    }
  }
}

/**
 * Escapes special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Factory function for easy instantiation
export const createFormatStage = (): PipelineStage => {
  return new FormatStage();
};
