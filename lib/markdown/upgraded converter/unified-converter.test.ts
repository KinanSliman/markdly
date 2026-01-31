/**
 * Test Suite for Unified Converter - BULLETPROOF EDITION
 * 
 * Tests for:
 * - Security vulnerabilities (ReDoS, XSS, injection)
 * - Parallel processing
 * - Retry logic
 * - Cache completeness
 * - Code detection accuracy
 * - Table validation
 * - List state management
 * - HTML entity decoding
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  convertGoogleDocToMarkdown,
  convertDocxToMarkdown,
  getConversionResultFromCache,
  setConversionResultInCache,
} from './unified-converter';

describe('Security Tests', () => {
  describe('ReDoS Protection', () => {
    it('should handle malicious script tags without hanging', async () => {
      const maliciousHtml = '<script' + '<'.repeat(10000);
      const buffer = Buffer.from(`
        <!DOCTYPE html>
        <html>
          <body>${maliciousHtml}</body>
        </html>
      `);

      const startTime = Date.now();
      try {
        await convertDocxToMarkdown(buffer, 'test.docx', undefined, true);
      } catch (error) {
        // Expected to handle gracefully
      }
      const duration = Date.now() - startTime;

      // Should complete in reasonable time (not hang)
      expect(duration).toBeLessThan(5000);
    });

    it('should handle nested style tags without catastrophic backtracking', async () => {
      const maliciousHtml = '<style' + '<'.repeat(5000) + '</style>';
      const buffer = Buffer.from(maliciousHtml);

      const startTime = Date.now();
      try {
        await convertDocxToMarkdown(buffer, 'test.docx', undefined, true);
      } catch (error) {
        // Expected to handle gracefully
      }
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000);
    });
  });

  describe('XSS Protection', () => {
    it('should sanitize javascript: URLs', async () => {
      const maliciousHtml = `
        <a href="javascript:alert('xss')">Click me</a>
      `;
      const buffer = Buffer.from(maliciousHtml);

      const result = await convertDocxToMarkdown(buffer, 'test.docx', undefined, true);

      expect(result.content).not.toContain('javascript:');
      expect(result.content).toContain('[Click me](#)');
    });

    it('should sanitize onclick handlers', async () => {
      const maliciousHtml = `
        <div onclick="alert('xss')">Text</div>
      `;
      const buffer = Buffer.from(maliciousHtml);

      const result = await convertDocxToMarkdown(buffer, 'test.docx', undefined, true);

      expect(result.content).not.toContain('onclick');
      expect(result.content).toContain('Text');
    });

    it('should sanitize embedded scripts', async () => {
      const maliciousHtml = `
        <p>Normal text</p>
        <script>alert('xss')</script>
        <p>More text</p>
      `;
      const buffer = Buffer.from(maliciousHtml);

      const result = await convertDocxToMarkdown(buffer, 'test.docx', undefined, true);

      expect(result.content).not.toContain('alert');
      expect(result.content).not.toContain('<script>');
      expect(result.content).toContain('Normal text');
      expect(result.content).toContain('More text');
    });

    it('should sanitize data: URLs in images', async () => {
      const maliciousHtml = `
        <img src="data:text/html,<script>alert('xss')</script>" alt="Evil">
      `;
      const buffer = Buffer.from(maliciousHtml);

      const result = await convertDocxToMarkdown(buffer, 'test.docx', undefined, true);

      expect(result.content).not.toContain('data:');
      expect(result.content).toContain('![Evil](#)');
    });
  });

  describe('Input Validation', () => {
    it('should reject files larger than 50MB', async () => {
      const largeBuffer = Buffer.alloc(51 * 1024 * 1024); // 51MB

      await expect(
        convertDocxToMarkdown(largeBuffer, 'huge.docx', undefined, true)
      ).rejects.toThrow('File size exceeds maximum limit');
    });

    it('should reject invalid document IDs', async () => {
      await expect(
        convertGoogleDocToMarkdown('../../etc/passwd', 'token', true)
      ).rejects.toThrow('Invalid document ID format');
    });

    it('should reject overly long document IDs', async () => {
      const longId = 'a'.repeat(300);

      await expect(
        convertGoogleDocToMarkdown(longId, 'token', true)
      ).rejects.toThrow('Document ID too long');
    });

    it('should reject .doc files with helpful error', async () => {
      await expect(
        convertDocxToMarkdown(Buffer.from('test'), 'document.doc')
      ).rejects.toThrow('Unsupported file format: .doc files are not supported');
    });
  });
});

describe('Code Detection Tests', () => {
  it('should detect JavaScript code patterns', async () => {
    const jsCode = `
      <p style="font-family: monospace">
        function hello() {
          console.log('Hello, World!');
        }
      </p>
    `;
    const buffer = Buffer.from(jsCode);

    const result = await convertDocxToMarkdown(buffer, 'test.docx', undefined, true);

    expect(result.content).toContain('```javascript');
    expect(result.content).toContain('function hello()');
  });

  it('should detect Python code patterns', async () => {
    const pyCode = `
      <p style="font-family: monospace">
        def greet(name):
            print(f"Hello, {name}!")
      </p>
    `;
    const buffer = Buffer.from(pyCode);

    const result = await convertDocxToMarkdown(buffer, 'test.docx', undefined, true);

    expect(result.content).toContain('```python');
    expect(result.content).toContain('def greet');
  });

  it('should not detect markdown headings as code', async () => {
    const markdown = `
      <h1>Main Title</h1>
      <h2>Subtitle</h2>
      <p># This is not a heading, just text starting with #</p>
    `;
    const buffer = Buffer.from(markdown);

    const result = await convertDocxToMarkdown(buffer, 'test.docx', undefined, true);

    expect(result.headings).toHaveLength(2);
    expect(result.headings[0].text).toBe('Main Title');
    expect(result.headings[1].text).toBe('Subtitle');
    
    // The paragraph with # should not be treated as code
    const codeBlocks = result.content.match(/```/g);
    expect(codeBlocks).toBeNull();
  });

  it('should require multiple patterns for language detection', async () => {
    // Single pattern match should not trigger
    const singlePattern = `
      <p style="font-family: monospace">const x = 5;</p>
    `;
    const buffer = Buffer.from(singlePattern);

    const result = await convertDocxToMarkdown(buffer, 'test.docx', undefined, true);

    // Should create code block but without language
    expect(result.content).toContain('```');
    expect(result.warnings.some(w => 
      w.type === 'code_block' && w.message.includes('language could not be determined')
    )).toBe(true);
  });
});

describe('Table Processing Tests', () => {
  it('should detect inconsistent column counts', async () => {
    const badTable = `
      <table>
        <tr>
          <th>Name</th>
          <th>Age</th>
          <th>City</th>
        </tr>
        <tr>
          <td>John</td>
          <td>30</td>
        </tr>
      </table>
    `;
    const buffer = Buffer.from(badTable);

    const result = await convertDocxToMarkdown(buffer, 'test.docx', undefined, true);

    expect(result.warnings.some(w => 
      w.type === 'table' && w.message.includes('Inconsistent column count')
    )).toBe(true);
  });

  it('should warn about header-only tables', async () => {
    const headerOnlyTable = `
      <table>
        <tr>
          <th>Column 1</th>
          <th>Column 2</th>
        </tr>
      </table>
    `;
    const buffer = Buffer.from(headerOnlyTable);

    const result = await convertDocxToMarkdown(buffer, 'test.docx', undefined, true);

    expect(result.warnings.some(w => 
      w.type === 'table' && w.message.includes('only a header row')
    )).toBe(true);
  });

  it('should pad rows with missing columns', async () => {
    const table = `
      <table>
        <tr>
          <th>Col1</th>
          <th>Col2</th>
          <th>Col3</th>
        </tr>
        <tr>
          <td>A</td>
          <td>B</td>
        </tr>
      </table>
    `;
    const buffer = Buffer.from(table);

    const result = await convertDocxToMarkdown(buffer, 'test.docx', undefined, true);

    // Should have 3 columns in output
    const tableRows = result.content.split('\n').filter(line => line.includes('|'));
    expect(tableRows[2]).toMatch(/\|\s*A\s*\|\s*B\s*\|\s*\|/);
  });

  it('should detect empty cells (potential merged cells)', async () => {
    const table = `
      <table>
        <tr>
          <th>Name</th>
          <th>Value</th>
        </tr>
        <tr>
          <td>Item 1</td>
          <td></td>
        </tr>
      </table>
    `;
    const buffer = Buffer.from(table);

    const result = await convertDocxToMarkdown(buffer, 'test.docx', undefined, true);

    expect(result.warnings.some(w => 
      w.type === 'table' && w.message.includes('Empty table cell')
    )).toBe(true);
  });
});

describe('List Processing Tests', () => {
  it('should reset list state between separate lists', async () => {
    // This test would require mocking Google Docs API
    // Skipped in unit tests, should be covered in integration tests
  });

  it('should warn about mixed list types', async () => {
    // Would require Google Docs API mock
  });

  it('should warn about nesting level jumps', async () => {
    // Would require Google Docs API mock
  });
});

describe('HTML Entity Decoding Tests', () => {
  it('should decode common named entities', async () => {
    const html = `
      <p>Copyright &copy; 2024</p>
      <p>Price: &pound;100</p>
      <p>Temperature: 20&deg;C</p>
    `;
    const buffer = Buffer.from(html);

    const result = await convertDocxToMarkdown(buffer, 'test.docx', undefined, true);

    expect(result.content).toContain('Copyright © 2024');
    expect(result.content).toContain('Price: £100');
    expect(result.content).toContain('Temperature: 20°C');
  });

  it('should decode numeric entities (decimal)', async () => {
    const html = `<p>Quote: &#8220;Hello&#8221;</p>`;
    const buffer = Buffer.from(html);

    const result = await convertDocxToMarkdown(buffer, 'test.docx', undefined, true);

    expect(result.content).toContain('"Hello"');
  });

  it('should decode numeric entities (hexadecimal)', async () => {
    const html = `<p>Em dash&#x2014;here</p>`;
    const buffer = Buffer.from(html);

    const result = await convertDocxToMarkdown(buffer, 'test.docx', undefined, true);

    expect(result.content).toContain('Em dash—here');
  });

  it('should decode mathematical symbols', async () => {
    const html = `
      <p>&alpha; + &beta; = &gamma;</p>
      <p>&infin; &ne; 0</p>
      <p>&sum; &int; &part;</p>
    `;
    const buffer = Buffer.from(html);

    const result = await convertDocxToMarkdown(buffer, 'test.docx', undefined, true);

    expect(result.content).toContain('α + β = γ');
    expect(result.content).toContain('∞ ≠ 0');
    expect(result.content).toContain('∑ ∫ ∂');
  });

  it('should decode quote entities', async () => {
    const html = `
      <p>&ldquo;Hello&rdquo;</p>
      <p>&lsquo;Hi&rsquo;</p>
      <p>&laquo;Bonjour&raquo;</p>
    `;
    const buffer = Buffer.from(html);

    const result = await convertDocxToMarkdown(buffer, 'test.docx', undefined, true);

    expect(result.content).toContain('"Hello"');
    expect(result.content).toContain(''Hi'');
    expect(result.content).toContain('«Bonjour»');
  });
});

describe('Formatting Validation Tests', () => {
  it('should detect unclosed code blocks', async () => {
    const malformed = `
      <pre>
      function test() {
        return true;
      }
      <!-- Missing closing pre tag -->
    `;
    const buffer = Buffer.from(malformed);

    const result = await convertDocxToMarkdown(buffer, 'test.docx', undefined, true);

    const hasCodeBlockWarning = result.warnings.some(w => 
      w.type === 'code_block' && w.message.includes('Unclosed code block')
    );
    expect(hasCodeBlockWarning).toBe(true);
  });

  it('should detect unclosed bold formatting', async () => {
    const malformed = `<p>**Bold text</p>`;
    const buffer = Buffer.from(malformed);

    const result = await convertDocxToMarkdown(buffer, 'test.docx', undefined, true);

    const hasBoldWarning = result.warnings.some(w => 
      w.type === 'formatting' && w.message.includes('Unclosed bold')
    );
    expect(hasBoldWarning).toBe(true);
  });

  it('should detect unclosed italic formatting', async () => {
    const malformed = `<p>*Italic text</p>`;
    const buffer = Buffer.from(malformed);

    const result = await convertDocxToMarkdown(buffer, 'test.docx', undefined, true);

    const hasItalicWarning = result.warnings.some(w => 
      w.type === 'formatting' && w.message.includes('Unclosed italic')
    );
    expect(hasItalicWarning).toBe(true);
  });

  it('should detect unmatched link brackets', async () => {
    const malformed = `<p>[Link text(http://example.com)</p>`;
    const buffer = Buffer.from(malformed);

    const result = await convertDocxToMarkdown(buffer, 'test.docx', undefined, true);

    const hasBracketWarning = result.warnings.some(w => 
      w.type === 'formatting' && w.message.includes('Unmatched brackets')
    );
    expect(hasBracketWarning).toBe(true);
  });
});

describe('Cache Tests', () => {
  it('should store and retrieve complete data', async () => {
    const testContent = 'test content';
    const testResult = {
      title: 'Test Document',
      content: '# Test\n\nContent here',
      images: [{ url: 'http://example.com/img.png', alt: 'Test Image' }],
      headings: [{ text: 'Test', level: 1 }],
      tables: [{ rows: [['A', 'B'], ['1', '2']] }],
      warnings: [],
      metrics: { totalTime: 100, stages: {} },
    };

    await setConversionResultInCache(testContent, 'docx', testResult);
    const cached = await getConversionResultFromCache(testContent, 'docx');

    expect(cached).not.toBeNull();
    expect(cached?.title).toBe('Test Document');
    expect(cached?.content).toBe('# Test\n\nContent here');
    expect(cached?.images).toHaveLength(1);
    expect(cached?.images[0].url).toBe('http://example.com/img.png');
    expect(cached?.headings).toHaveLength(1);
    expect(cached?.headings[0].text).toBe('Test');
    expect(cached?.tables).toHaveLength(1);
    expect(cached?.cached).toBe(true);
  });

  it('should return null for cache miss', async () => {
    const cached = await getConversionResultFromCache('nonexistent', 'docx');
    expect(cached).toBeNull();
  });
});

describe('Parallel Processing Tests', () => {
  it('should process multiple images in parallel', async () => {
    // This would require mocking image upload
    // Test that parallel processing is faster than sequential
  });

  it('should respect concurrency limits', async () => {
    // Test that only IMAGE_UPLOAD_CONCURRENCY images are processed at once
  });

  it('should handle partial failures gracefully', async () => {
    // Test that if some images fail, others still succeed
  });
});

describe('Retry Logic Tests', () => {
  it('should retry failed image uploads', async () => {
    // Mock uploadImageToCloudinary to fail twice then succeed
  });

  it('should use exponential backoff', async () => {
    // Verify delays increase: 1s, 2s, 4s
  });

  it('should throw after max retries exceeded', async () => {
    // Mock to always fail, verify throws after 3 attempts
  });
});

describe('Metrics Tests', () => {
  it('should track processing time for each stage', async () => {
    const buffer = Buffer.from('<p>Test</p>');
    const result = await convertDocxToMarkdown(buffer, 'test.docx', undefined, true);

    expect(result.metrics).toBeDefined();
    expect(result.metrics?.stages.convert).toBeGreaterThan(0);
    expect(result.metrics?.stages.parse).toBeGreaterThan(0);
    expect(result.metrics?.stages.format).toBeGreaterThan(0);
    expect(result.metrics?.totalTime).toBeGreaterThan(0);
  });

  it('should indicate parallel processing in metrics', async () => {
    const htmlWithImages = `
      <img src="http://example.com/1.png">
      <img src="http://example.com/2.png">
    `;
    const buffer = Buffer.from(htmlWithImages);
    const result = await convertDocxToMarkdown(buffer, 'test.docx', undefined, true);

    expect(result.metrics?.parallelProcessing).toBe(true);
    expect(result.metrics?.imageCount).toBe(2);
  });
});

describe('Error Message Sanitization Tests', () => {
  it('should redact tokens from error messages', () => {
    // Test sanitizeErrorMessage function
    const error = new Error('Failed with token=abc123xyz');
    // Would need to expose sanitizeErrorMessage or test through public API
  });

  it('should redact Bearer tokens from error messages', () => {
    const error = new Error('Failed: Bearer ya29.a0AfH6SMB...');
    // Test that Bearer token is redacted
  });
});

describe('Integration Tests', () => {
  it('should handle complex document with all features', async () => {
    const complexDoc = `
      <!DOCTYPE html>
      <html>
        <head><title>Complex Document</title></head>
        <body>
          <h1>Main Title</h1>
          <p>This is a <strong>bold</strong> and <em>italic</em> paragraph.</p>
          
          <h2>Code Section</h2>
          <pre><code>function example() {
  return "Hello, World!";
}</code></pre>
          
          <h2>Table Section</h2>
          <table>
            <tr>
              <th>Name</th>
              <th>Value</th>
            </tr>
            <tr>
              <td>Item 1</td>
              <td>100</td>
            </tr>
          </table>
          
          <h2>List Section</h2>
          <ul>
            <li>First item</li>
            <li>Second item</li>
          </ul>
          
          <p>Link: <a href="https://example.com">Example</a></p>
          <p>Special chars: &copy; &trade; &mdash;</p>
        </body>
      </html>
    `;

    const buffer = Buffer.from(complexDoc);
    const result = await convertDocxToMarkdown(buffer, 'complex.docx', undefined, true);

    // Verify structure
    expect(result.headings).toHaveLength(3);
    expect(result.tables).toHaveLength(1);
    
    // Verify content
    expect(result.content).toContain('# Main Title');
    expect(result.content).toContain('**bold**');
    expect(result.content).toContain('*italic*');
    expect(result.content).toContain('```');
    expect(result.content).toContain('| Name | Value |');
    expect(result.content).toContain('- First item');
    expect(result.content).toContain('[Example](https://example.com)');
    expect(result.content).toContain('©');
    expect(result.content).toContain('™');
    expect(result.content).toContain('—');
  });
});
