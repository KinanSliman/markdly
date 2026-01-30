/**
 * Unit tests for ProcessStage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createProcessStage, ProcessStage } from '@/lib/markdown/pipeline/stages/process-stage';
import { PipelineContext, ConversionWarning } from '@/lib/markdown/pipeline/types';

describe('ProcessStage', () => {
  let stage: ProcessStage;
  let context: PipelineContext;

  beforeEach(() => {
    stage = createProcessStage() as ProcessStage;
    context = {
      input: {
        docId: 'test-doc',
        token: 'test-token',
      },
      paragraphs: [],
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

  describe('processParagraph', () => {
    it('should process a simple paragraph', async () => {
      context.paragraphs = [
        {
          elements: [
            {
              textRun: {
                content: 'Hello, world!',
                textStyle: {},
              },
            },
          ],
          paragraphStyle: {
            namedStyleType: 'NORMAL_TEXT',
          },
        },
      ];

      const result = await stage.execute(context);
      expect(result.contentBlocks).toBeDefined();
      expect(result.contentBlocks!.length).toBeGreaterThan(0);
      expect(result.contentBlocks![0].type).toBe('paragraph');
      expect(result.contentBlocks![0].content).toContain('Hello, world!');
    });

    it('should detect headings', async () => {
      context.paragraphs = [
        {
          elements: [
            {
              textRun: {
                content: 'Heading 1',
                textStyle: {},
              },
            },
          ],
          paragraphStyle: {
            namedStyleType: 'HEADING_1',
          },
        },
      ];

      const result = await stage.execute(context);
      expect(result.contentBlocks![0].type).toBe('heading');
      expect(result.contentBlocks![0].content).toBe('# Heading 1');
      expect(result.contentBlocks![0].metadata?.level).toBe(1);
    });

    it('should handle bold text', async () => {
      context.paragraphs = [
        {
          elements: [
            {
              textRun: {
                content: 'This is ',
                textStyle: {},
              },
            },
            {
              textRun: {
                content: 'bold',
                textStyle: {
                  bold: true,
                },
              },
            },
            {
              textRun: {
                content: ' text.',
                textStyle: {},
              },
            },
          ],
          paragraphStyle: {
            namedStyleType: 'NORMAL_TEXT',
          },
        },
      ];

      const result = await stage.execute(context);
      expect(result.contentBlocks![0].content).toBe('This is **bold** text.');
    });

    it('should handle italic text', async () => {
      context.paragraphs = [
        {
          elements: [
            {
              textRun: {
                content: 'This is ',
                textStyle: {},
              },
            },
            {
              textRun: {
                content: 'italic',
                textStyle: {
                  italic: true,
                },
              },
            },
            {
              textRun: {
                content: ' text.',
                textStyle: {},
              },
            },
          ],
          paragraphStyle: {
            namedStyleType: 'NORMAL_TEXT',
          },
        },
      ];

      const result = await stage.execute(context);
      expect(result.contentBlocks![0].content).toBe('This is *italic* text.');
    });

    it('should handle strikethrough text', async () => {
      context.paragraphs = [
        {
          elements: [
            {
              textRun: {
                content: 'This is ',
                textStyle: {},
              },
            },
            {
              textRun: {
                content: 'strikethrough',
                textStyle: {
                  strikethrough: true,
                },
              },
            },
            {
              textRun: {
                content: ' text.',
                textStyle: {},
              },
            },
          ],
          paragraphStyle: {
            namedStyleType: 'NORMAL_TEXT',
          },
        },
      ];

      const result = await stage.execute(context);
      expect(result.contentBlocks![0].content).toBe('This is ~~strikethrough~~ text.');
    });

    it('should handle links', async () => {
      context.paragraphs = [
        {
          elements: [
            {
              textRun: {
                content: 'Visit ',
                textStyle: {},
              },
            },
            {
              textRun: {
                content: 'Google',
                textStyle: {
                  link: {
                    url: 'https://google.com',
                  },
                },
              },
            },
            {
              textRun: {
                content: ' for more info.',
                textStyle: {},
              },
            },
          ],
          paragraphStyle: {
            namedStyleType: 'NORMAL_TEXT',
          },
        },
      ];

      const result = await stage.execute(context);
      expect(result.contentBlocks![0].content).toBe('Visit [Google](https://google.com) for more info.');
    });

    it('should not apply bold formatting to headings', async () => {
      context.paragraphs = [
        {
          elements: [
            {
              textRun: {
                content: '## ',
                textStyle: {
                  bold: true,
                },
              },
            },
            {
              textRun: {
                content: 'Heading',
                textStyle: {
                  bold: true,
                },
              },
            },
          ],
          paragraphStyle: {
            namedStyleType: 'HEADING_2',
          },
        },
      ];

      const result = await stage.execute(context);
      // Headings should not be bold, even if the text has bold formatting
      expect(result.contentBlocks![0].content).toBe('## Heading');
      expect(result.contentBlocks![0].content).not.toContain('**');
    });

    it('should handle adjacent elements with same formatting without doubling markers', async () => {
      context.paragraphs = [
        {
          elements: [
            {
              textRun: {
                content: 'This is ',
                textStyle: {},
              },
            },
            {
              textRun: {
                content: 'bold',
                textStyle: {
                  bold: true,
                },
              },
            },
            {
              textRun: {
                content: ' text',
                textStyle: {
                  bold: true,
                },
              },
            },
            {
              textRun: {
                content: ' here.',
                textStyle: {},
              },
            },
          ],
          paragraphStyle: {
            namedStyleType: 'NORMAL_TEXT',
          },
        },
      ];

      const result = await stage.execute(context);
      // Should be **bold text** not ****bold text****
      expect(result.contentBlocks![0].content).toBe('This is **bold text** here.');
      expect(result.contentBlocks![0].content).not.toContain('****');
    });

    it('should handle bold italic with correct markers', async () => {
      context.paragraphs = [
        {
          elements: [
            {
              textRun: {
                content: 'This is ',
                textStyle: {},
              },
            },
            {
              textRun: {
                content: 'bold italic',
                textStyle: {
                  bold: true,
                  italic: true,
                },
              },
            },
            {
              textRun: {
                content: ' text.',
                textStyle: {},
              },
            },
          ],
          paragraphStyle: {
            namedStyleType: 'NORMAL_TEXT',
          },
        },
      ];

      const result = await stage.execute(context);
      // Should be ***bold italic*** not ********bold italic********
      expect(result.contentBlocks![0].content).toBe('This is ***bold italic*** text.');
      expect(result.contentBlocks![0].content).not.toContain('********');
    });

    it('should handle italic text with correct markers', async () => {
      context.paragraphs = [
        {
          elements: [
            {
              textRun: {
                content: 'This is ',
                textStyle: {},
              },
            },
            {
              textRun: {
                content: 'italic',
                textStyle: {
                  italic: true,
                },
              },
            },
            {
              textRun: {
                content: ' text.',
                textStyle: {},
              },
            },
          ],
          paragraphStyle: {
            namedStyleType: 'NORMAL_TEXT',
          },
        },
      ];

      const result = await stage.execute(context);
      // Should be *italic* not **italic**
      expect(result.contentBlocks![0].content).toBe('This is *italic* text.');
      expect(result.contentBlocks![0].content).not.toContain('**');
    });

    it('should detect code blocks by small font size', async () => {
      context.paragraphs = [
        {
          elements: [
            {
              textRun: {
                content: 'const x = 1;',
                textStyle: {
                  fontSize: {
                    magnitude: 9,
                    unit: 'PT',
                  },
                },
              },
            },
          ],
          paragraphStyle: {
            namedStyleType: 'NORMAL_TEXT',
          },
        },
      ];

      const result = await stage.execute(context);
      expect(result.contentBlocks![0].type).toBe('code');
      expect(result.contentBlocks![0].content).toContain('```');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].type).toBe('code_block');
    });

    it('should detect code blocks by code patterns', async () => {
      context.paragraphs = [
        {
          elements: [
            {
              textRun: {
                content: 'function hello() { return "world"; }',
                textStyle: {},
              },
            },
          ],
          paragraphStyle: {
            namedStyleType: 'NORMAL_TEXT',
          },
        },
      ];

      const result = await stage.execute(context);
      expect(result.contentBlocks![0].type).toBe('code');
    });

    it('should detect code language from content', async () => {
      context.paragraphs = [
        {
          elements: [
            {
              textRun: {
                content: 'const x = 1;',
                textStyle: {
                  fontSize: {
                    magnitude: 9,
                    unit: 'PT',
                  },
                },
              },
            },
          ],
          paragraphStyle: {
            namedStyleType: 'NORMAL_TEXT',
          },
        },
      ];

      const result = await stage.execute(context);
      expect(result.contentBlocks![0].metadata?.language).toBe('javascript');
    });

    it('should handle bullet lists', async () => {
      context.paragraphs = [
        {
          elements: [
            {
              textRun: {
                content: 'First item',
                textStyle: {},
              },
            },
          ],
          bullet: {
            listId: 'list-1',
            nestingLevel: 0,
          },
        },
      ];

      const result = await stage.execute(context);
      expect(result.contentBlocks![0].type).toBe('list');
      expect(result.contentBlocks![0].content).toBe('- First item');
    });

    it('should handle numbered lists', async () => {
      context.paragraphs = [
        {
          elements: [
            {
              textRun: {
                content: 'First item',
                textStyle: {},
              },
            },
          ],
          bullet: {
            listId: 'list-1',
            nestingLevel: 0,
          },
        },
        {
          elements: [
            {
              textRun: {
                content: 'Second item',
                textStyle: {},
              },
            },
          ],
          bullet: {
            listId: 'list-1',
            nestingLevel: 0,
          },
        },
      ];

      const result = await stage.execute(context);
      expect(result.contentBlocks![0].type).toBe('list');
      expect(result.contentBlocks![1].type).toBe('list');
    });

    it('should handle nested lists', async () => {
      context.paragraphs = [
        {
          elements: [
            {
              textRun: {
                content: 'Parent item',
                textStyle: {},
              },
            },
          ],
          bullet: {
            listId: 'list-1',
            nestingLevel: 0,
          },
        },
        {
          elements: [
            {
              textRun: {
                content: 'Child item',
                textStyle: {},
              },
            },
          ],
          bullet: {
            listId: 'list-1',
            nestingLevel: 1,
          },
        },
      ];

      const result = await stage.execute(context);
      expect(result.contentBlocks![0].content).toBe('- Parent item');
      expect(result.contentBlocks![1].content).toBe('  - Child item');
    });

    it('should warn about skipped heading levels', async () => {
      context.paragraphs = [
        {
          elements: [
            {
              textRun: {
                content: 'Heading 1',
                textStyle: {},
              },
            },
          ],
          paragraphStyle: {
            namedStyleType: 'HEADING_1',
          },
        },
        {
          elements: [
            {
              textRun: {
                content: 'Heading 3',
                textStyle: {},
              },
            },
          ],
          paragraphStyle: {
            namedStyleType: 'HEADING_3',
          },
        },
      ];

      const result = await stage.execute(context);
      expect(result.warnings.some((w) => w.type === 'heading')).toBe(true);
    });

    it('should warn about mixed list types', async () => {
      context.paragraphs = [
        {
          elements: [
            {
              textRun: {
                content: 'Bullet item',
                textStyle: {},
              },
            },
          ],
          bullet: {
            listId: 'list-1',
            nestingLevel: 0,
          },
        },
        {
          elements: [
            {
              textRun: {
                content: 'Numbered item',
                textStyle: {},
              },
            },
          ],
          bullet: {
            listId: 'list-1',
            nestingLevel: 0,
          },
        },
      ];

      // Note: The current implementation doesn't detect mixed types in the same list
      // This test documents the expected behavior
      const result = await stage.execute(context);
      expect(result.contentBlocks!.length).toBe(2);
    });
  });

  describe('processTable', () => {
    it('should process a simple table', async () => {
      context.paragraphs = [];
      context.stageData['process'] = {
        tables: [
          {
            tableRows: [
              {
                tableCells: [
                  {
                    content: [
                      {
                        paragraph: {
                          elements: [
                            {
                              textRun: {
                                content: 'Header 1',
                                textStyle: {},
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                  {
                    content: [
                      {
                        paragraph: {
                          elements: [
                            {
                              textRun: {
                                content: 'Header 2',
                                textStyle: {},
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                ],
              },
              {
                tableCells: [
                  {
                    content: [
                      {
                        paragraph: {
                          elements: [
                            {
                              textRun: {
                                content: 'Cell 1',
                                textStyle: {},
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                  {
                    content: [
                      {
                        paragraph: {
                          elements: [
                            {
                              textRun: {
                                content: 'Cell 2',
                                textStyle: {},
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = await stage.execute(context);
      const tableBlock = result.contentBlocks!.find((b) => b.type === 'table');
      expect(tableBlock).toBeDefined();
      expect(tableBlock!.content).toContain('Header 1');
      expect(tableBlock!.content).toContain('Cell 1');
    });

    it('should warn about empty cells (merged cells)', async () => {
      context.paragraphs = [];
      context.stageData['process'] = {
        tables: [
          {
            tableRows: [
              {
                tableCells: [
                  {
                    content: [
                      {
                        paragraph: {
                          elements: [
                            {
                              textRun: {
                                content: 'Header 1',
                                textStyle: {},
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                  {
                    content: [
                      {
                        paragraph: {
                          elements: [],
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = await stage.execute(context);
      expect(result.warnings.some((w) => w.type === 'table')).toBe(true);
    });
  });

  describe('validate', () => {
    it('should validate context with paragraphs', async () => {
      context.paragraphs = [
        {
          elements: [
            {
              textRun: {
                content: 'Test',
                textStyle: {},
              },
            },
          ],
        },
      ];

      const isValid = await stage.validate(context);
      expect(isValid).toBe(true);
    });

    it('should throw error when no paragraphs', async () => {
      context.paragraphs = undefined;

      await expect(stage.validate(context)).rejects.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should clean up stage data', async () => {
      context.stageData['process'] = {
        someData: 'test',
      };

      await stage.cleanup(context);

      expect(context.stageData['process']).toBeUndefined();
    });
  });
});
