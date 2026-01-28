/**
 * Simple Google Doc fixture
 *
 * A basic document with just text paragraphs.
 */

export const simpleDocument = {
  documentId: 'simple-doc-123',
  title: 'Simple Document',
  body: {
    content: [
      {
        paragraph: {
          elements: [
            {
              textRun: {
                content: 'This is a simple paragraph.',
                textStyle: {},
              },
            },
          ],
          paragraphStyle: {
            namedStyleType: 'NORMAL_TEXT',
          },
        },
      },
      {
        paragraph: {
          elements: [
            {
              textRun: {
                content: 'This is another paragraph with ',
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
      },
    ],
  },
};

export const headingDocument = {
  documentId: 'heading-doc-456',
  title: 'Document with Headings',
  body: {
    content: [
      {
        paragraph: {
          elements: [
            {
              textRun: {
                content: 'Main Title',
                textStyle: {},
              },
            },
          ],
          paragraphStyle: {
            namedStyleType: 'HEADING_1',
          },
        },
      },
      {
        paragraph: {
          elements: [
            {
              textRun: {
                content: 'Subtitle',
                textStyle: {},
              },
            },
          ],
          paragraphStyle: {
            namedStyleType: 'HEADING_2',
          },
        },
      },
      {
        paragraph: {
          elements: [
            {
              textRun: {
                content: 'This is a paragraph under the subtitle.',
                textStyle: {},
              },
            },
          ],
          paragraphStyle: {
            namedStyleType: 'NORMAL_TEXT',
          },
        },
      },
    ],
  },
};

export const codeDocument = {
  documentId: 'code-doc-789',
  title: 'Document with Code',
  body: {
    content: [
      {
        paragraph: {
          elements: [
            {
              textRun: {
                content: 'function hello() {\n',
                textStyle: {
                  fontSize: {
                    magnitude: 9,
                    unit: 'PT',
                  },
                },
              },
            },
            {
              textRun: {
                content: '  console.log("Hello, world!");\n',
                textStyle: {
                  fontSize: {
                    magnitude: 9,
                    unit: 'PT',
                  },
                },
              },
            },
            {
              textRun: {
                content: '}\n',
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
      },
    ],
  },
};

export const tableDocument = {
  documentId: 'table-doc-101',
  title: 'Document with Table',
  body: {
    content: [
      {
        table: {
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
                              content: 'Name',
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
                              content: 'Age',
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
                              content: 'Alice',
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
                              content: '30',
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
      },
    ],
  },
};

export const listDocument = {
  documentId: 'list-doc-202',
  title: 'Document with Lists',
  body: {
    content: [
      {
        paragraph: {
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
      },
      {
        paragraph: {
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
      },
      {
        paragraph: {
          elements: [
            {
              textRun: {
                content: 'Nested item',
                textStyle: {},
              },
            },
          ],
          bullet: {
            listId: 'list-1',
            nestingLevel: 1,
          },
        },
      },
    ],
  },
};
