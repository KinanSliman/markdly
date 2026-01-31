# Quick Reference Guide - Unified Converter

## 🚀 Quick Start

```typescript
import { convertDocxToMarkdown } from './unified-converter';

const buffer = fs.readFileSync('document.docx');
const result = await convertDocxToMarkdown(buffer, 'document.docx');

console.log(result.content); // Your markdown!
```

## 📋 Common Tasks

### Convert Google Doc
```typescript
await convertGoogleDocToMarkdown(
  docId,        // '1abc...'
  accessToken,  // 'ya29...'
  true,         // isAccessToken
  'folder',     // Cloudinary folder
  false         // Demo mode off
);
```

### Convert .docx with Cache
```typescript
// Check cache
let result = await getConversionResultFromCache(content, 'docx');

// Convert if not cached
if (!result) {
  result = await convertDocxToMarkdown(buffer, 'file.docx');
  await setConversionResultInCache(content, 'docx', result);
}
```

### Demo Mode (Fast Testing)
```typescript
await convertDocxToMarkdown(buffer, 'file.docx', undefined, true);
// ✓ No image upload
// ✓ No Cloudinary needed
// ✓ Fast execution
```

## 🔍 Output Structure

```typescript
{
  title: "Document Title",
  content: "# Markdown content...",
  images: [{ url: "https://...", alt: "..." }],
  headings: [{ text: "Title", level: 1 }],
  tables: [{ rows: [["A", "B"], ["1", "2"]] }],
  warnings: [...],
  metrics: {
    totalTime: 1234,
    stages: { fetch: 200, parse: 100, ... },
    imageCount: 5,
    parallelProcessing: true
  }
}
```

## ⚠️ Warning Handling

```typescript
// Filter by severity
const critical = result.warnings.filter(w => w.severity === 'high');

// Filter by type
const codeIssues = result.warnings.filter(w => w.type === 'code_block');

// Display with context
result.warnings.forEach(w => {
  console.log(`[${w.type}] ${w.message}`);
  console.log(`Suggestion: ${w.suggestion}`);
  if (w.context) console.log(`Context: ${w.context}`);
});
```

## 📊 Performance Monitoring

```typescript
if (result.metrics) {
  console.log('Total:', result.metrics.totalTime, 'ms');
  console.log('Stages:', result.metrics.stages);
  console.log('Images:', result.metrics.imageCount);
  console.log('Parallel:', result.metrics.parallelProcessing);
}

// Identify slow stages
const slowest = Object.entries(result.metrics.stages)
  .sort(([,a], [,b]) => b - a)[0];
console.log('Slowest:', slowest[0], slowest[1], 'ms');
```

## 🔒 Security Features

### Automatically Blocked
- ✅ `javascript:` URLs → `#`
- ✅ `data:` URLs → `#`
- ✅ `<script>` tags → removed
- ✅ Event handlers (`onclick`, etc.) → removed
- ✅ File size > 50MB → rejected
- ✅ Invalid doc IDs → rejected

### Error Message Sanitization
```typescript
// Tokens are automatically redacted
'Bearer abc123...' → 'Bearer [REDACTED]'
'token=xyz789'     → 'token=[REDACTED]'
```

## 🎯 Code Detection

### Detected Languages
JavaScript, TypeScript, Python, Java, C++, C#, Go, Rust, PHP, Ruby, Bash, SQL, JSON, YAML, HTML, CSS

### Detection Methods
1. Monospace font (Courier, Consolas, Monaco)
2. Small font size (< 10pt)
3. 4+ spaces indentation
4. Language patterns (requires 2+ matches)

### Manual Override
If auto-detection fails, manually add language:
```markdown
```javascript
// Your code here
\```
```

## 📏 Validation Rules

### Tables
- ⚠️ Inconsistent column counts
- ⚠️ Empty cells (merged cells not supported)
- ⚠️ Header-only tables

### Lists
- ⚠️ Mixed bullet/numbered types
- ⚠️ Nesting level jumps
- ✓ Auto-reset between separate lists

### Headings
- ⚠️ Skipped levels (H1 → H3)
- ✓ Proper hierarchy validation

### Formatting
- ⚠️ Unclosed code blocks
- ⚠️ Unclosed bold/italic
- ⚠️ Unmatched brackets

## ⚡ Performance Tips

### 1. Use Demo Mode for Testing
```typescript
// ✓ Fast - no image upload
await convertDocxToMarkdown(buffer, 'file.docx', undefined, true);

// ✗ Slow - uploads images
await convertDocxToMarkdown(buffer, 'file.docx', 'folder', false);
```

### 2. Cache Conversions
```typescript
// First conversion: 2000ms
// Cached retrieval: <10ms
```

### 3. Batch Processing
```typescript
// Process 5 at a time
const results = await Promise.all(
  files.slice(0, 5).map(f => convertDocxToMarkdown(f))
);
```

### 4. Monitor Metrics
```typescript
if (result.metrics.totalTime > 10000) {
  console.warn('Slow conversion:', result.metrics);
}
```

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Images not uploading | Check Cloudinary credentials |
| Slow conversion | Use demo mode or check network |
| Memory errors | Reduce file size or increase Node memory |
| .doc file rejected | Convert to .docx first |
| Cache not working | Check cache manager initialization |

## 🔧 Configuration

### Environment Variables
```bash
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

### Adjustable Constants
```typescript
MAX_INPUT_SIZE = 50 * 1024 * 1024;      // 50MB
MAX_RETRY_ATTEMPTS = 3;                  // Retry count
IMAGE_UPLOAD_CONCURRENCY = 5;            // Parallel uploads
REQUEST_TIMEOUT_MS = 30000;              // 30 seconds
```

## 📝 Best Practices

### ✅ DO
- Use demo mode for testing
- Check cache before converting
- Handle warnings appropriately
- Monitor performance metrics
- Validate file extensions
- Set reasonable timeouts

### ❌ DON'T
- Skip error handling
- Ignore high-severity warnings
- Convert files > 50MB
- Use without input validation
- Forget to cache results
- Block on sequential processing

## 🔄 Error Handling Pattern

```typescript
try {
  const result = await convertDocxToMarkdown(buffer, fileName);
  
  // Check for critical warnings
  const critical = result.warnings.filter(w => w.severity === 'high');
  if (critical.length > 0) {
    console.warn('Critical issues found:', critical);
  }
  
  return result;
  
} catch (error: any) {
  console.error('Conversion failed:', error.message);
  
  // Retry logic
  if (shouldRetry(error)) {
    return await retry(() => convertDocxToMarkdown(buffer, fileName));
  }
  
  throw error;
}
```

## 📊 Common Metrics

| Metric | Good | Fair | Poor |
|--------|------|------|------|
| Total time | <2s | 2-5s | >5s |
| Image upload | <1s/img | 1-3s/img | >3s/img |
| Parse time | <100ms | 100-500ms | >500ms |
| Cache hit rate | >80% | 50-80% | <50% |

## 🎨 Output Examples

### Headings
```markdown
# Level 1 Heading
## Level 2 Heading
### Level 3 Heading
```

### Formatting
```markdown
**bold** *italic* ~~strikethrough~~
[link text](https://example.com)
`inline code`
```

### Tables
```markdown
| Name | Value |
| --- | --- |
| Item 1 | 100 |
| Item 2 | 200 |
```

### Code Blocks
````markdown
```javascript
function hello() {
  console.log('Hello, World!');
}
```
````

### Lists
```markdown
- Bullet item 1
- Bullet item 2
  - Nested item

1. Numbered item 1
2. Numbered item 2
```

## 🔗 API Reference

### Main Functions

```typescript
// Convert Google Doc
convertGoogleDocToMarkdown(
  docId: string,
  token: string,
  isAccessToken?: boolean,
  cloudinaryFolder?: string,
  isDemo?: boolean
): Promise<ConversionOutput>

// Convert .docx
convertDocxToMarkdown(
  fileContent: Buffer | string,
  fileName?: string,
  cloudinaryFolder?: string,
  isDemo?: boolean
): Promise<ConversionOutput>

// Cache operations
getConversionResultFromCache(
  content: string,
  fileType: 'docx'
): Promise<ConversionOutput | null>

setConversionResultInCache(
  content: string,
  fileType: 'docx',
  result: ConversionOutput
): Promise<void>
```

## 📞 Support Checklist

When reporting issues, include:
- ✅ Input file (or sample)
- ✅ Expected output
- ✅ Actual output
- ✅ Error messages
- ✅ Warnings received
- ✅ Performance metrics
- ✅ Environment (Node version, OS)
- ✅ Code snippet showing usage

---

**Quick Links**
- [Full Documentation](./README.md)
- [Test Suite](./unified-converter.test.ts)
- [Examples](./examples.ts)
- [Source Code](./unified-converter.ts)
