# Web Workers Module

## Overview

The Web Workers module enables **client-side file conversion** for Markdly, allowing users to convert HTML, RTF, TXT, and DOCX files to Markdown directly in their browser without server round-trips.

## Architecture

### Why Web Workers?

**Performance Benefits:**
- **Non-blocking UI**: Conversion runs in a separate thread, keeping the main thread responsive
- **Faster response**: No network latency for file-based conversions
- **Better UX**: Real-time progress updates during conversion
- **Scalability**: Reduces server load by offloading conversion to client browsers

### Worker Scope

**Supported Conversions (Client-Side):**
- ✅ HTML → Markdown
- ✅ TXT → Markdown
- ✅ RTF → Markdown (basic support)
- ✅ DOCX → Markdown (using mammoth.js)

**Server-Side Conversions (API Required):**
- ⚠️ Google Docs → Markdown (requires OAuth tokens and API access)
- ⚠️ Cloudinary image uploads (requires Cloudinary API)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Main Thread (UI)                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Converter Page (app/converter/page.tsx)             │  │
│  │  - User selects file                                 │  │
│  │  - Displays progress (ConversionProgress component)  │  │
│  │  - Shows results                                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                │
│                            │ postMessage()                  │
│                            ▼                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Worker Wrapper (worker-wrapper.ts)                  │  │
│  │  - Manages worker lifecycle                          │  │
│  │  - Handles message routing                           │  │
│  │  - Timeout & error handling                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                │
│                            │ Transferable objects           │
└────────────────────────────┼────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────┐
│                     Web Worker (Separate Thread)            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  File Conversion Worker (file-conversion-worker.ts)  │  │
│  │  - Receives file content                             │  │
│  │  - Parses file format                                │  │
│  │  - Converts to Markdown                              │  │
│  │  - Sends progress updates                            │  │
│  │  - Returns result                                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Message Protocol

### Request: Convert File

```typescript
{
  type: 'CONVERT',
  payload: {
    content: string;        // File content (text or base64)
    fileName: string;       // Original file name
    fileType: 'html' | 'txt' | 'rtf' | 'docx';
    isBase64?: boolean;     // For DOCX files
  },
  requestId: string;
  timestamp: number;
}
```

### Response: Progress Update

```typescript
{
  type: 'PROGRESS',
  payload: {
    stage: string;          // Current stage name
    progress: number;       // Percentage (0-100)
    message: string;        // Human-readable message
    context?: object;       // Additional context
  },
  timestamp: number;
}
```

### Response: Result

```typescript
{
  type: 'RESULT',
  payload: {
    content: string;        // Converted Markdown
    title: string;          // Document title
    headings: Array<{ text: string; level: number }>;
    tables: number;
    images: number;
    warnings: Array<{
      type: string;
      message: string;
      suggestion?: string;
      context?: object;
    }>;
    metrics: {
      totalTime: number;    // Milliseconds
      stages: Record<string, number>;
    };
  },
  timestamp: number;
}
```

### Response: Error

```typescript
{
  type: 'ERROR',
  payload: {
    code: string;           // Error code
    message: string;        // Error message
    suggestion?: string;    // How to fix
    stack?: string;         // Stack trace
    context?: object;       // Additional context
  },
  timestamp: number;
}
```

## Usage

### Basic Usage

```typescript
import { createFileConversionWorker } from '@/lib/workers';

// Create worker
const worker = await createFileConversionWorker({
  onProgress: (progress) => {
    console.log(`${progress.progress}% - ${progress.stage}: ${progress.message}`);
  },
  onResult: (result) => {
    console.log('Conversion complete:', result.title);
    console.log(result.content);
  },
  onError: (error) => {
    console.error('Conversion failed:', error.message);
  },
});

// Convert a file
const fileContent = await readFileAsText(file);
const result = await worker.convert({
  content: fileContent,
  fileName: 'document.html',
  fileType: 'html',
});

// Cleanup
worker.dispose();
```

### With React Hook

```typescript
import { useState } from 'react';
import { createFileConversionWorker, WorkerResultPayload } from '@/lib/workers';
import { ConversionProgress, useConversionProgress } from '@/components/conversion-progress';

function FileConverter() {
  const [result, setResult] = useState<WorkerResultPayload | null>(null);
  const [worker, setWorker] = useState<WorkerWrapper | null>(null);

  const {
    progress,
    stage,
    message,
    error: progressError,
    isProcessing,
    setProgress,
    setError,
    setComplete,
  } = useConversionProgress();

  useEffect(() => {
    // Initialize worker
    createFileConversionWorker({
      onProgress: (payload) => setProgress(payload.progress, payload.stage, payload.message),
      onResult: (payload) => {
        setResult(payload);
        setComplete();
      },
      onError: (payload) => setError(payload.message),
    }).then(setWorker);

    return () => worker?.dispose();
  }, []);

  const handleConvert = async (file: File) => {
    const content = await readFileAsText(file);
    await worker.convert({
      content,
      fileName: file.name,
      fileType: 'html',
    });
  };

  return (
    <div>
      {isProcessing && (
        <ConversionProgress
          progress={progress}
          stage={stage}
          message={message}
          isProcessing={isProcessing}
        />
      )}
      {result && <pre>{result.content}</pre>}
    </div>
  );
}
```

### Fallback to API

```typescript
import { isWebWorkerSupported } from '@/lib/workers';

async function convertFile(file: File) {
  if (isWebWorkerSupported()) {
    // Use Web Worker
    const worker = await createFileConversionWorker();
    return worker.convert({ /* ... */ });
  } else {
    // Fallback to API
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('/api/convert-demo', { method: 'POST', body: formData });
    return response.json();
  }
}
```

## Conversion Stages

The worker processes files through these stages:

| Stage | Progress | Description |
|-------|----------|-------------|
| `init` | 5% | Initializing conversion environment |
| `parse` | 20-30% | Reading and analyzing file content |
| `process` | 40-60% | Converting to Markdown format |
| `format` | 70-85% | Structuring output |
| `validate` | 95% | Checking for issues |
| `complete` | 100% | Conversion finished |

## File Type Support

### HTML (.html, .htm)
- **Full support** with comprehensive parsing
- Handles headings (H1-H6), paragraphs, lists, code blocks
- Converts bold, italic, links, images, blockquotes
- Decodes HTML entities

### TXT (.txt)
- **Basic support** for plain text
- Detects potential headings (ALL CAPS or lines ending with `:`)
- Preserves line breaks and paragraphs

### RTF (.rtf)
- **Basic support** for RTF files
- Removes RTF control words and extracts text
- Handles basic formatting (bold, italic)

### DOCX (.docx)
- **Full support** using mammoth.js library
- Preserves headings, lists, tables, formatting
- Extracts images (if present in document)
- Converts to HTML first, then to Markdown

## Error Handling

### Common Errors

| Error Code | Cause | Solution |
|------------|-------|----------|
| `BUSY` | Worker already processing | Wait for current conversion to complete |
| `INVALID_PAYLOAD` | Missing required fields | Ensure all fields are provided |
| `CONVERSION_ERROR` | File parsing failed | Check file format and try again |
| `WORKER_ERROR` | Worker crashed | Reload page or try API fallback |
| `TIMEOUT` | Conversion took too long | Try with smaller file |

### Error Recovery

```typescript
try {
  const result = await worker.convert(payload);
} catch (error) {
  if (error.message.includes('timeout')) {
    // File too large, try API fallback
    await convertViaApi(file);
  } else if (error.message.includes('Worker')) {
    // Worker crashed, reload
    window.location.reload();
  } else {
    // Invalid file format
    showError('Please check file format and try again');
  }
}
```

## Performance Characteristics

### File Size Limits

| File Type | Recommended Max | Notes |
|-----------|----------------|-------|
| HTML | 10 MB | Large files may cause timeout |
| TXT | 5 MB | Plain text is fast to process |
| RTF | 5 MB | Basic parsing only |
| DOCX | 15 MB | mammoth.js handles large files well |

### Conversion Speed

| File Size | Approximate Time |
|-----------|------------------|
| < 100 KB | < 100ms |
| 100 KB - 1 MB | 100-500ms |
| 1 MB - 5 MB | 500ms - 2s |
| 5 MB - 15 MB | 2s - 5s |

### Memory Usage

- Web Workers run in isolated memory space
- Large files are processed without blocking main thread
- Memory is automatically garbage collected after conversion

## Browser Compatibility

| Browser | Web Workers | Notes |
|---------|-------------|-------|
| Chrome 4+ | ✅ | Full support |
| Firefox 3.5+ | ✅ | Full support |
| Safari 4+ | ✅ | Full support |
| Edge 12+ | ✅ | Full support |
| IE 10+ | ✅ | Full support |

### Fallback Strategy

```typescript
if (!isWebWorkerSupported()) {
  // Use API endpoint for conversion
  // Show warning to user
}
```

## Testing

### Unit Tests

```bash
npm test -- tests/unit/lib/workers/
```

### Integration Tests

```bash
npm test -- tests/integration/workers.test.ts
```

### Manual Testing

1. **Test HTML conversion:**
   ```bash
   # Create test HTML file
   echo '<h1>Test</h1><p>Hello World</p>' > test.html
   # Upload to converter page
   ```

2. **Test DOCX conversion:**
   - Create a Word document with headings, lists, tables
   - Save as .docx
   - Upload to converter page

3. **Test progress tracking:**
   - Upload large file (>1MB)
   - Verify progress bar updates
   - Check stage labels change

## Troubleshooting

### Worker Not Initializing

**Symptom:** "Worker not initialized" error

**Solution:**
```typescript
// Check browser support
if (!isWebWorkerSupported()) {
  // Use API fallback
}

// Ensure worker is initialized before use
await worker.init();
```

### Conversion Timeout

**Symptom:** "Conversion timeout after 60000ms"

**Solution:**
```typescript
// Increase timeout
const worker = new WorkerWrapper(workerUrl, { timeout: 120000 });

// Or use API for large files
if (file.size > 10 * 1024 * 1024) {
  convertViaApi(file);
}
```

### Memory Issues

**Symptom:** Browser freezes or crashes

**Solution:**
- Reduce file size
- Close other tabs
- Clear browser cache
- Try different browser

## API Reference

### `createFileConversionWorker(options)`

Creates and initializes a Web Worker for file conversion.

**Parameters:**
- `options.onProgress` - Progress callback
- `options.onResult` - Result callback
- `options.onError` - Error callback
- `options.onReady` - Ready callback
- `options.onWorkerError` - Worker error callback
- `options.timeout` - Timeout in ms (default: 60000)

**Returns:** `Promise<WorkerWrapper>`

### `WorkerWrapper.convert(payload)`

Converts a file using the worker.

**Parameters:**
- `payload.content` - File content
- `payload.fileName` - File name
- `payload.fileType` - File type
- `payload.isBase64` - Whether content is base64 (for DOCX)

**Returns:** `Promise<WorkerResultPayload>`

### `WorkerWrapper.cancel()`

Cancels the current conversion.

### `WorkerWrapper.dispose()`

Terminates the worker and cleans up resources.

### `isWebWorkerSupported()`

Checks if Web Workers are supported in the current browser.

**Returns:** `boolean`

## Future Enhancements

### Planned Features

1. **Worker Pool** - Multiple workers for concurrent conversions
2. **Progressive Enhancement** - Chunked processing for very large files
3. **Cache Layer** - Cache conversion results by file hash
4. **Offline Support** - Service Worker for offline conversions
5. **Batch Processing** - Convert multiple files simultaneously

### Performance Optimizations

- WebAssembly for faster parsing
- Streaming processing for large files
- Compression for file transfer between threads

## Related Files

- `lib/workers/types/worker-messages.ts` - Message type definitions
- `lib/workers/file-conversion-worker.ts` - Worker implementation
- `lib/workers/worker-wrapper.ts` - Worker wrapper for main thread
- `lib/workers/index.ts` - Module exports
- `components/conversion-progress.tsx` - Progress UI component
- `app/converter/page.tsx` - Converter page integration

## References

- [MDN: Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [mammoth.js Documentation](https://github.com/mwilliamson/mammoth.js)
- [Web Worker Best Practices](https://web.dev/off-main-thread/)
