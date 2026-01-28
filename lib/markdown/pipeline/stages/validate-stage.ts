/**
 * Validate Stage
 *
 * Validates the final markdown output for common issues.
 * Checks for syntax errors, missing content, and other problems.
 */

import { PipelineStage, PipelineContext, PipelineError, ConversionWarning } from '../types';

export interface ValidationResult {
  isValid: boolean;
  warnings: ConversionWarning[];
  errors: ValidationError[];
}

export interface ValidationError {
  type: string;
  message: string;
  suggestion: string;
  context?: Record<string, any>;
}

export class ValidateStage implements PipelineStage {
  name = 'validate';
  description = 'Validates the final markdown output';

  async execute(context: PipelineContext): Promise<PipelineContext> {
    if (!context.markdown) {
      throw new PipelineError('No markdown to validate', this.name, context);
    }

    const startTime = performance.now();

    try {
      const warnings: ConversionWarning[] = [];
      const errors: ValidationError[] = [];

      // Run validation checks
      this.validateMarkdownSyntax(context.markdown, errors);
      this.validateContentStructure(context, warnings, errors);
      this.validateImages(context, warnings, errors);
      this.validateHeadings(context, warnings, errors);

      // Store validation results
      if (!context.stageData[this.name]) {
        context.stageData[this.name] = {};
      }
      context.stageData[this.name].validation = {
        isValid: errors.length === 0,
        warningCount: warnings.length,
        errorCount: errors.length,
      };

      // Merge warnings
      context.warnings.push(...warnings);

      // Throw error if validation fails
      if (errors.length > 0) {
        throw new PipelineError(
          `Validation failed with ${errors.length} error(s): ${errors.map(e => e.message).join('; ')}`,
          this.name,
          context
        );
      }

      // Update metrics
      const endTime = performance.now();
      context.metrics.validateTime = endTime - startTime;

      return context;
    } catch (error: any) {
      if (error instanceof PipelineError) {
        throw error;
      }
      throw new PipelineError(
        `Failed to validate content: ${error.message}`,
        this.name,
        context,
        error
      );
    }
  }

  /**
   * Validates markdown syntax
   */
  private validateMarkdownSyntax(markdown: string, errors: ValidationError[]): void {
    // Check for unclosed code blocks
    const codeBlockMatches = markdown.match(/```/g);
    if (codeBlockMatches && codeBlockMatches.length % 2 !== 0) {
      errors.push({
        type: 'syntax',
        message: 'Unclosed code block detected',
        suggestion: 'Ensure all code blocks have both opening (```) and closing (```) markers',
        context: { markdown },
      });
    }

    // Check for unclosed bold formatting
    const boldMatches = markdown.match(/\*\*/g);
    if (boldMatches && boldMatches.length % 2 !== 0) {
      errors.push({
        type: 'syntax',
        message: 'Unclosed bold formatting detected',
        suggestion: 'Ensure all bold text has both opening (**) and closing (**) markers',
        context: {},
      });
    }

    // Check for unclosed italic formatting
    const italicMatches = markdown.match(/\*/g);
    if (italicMatches && italicMatches.length % 2 !== 0) {
      errors.push({
        type: 'syntax',
        message: 'Unclosed italic formatting detected',
        suggestion: 'Ensure all italic text has both opening (*) and closing (*) markers',
        context: {},
      });
    }

    // Check for unclosed strikethrough
    const strikethroughMatches = markdown.match(/~~/g);
    if (strikethroughMatches && strikethroughMatches.length % 2 !== 0) {
      errors.push({
        type: 'syntax',
        message: 'Unclosed strikethrough formatting detected',
        suggestion: 'Ensure all strikethrough text has both opening (~~) and closing (~~) markers',
        context: {},
      });
    }

    // Check for unclosed links
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    let linkCount = 0;
    while ((match = linkPattern.exec(markdown)) !== null) {
      linkCount++;
    }

    // Check for empty links
    const emptyLinks = markdown.match(/\[\]\(\)/g);
    if (emptyLinks && emptyLinks.length > 0) {
      errors.push({
        type: 'syntax',
        message: 'Empty links detected',
        suggestion: 'Ensure all links have both text and URL',
        context: { count: emptyLinks.length },
      });
    }
  }

  /**
   * Validates content structure
   */
  private validateContentStructure(context: PipelineContext, warnings: ConversionWarning[], errors: ValidationError[]): void {
    const contentBlocks = context.contentBlocks || [];

    // Check if content is empty
    if (contentBlocks.length === 0) {
      errors.push({
        type: 'structure',
        message: 'No content blocks found',
        suggestion: 'Ensure the document has readable content',
        context: {},
      });
    }

    // Check for excessive code blocks without language
    const codeBlocksWithoutLanguage = contentBlocks.filter(
      (block) => block.type === 'code' && !block.metadata?.language
    );

    if (codeBlocksWithoutLanguage.length > 0) {
      warnings.push({
        type: 'code_block',
        message: `${codeBlocksWithoutLanguage.length} code block(s) without language identifier`,
        suggestion: 'Consider adding language identifiers for better syntax highlighting',
        context: { count: codeBlocksWithoutLanguage.length },
      });
    }

    // Check for missing heading (H1)
    const hasH1 = contentBlocks.some(
      (block) => block.type === 'heading' && block.metadata?.level === 1
    );

    if (!hasH1 && contentBlocks.length > 0) {
      warnings.push({
        type: 'heading',
        message: 'No H1 heading found',
        suggestion: 'Consider adding an H1 heading for better document structure',
        context: {},
      });
    }
  }

  /**
   * Validates images
   */
  private validateImages(context: PipelineContext, warnings: ConversionWarning[], errors: ValidationError[]): void {
    const images = context.images || [];

    // Check if images were processed
    const processedImages = images.filter((img) => img.uploadResult);
    const unprocessedImages = images.filter((img) => !img.uploadResult);

    if (unprocessedImages.length > 0) {
      warnings.push({
        type: 'image',
        message: `${unprocessedImages.length} image(s) could not be processed`,
        suggestion: 'Images will use original Google Docs URLs. Check Cloudinary configuration.',
        context: { count: unprocessedImages.length },
      });
    }

    // Check for images without alt text
    const imagesWithoutAlt = images.filter((img) => !img.altText || img.altText === 'Image');

    if (imagesWithoutAlt.length > 0) {
      warnings.push({
        type: 'image',
        message: `${imagesWithoutAlt.length} image(s) missing descriptive alt text`,
        suggestion: 'Add descriptive alt text for accessibility and SEO',
        context: { count: imagesWithoutAlt.length },
      });
    }
  }

  /**
   * Validates headings
   */
  private validateHeadings(context: PipelineContext, warnings: ConversionWarning[], errors: ValidationError[]): void {
    const contentBlocks = context.contentBlocks || [];
    const headings = contentBlocks.filter(
      (block) => block.type === 'heading'
    );

    if (headings.length === 0) {
      return;
    }

    // Check heading hierarchy
    let lastLevel = 0;
    for (const heading of headings) {
      const level = heading.metadata?.level || 0;

      if (level > lastLevel + 1) {
        warnings.push({
          type: 'heading',
          message: `Heading level skipped from H${lastLevel} to H${level}`,
          suggestion: `Use H${lastLevel + 1} before H${level} for proper hierarchy`,
          context: { from: lastLevel, to: level },
        });
      }

      lastLevel = level;
    }

    // Check for duplicate headings
    const headingTexts = headings.map((h) => h.content.replace(/^#+\s*/, '').trim());
    const duplicates = headingTexts.filter(
      (text, index) => headingTexts.indexOf(text) !== index
    );

    if (duplicates.length > 0) {
      warnings.push({
        type: 'heading',
        message: `Duplicate heading text found: ${duplicates.join(', ')}`,
        suggestion: 'Use unique heading text for better navigation',
        context: { duplicates },
      });
    }
  }

  async validate(context: PipelineContext): Promise<boolean> {
    if (!context.markdown) {
      throw new PipelineError(
        'Validation failed: no markdown in context',
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

// Factory function for easy instantiation
export const createValidateStage = (): PipelineStage => {
  return new ValidateStage();
};
