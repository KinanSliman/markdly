/**
 * Parse Stage
 *
 * Parses Google Docs API response into structured paragraphs and tables.
 * Extracts inline images and prepares content for processing.
 */

import { PipelineStage, PipelineContext, PipelineError, ImageData } from '../types';

export class ParseStage implements PipelineStage {
  name = 'parse';
  description = 'Parses Google Docs structure into paragraphs and tables';

  async execute(context: PipelineContext): Promise<PipelineContext> {
    if (!context.document) {
      throw new PipelineError('No document to parse', this.name, context);
    }

    const startTime = performance.now();

    try {
      const document = context.document;
      const body = document.body;

      if (!body || !body.content) {
        throw new PipelineError('Document has no content', this.name, context);
      }

      // Extract paragraphs and tables from document content
      const { paragraphs, tables, images } = this.extractContent(body.content);

      // Store parsed content in context
      context.paragraphs = paragraphs;
      context.stageData[this.name] = {
        tables,
        rawParagraphCount: paragraphs.length,
        rawTableCount: tables.length,
      };

      // Store images for later processing
      if (images.length > 0) {
        context.images = images;
      }

      // Update metrics
      const endTime = performance.now();
      context.metrics.parseTime = endTime - startTime;

      return context;
    } catch (error: any) {
      throw new PipelineError(
        `Failed to parse document: ${error.message}`,
        this.name,
        context,
        error
      );
    }
  }

  /**
   * Extracts paragraphs, tables, and images from document content
   */
  private extractContent(content: any[]): {
    paragraphs: any[];
    tables: any[];
    images: ImageData[];
  } {
    const paragraphs: any[] = [];
    const tables: any[] = [];
    const images: ImageData[] = [];

    for (const element of content) {
      if (!element || !element.paragraph && !element.table && !element.tableOfContents) {
        continue;
      }

      // Handle paragraphs
      if (element.paragraph) {
        paragraphs.push(element.paragraph);

        // Extract inline images from paragraph
        const inlineImages = this.extractInlineImagesFromParagraph(element.paragraph);
        images.push(...inlineImages);
      }

      // Handle tables
      if (element.table) {
        tables.push(element.table);
      }

      // Handle table of contents (skip for now)
      if (element.tableOfContents) {
        // Could be processed later if needed
        continue;
      }
    }

    return { paragraphs, tables, images };
  }

  /**
   * Extracts inline images from a paragraph
   */
  private extractInlineImagesFromParagraph(paragraph: any): ImageData[] {
    const images: ImageData[] = [];

    if (!paragraph.elements) {
      return images;
    }

    for (const element of paragraph.elements) {
      if (!element || !element.inlineObjectElement) {
        continue;
      }

      const inlineObj = element.inlineObjectElement;
      const imageId = inlineObj.inlineObjectId;

      if (imageId) {
        images.push({
          id: imageId,
          url: '', // Will be filled in image processing stage
          altText: inlineObj.textStyle?.fontSize?.magnitude?.toString() || 'Image',
        });
      }
    }

    return images;
  }

  async validate(context: PipelineContext): Promise<boolean> {
    if (!context.document) {
      throw new PipelineError('Validation failed: no document in context', this.name, context);
    }

    if (!context.document.body) {
      throw new PipelineError('Validation failed: document has no body', this.name, context);
    }

    return true;
  }

  async cleanup(context: PipelineContext): Promise<void> {
    // Clean up parsed data if needed
    if (context.stageData[this.name]) {
      delete context.stageData[this.name];
    }
  }
}

// Factory function for easy instantiation
export const createParseStage = (): PipelineStage => {
  return new ParseStage();
};
