# Unified Document Converter - BULLETPROOF EDITION

## 🛡️ Security-Hardened, Performance-Optimized Document Conversion

This is a production-ready, enterprise-grade document converter that transforms Google Docs and .docx files into clean Markdown format.

## ✨ Key Features

### 🔒 Security
- **ReDoS Protection**: Safe HTML parsing without catastrophic backtracking
- **XSS Prevention**: Sanitizes JavaScript URLs, event handlers, and embedded scripts
- **Input Validation**: File size limits, format validation, and malicious input detection
- **URL Sanitization**: Blocks `javascript:`, `data:`, and other dangerous protocols
- **Error Message Sanitization**: Redacts sensitive tokens and credentials

### ⚡ Performance
- **Parallel Image Processing**: Processes images concurrently with configurable batch size
- **Smart Caching**: Complete data preservation including images, headings, and tables
- **Retry Logic**: Exponential backoff for transient failures
- **Request Timeouts**: Prevents hanging on slow network requests
- **Performance Metrics**: Detailed timing for each processing stage

### 🎯 Accuracy
- **Advanced Code Detection**: Multi-heuristic approach with minimal false positives
  - Font family analysis (monospace fonts)
  - Font size detection (small fonts indicate code)
  - Indentation patterns
  - Language-specific syntax patterns
- **Smart Language Detection**: Identifies 15+ programming languages with confidence scoring
- **Proper List Handling**: State management with reset logic between separate lists
- **Table Validation**: Column count consistency, empty cell detection, padding
- **Heading Hierarchy**: Validates proper document structure

### 🔧 Robustness
- **Comprehensive HTML Entity Support**: 60+ named entities plus numeric entities
- **Format Validation**: Detects unclosed code blocks, bold, italic, and links
- **Warning System**: Actionable suggestions with severity levels
- **Graceful Degradation**: Continues processing even when parts fail

## 📦 Installation

```bash
npm install
```

## 🚀 Usage

### Convert Google Doc

```typescript
import { convertGoogleDocToMarkdown } from './unified-converter';

const result = await convertGoogleDocToMarkdown(
  'document-id',           // Google Doc ID
  'access-token',          // OAuth access token
  true,                    // isAccessToken
  'cloudinary/folder',     // Image upload folder
  false                    // isDemo
);

console.log(result.content);    // Markdown content
console.log(result.headings);   // Extracted headings
console.log(result.tables);     // Extracted tables
console.log(result.images);     // Processed images
console.log(result.warnings);   // Conversion warnings
console.log(result.metrics);    // Performance metrics
```

### Convert .docx File

```typescript
import { convertDocxToMarkdown } from './unified-converter';
import fs from 'fs';

const fileBuffer = fs.readFileSync('document.docx');

const result = await convertDocxToMarkdown(
  fileBuffer,              // File content (Buffer or base64)
  'document.docx',         // File name
  'cloudinary/folder',     // Image upload folder
  false                    // isDemo
);

console.log(result.content);
console.log(result.originalContent); // Raw text extraction
```

### Use Caching

```typescript
import {
  getConversionResultFromCache,
  setConversionResultInCache
} from './unified-converter';

// Check cache before conversion
const cached = await getConversionResultFromCache(fileContent, 'docx');
if (cached) {
  console.log('Using cached result');
  return cached;
}

// Convert and cache
const result = await convertDocxToMarkdown(fileContent, 'file.docx');
await setConversionResultInCache(fileContent, 'docx', result);
```

## 🔧 Configuration

### Environment Variables

```bash
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Constants (Configurable)

```typescript
const MAX_INPUT_SIZE = 50 * 1024 * 1024;      // 50MB
const MAX_RETRY_ATTEMPTS = 3;                  // Retry count
const RETRY_DELAY_MS = 1000;                   // Initial retry delay
const IMAGE_UPLOAD_CONCURRENCY = 5;            // Parallel image uploads
const REQUEST_TIMEOUT_MS = 30000;              // 30 seconds
const CODE_INDENTATION = 4;                    // Spaces for code
const SMALL_FONT_SIZE = 10;                    // Points for code detection
```

## 📊 Output Structure

```typescript
interface ConversionOutput {
  title: string;                              // Document title
  content: string;                            // Markdown content
  images: Array<{                             // Processed images
    url: string;
    alt: string;
  }>;
  headings: Array<{                           // Document structure
    text: string;
    level: number;
  }>;
  tables: Array<{                             // Extracted tables
    rows: string[][];
  }>;
  warnings: ConversionWarning[];              // Issues found
  metrics?: ConversionMetrics;                // Performance data
  originalContent?: string;                   // Raw text (docx only)
  cached?: boolean;                           // From cache?
}

interface ConversionWarning {
  type: 'code_block' | 'heading' | 'table' | 'list' | 'formatting' | 'image' | 'security';
  message: string;                            // What happened
  suggestion: string;                         // How to fix
  context?: string;                           // Where it happened
  severity?: 'low' | 'medium' | 'high';       // How important
}

interface ConversionMetrics {
  totalTime: number;                          // Total ms
  stages: Record<string, number>;             // Time per stage
  cached?: boolean;                           // Was cached
  imageCount?: number;                        // Images processed
  parallelProcessing?: boolean;               // Used parallel processing
}
```

## 🎨 Supported Formats

### Input Formats
- ✅ Google Docs (via API)
- ✅ .docx files (Office Open XML)
- ❌ .doc files (Legacy - not supported)

### Output Format
- Markdown (GitHub Flavored)

### Preserved Elements
- ✅ Headings (H1-H6)
- ✅ Bold, Italic, Strikethrough
- ✅ Links with URL validation
- ✅ Images (uploaded to Cloudinary)
- ✅ Tables (with validation)
- ✅ Ordered/Unordered lists
- ✅ Code blocks with language detection
- ✅ Inline code
- ✅ Blockquotes
- ✅ Line breaks and paragraphs

## 🧪 Code Detection

### Detection Heuristics

1. **Font Analysis**: Monospace fonts (Courier, Consolas, Monaco)
2. **Size Analysis**: Small font size (< 10pt)
3. **Indentation**: 4+ spaces of leading whitespace
4. **Pattern Matching**: Language-specific syntax

### Supported Languages (15+)

- JavaScript/TypeScript
- Python
- Java
- C++/C
- C#
- Go
- Rust
- PHP
- Ruby
- Bash/Shell
- SQL
- JSON
- YAML
- HTML
- CSS

### Language Detection

Requires **2+ pattern matches** for confidence:

```typescript
// JavaScript detection patterns
/function\s+\w+/
/const\s+\w+/
/console\./
/import\s+.*from/
/=>/

// Python detection patterns
/^def\s+\w+/
/^class\s+\w+/
/print\s*\(/
/^import\s+/
```

## 🔍 Warning System

### Warning Types

| Type | Description | Example |
|------|-------------|---------|
| `code_block` | Code-related issues | Unclosed code block, missing language |
| `heading` | Document structure | Skipped heading levels (H1→H3) |
| `table` | Table formatting | Inconsistent columns, empty cells |
| `list` | List structure | Mixed types, nesting jumps |
| `formatting` | Markdown syntax | Unclosed bold/italic |
| `image` | Image processing | Upload failures |
| `security` | Security concerns | Sanitized content |

### Severity Levels

- **Low**: Minor issues, cosmetic
- **Medium**: Structure problems, may affect readability
- **High**: Data loss risk, formatting errors

### Example Warning

```typescript
{
  type: 'table',
  message: 'Inconsistent column count in table',
  suggestion: 'Ensure all rows have the same number of columns',
  context: 'Expected 3 columns, got 2 in row 5',
  severity: 'high'
}
```

## 🔒 Security Features

### 1. ReDoS Protection

**Problem**: Complex regex can cause exponential backtracking
```javascript
// ❌ Vulnerable (OLD)
/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi

// ✅ Safe (NEW)
removeHtmlTags(html, 'script') // Iterative approach
```

### 2. XSS Prevention

```typescript
// Sanitizes:
- javascript: URLs          → #
- data: URLs                → #
- onclick/onerror handlers  → removed
- <script> tags             → removed
- <iframe> tags             → removed
```

### 3. Input Validation

```typescript
// Checks:
- File size (max 50MB)
- Doc ID format (alphanumeric + -_)
- Doc ID length (max 200 chars)
- Token length (max 10000 chars)
- Image size (max 10MB)
- Image mime type (must be image/*)
```

### 4. Error Sanitization

```typescript
// Redacts:
'Bearer ya29.abc123...' → 'Bearer [REDACTED]'
'token=xyz789'          → 'token=[REDACTED]'
'key=secret123'         → 'key=[REDACTED]'
```

## ⚡ Performance Optimizations

### 1. Parallel Image Processing

```typescript
// OLD: Sequential (slow)
for (const image of images) {
  await uploadImage(image); // Wait for each
}

// NEW: Parallel (fast)
const batches = chunk(images, 5); // 5 at a time
for (const batch of batches) {
  await Promise.all(batch.map(uploadImage)); // Parallel
}
```

**Speedup**: ~5x faster for documents with multiple images

### 2. Retry with Exponential Backoff

```typescript
// Retry delays: 1s, 2s, 4s
const result = await retryWithBackoff(
  () => uploadImage(url),
  maxAttempts: 3,
  baseDelay: 1000
);
```

### 3. Request Timeouts

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);

fetch(url, { signal: controller.signal });
```

### 4. Smart Caching

```typescript
// OLD: Partial cache (data loss)
{
  content: "...",
  images: [],    // ❌ Lost
  headings: [],  // ❌ Lost
  tables: []     // ❌ Lost
}

// NEW: Complete cache
{
  content: "...",
  images: [...],    // ✅ Preserved
  headings: [...],  // ✅ Preserved
  tables: [...]     // ✅ Preserved
}
```

## 📈 Performance Metrics

Example output:

```typescript
{
  totalTime: 2547,  // ms
  stages: {
    fetch: 823,         // API call
    parse: 45,          // Document parsing
    process: 234,       // Markdown conversion
    imageUpload: 1398,  // Image processing (parallel)
    format: 47          // Final formatting
  },
  imageCount: 12,
  parallelProcessing: true,
  cached: false
}
```

## 🧪 Testing

### Run Tests

```bash
npm test                    # All tests
npm test -- security        # Security tests only
npm test -- --coverage      # With coverage
```

### Test Categories

- **Security Tests**: ReDoS, XSS, injection, validation
- **Code Detection**: Language patterns, false positives
- **Table Processing**: Validation, consistency, padding
- **HTML Entities**: Named, numeric, special characters
- **Formatting**: Validation, unclosed tags
- **Caching**: Storage, retrieval, data completeness
- **Parallel Processing**: Concurrency, batch processing
- **Retry Logic**: Exponential backoff, max attempts
- **Integration**: Complex documents with all features

## 🐛 Troubleshooting

### Issue: Images not uploading

**Solution**: Check Cloudinary credentials and folder permissions

```typescript
// Test with demo mode first
await convertDocxToMarkdown(buffer, 'file.docx', undefined, true);
```

### Issue: Slow conversion

**Solution**: Check image count and network speed

```typescript
// Increase concurrency for faster processing
const IMAGE_UPLOAD_CONCURRENCY = 10; // Default: 5
```

### Issue: Memory errors

**Solution**: Reduce file size or increase Node memory

```bash
node --max-old-space-size=4096 your-script.js
```

### Issue: ReDoS warnings in logs

**Solution**: Already protected! Warnings are from input validation, not vulnerability

## 📝 Best Practices

### 1. Always Use Demo Mode for Testing

```typescript
const result = await convertDocxToMarkdown(
  buffer,
  'test.docx',
  undefined,
  true  // Demo mode - skip image upload
);
```

### 2. Handle Warnings

```typescript
if (result.warnings.length > 0) {
  const highSeverity = result.warnings.filter(w => w.severity === 'high');
  if (highSeverity.length > 0) {
    console.warn('Critical issues found:', highSeverity);
  }
}
```

### 3. Monitor Performance

```typescript
if (result.metrics && result.metrics.totalTime > 10000) {
  console.warn('Slow conversion detected:', result.metrics);
}
```

### 4. Use Caching

```typescript
// Always check cache first
const cacheKey = hashContent(fileContent);
let result = await getConversionResultFromCache(cacheKey, 'docx');

if (!result) {
  result = await convertDocxToMarkdown(fileContent, fileName);
  await setConversionResultInCache(cacheKey, 'docx', result);
}
```

## 🔄 Migration from Old Version

### Breaking Changes

None! The API is backward compatible.

### New Features You Can Use

```typescript
// 1. Severity levels in warnings
const criticalWarnings = result.warnings.filter(w => w.severity === 'high');

// 2. Enhanced metrics
console.log(`Processed ${result.metrics.imageCount} images in parallel`);

// 3. Complete cache data
const cached = await getConversionResultFromCache(content, 'docx');
console.log(cached.images); // Now available!

// 4. Better error messages
try {
  await convertGoogleDocToMarkdown(docId, token);
} catch (error) {
  // Error messages are sanitized (no token leaks)
  console.error(error.message);
}
```

## 🤝 Contributing

### Running Tests

```bash
npm test
npm run test:coverage
npm run test:security
```

### Adding New Languages

1. Add patterns to `detectCodeLanguage()`
2. Add test cases
3. Update documentation

```typescript
const languagePatterns: Array<[string, RegExp[]]> = [
  ['kotlin', [
    /fun\s+\w+/,
    /val\s+\w+/,
    /var\s+\w+/,
  ]],
  // ...
];
```

## 📄 License

MIT

## 🙏 Credits

Built with:
- [googleapis](https://github.com/googleapis/google-api-nodejs-client)
- [mammoth.js](https://github.com/mwilliamson/mammoth.js)
- [cloudinary](https://cloudinary.com)

## 📞 Support

For issues, please create a GitHub issue with:
- Input file (if possible)
- Expected output
- Actual output
- Error messages
- Environment details

---

**Made with ❤️ for bulletproof document conversion**
