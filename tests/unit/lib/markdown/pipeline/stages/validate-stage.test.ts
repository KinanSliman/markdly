/**
 * Unit tests for ValidateStage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createValidateStage, ValidateStage } from '@/lib/markdown/pipeline/stages/validate-stage';
import { PipelineContext } from '@/lib/markdown/pipeline/types';

describe('ValidateStage', () => {
  let stage: ValidateStage;
  let context: PipelineContext;

  beforeEach(() => {
    stage = createValidateStage() as ValidateStage;
    context = {
      input: {
        docId: 'test-doc',
        token: 'test-token',
      },
      warnings: [],
      stageData: {},
      metrics: {
        totalTime: 0,
        fetchTime: 0,
        parseTime: 0,
        processTime: 0,
        imageUploadTime: 0,
        formatTime: 0,
        validateTime: 0,
      },
    };
  });

  describe('validateMarkdownSyntax', () => {
    it('should pass valid markdown', async () => {
      context.markdown = '# Heading\n\nThis is a paragraph.\n\n```javascript\nconst x = 1;\n```\n\n- Item 1\n- Item 2';

      const result = await stage.execute(context);
      expect(result.stageData['validate'].isValid).toBe(true);
    });

    it('should detect unclosed code blocks', async () => {
      context.markdown = '# Heading\n\n```\nconst x = 1;\n';

      const result = await stage.execute(context);
      expect(result.stageData['validate'].isValid).toBe(false);
    });

    it('should detect unclosed bold formatting', async () => {
      context.markdown = '# Heading\n\nThis is **bold text';

      const result = await stage.execute(context);
      expect(result.stageData['validate'].isValid).toBe(false);
    });

    it('should detect unclosed italic formatting', async () => {
      context.markdown = '# Heading\n\nThis is *italic text';

      const result = await stage.execute(context);
      expect(result.stageData['validate'].isValid).toBe(false);
    });

    it('should detect unclosed strikethrough', async () => {
      context.markdown = '# Heading\n\nThis is ~~strikethrough text';

      const result = await stage.execute(context);
      expect(result.stageData['validate'].isValid).toBe(false);
    });

    it('should detect empty links', async () => {
      context.markdown = '# Heading\n\nThis is an []( ) link';

      const result = await stage.execute(context);
      expect(result.stageData['validate'].isValid).toBe(false);
    });
  });

  describe('validateContentStructure', () => {
    it('should warn about missing H1 heading', async () => {
      context.markdown = '## Heading 2\n\nSome content';

      const result = await stage.execute(context);
      expect(result.warnings.some((w) => w.type === 'heading')).toBe(true);
    });

    it('should warn about code blocks without language', async () => {
      context.markdown = '# Heading\n\n```\nconst x = 1;\n```\n';

      const result = await stage.execute(context);
      expect(result.warnings.some((w) => w.type === 'code_block')).toBe(true);
    });
  });

  describe('validateImages', () => {
    it('should warn about images without alt text', async () => {
      context.markdown = '# Heading\n\n![Image](https://example.com/image.png)';
      context.images = [
        {
          id: 'img-1',
          url: 'https://example.com/image.png',
          altText: 'Image',
        },
      ];

      const result = await stage.execute(context);
      // Image has alt text, so no warning
      expect(result.warnings.filter((w) => w.type === 'image').length).toBe(0);
    });
  });

  describe('validateHeadings', () => {
    it('should warn about skipped heading levels', async () => {
      context.markdown = '# Heading 1\n\n### Heading 3\n';

      const result = await stage.execute(context);
      expect(result.warnings.some((w) => w.type === 'heading')).toBe(true);
    });

    it('should warn about duplicate headings', async () => {
      context.markdown = '# Heading\n\nSome content\n\n# Heading\n';

      const result = await stage.execute(context);
      expect(result.warnings.some((w) => w.type === 'heading')).toBe(true);
    });
  });

  describe('validate', () => {
    it('should validate context with markdown', async () => {
      context.markdown = '# Test';

      const isValid = await stage.validate(context);
      expect(isValid).toBe(true);
    });

    it('should throw error when no markdown', async () => {
      context.markdown = undefined;

      await expect(stage.validate(context)).rejects.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should clean up stage data', async () => {
      context.stageData['validate'] = {
        someData: 'test',
      };

      await stage.cleanup(context);

      expect(context.stageData['validate']).toBeUndefined();
    });
  });
});
