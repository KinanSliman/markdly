# Cache Module

## Overview

The Cache module provides high-performance caching for Markdly conversion results, enabling:

- **10-100x faster** repeated conversions
- **Reduced server load** by avoiding redundant processing
- **Flexible backends** (in-memory or Redis)
- **Smart eviction** (LRU, TTL-based)
- **Metrics tracking** for monitoring

## Architecture

### Cache Flow

```
Conversion Request
  ↓
[Cache Key Generation] - Hash of content + options
  ↓
[Cache Lookup] - Check if result exists
  ↓
├─ Cache Hit (10-100x faster)
│  └─ Return cached result
│
└─ Cache Miss
   ├─ Process conversion
   └─ Store result in cache
   └─ Return result
```

### Backend Options

| Backend | Use Case | Pros | Cons |
|---------|----------|------|------|
| **In-Memory** | Development, small scale | Fast, no setup, zero dependencies | Limited by RAM, not shared |
| **Redis** | Production, multi-server | Shared, scalable, persistent | Requires Redis server |

## Installation

### For Redis Backend (Optional)

```bash
npm install ioredis
```

## Usage

### Basic Usage

```typescript
import { createInMemoryCache } from '@/lib/cache';

// Create cache manager
const cache = createInMemoryCache({
  maxSize: 1000,           // Max 1000 entries
  defaultTTL: 3600000,     // 1 hour default TTL
  enableMetrics: true,     // Track statistics
});

// Get or compute value
const result = await cache.getOrCompute(
  { content: fileContent, fileType: 'html' },
  async () => {
    // This only runs on cache miss
    return await convertFile(fileContent, 'html');
  },
  { prefix: 'conversion', ttl: 3600000 }
);

// Get from cache only
const cached = await cache.get(
  { content: fileContent, fileType: 'html' },
  { prefix: 'conversion' }
);

// Check if exists
const exists = await cache.has(
  { content: fileContent, fileType: 'html' },
  { prefix: 'conversion' }
);

// Delete specific entry
await cache.delete(
  { content: fileContent, fileType: 'html' },
  { prefix: 'conversion' }
);

// Invalidate by pattern
await cache.invalidate('conversion:*');

// Get statistics
const stats = await cache.stats();
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);

// Clear all
await cache.clear();

// Cleanup
await cache.close();
```

### With Redis Backend

```typescript
import { createRedisCache } from '@/lib/cache';

const cache = await createRedisCache({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  prefix: 'markdly',
  ttl: 3600, // seconds
}, {
  maxSize: 10000,
  defaultTTL: 3600000,
});
```

### Auto-Detection (Recommended)

```typescript
import { createCacheManager } from '@/lib/cache';

// Automatically uses Redis if REDIS_URL is set, otherwise in-memory
const cache = await createCacheManager({
  maxSize: 1000,
  defaultTTL: 3600000,
});
```

## Integration with Conversion Pipeline

### Cache Key Generation

```typescript
import { defaultCacheKeyGenerator } from '@/lib/cache';

// Generate cache key from conversion input
const cacheKey = defaultCacheKeyGenerator(
  {
    contentHash: 'abc123',  // MD5/SHA of file content
    fileType: 'html',
    options: { /* conversion options */ }
  },
  { prefix: 'conversion' }
);
// Result: "conversion:xyz789"
```

### Pipeline Integration

```typescript
import { createCacheManager } from '@/lib/cache';
import { convertGoogleDocToMarkdownWithPipeline } from '@/lib/markdown';

const cache = await createCacheManager();

async function convertWithCache(docId: string, token: string) {
  // Generate cache key
  const cacheKey = {
    docId,
    tokenHash: hashString(token), // Don't cache tokens!
    timestamp: Math.floor(Date.now() / 3600000), // Hourly buckets
  };

  // Try cache first
  const cached = await cache.get(cacheKey, { prefix: 'google-doc' });
  if (cached) {
    return { ...cached, metrics: { ...cached.metrics, cached: true } };
  }

  // Process conversion
  const result = await convertGoogleDocToMarkdownWithPipeline(docId, token);

  // Store in cache (1 hour TTL)
  await cache.set(cacheKey, result, 3600000, { prefix: 'google-doc' });

  return { ...result, metrics: { ...result.metrics, cached: false } };
}
```

### API Route Integration

```typescript
// app/api/convert-demo/route.ts
import { createCacheManager } from '@/lib/cache';

const cache = await createCacheManager();

export async function POST(request: Request) {
  const { docId } = await request.json();

  // Generate cache key (without sensitive data)
  const cacheKey = {
    docId,
    timestamp: Math.floor(Date.now() / 3600000), // Hourly cache
  };

  // Try cache
  const cached = await cache.get(cacheKey, { prefix: 'demo' });
  if (cached) {
    return Response.json({
      ...cached,
      sourceType: 'google-doc',
      cached: true,
    });
  }

  // Process conversion
  const result = await convertDocument(docId);

  // Store in cache
  await cache.set(cacheKey, result, 3600000, { prefix: 'demo' });

  return Response.json({
    ...result,
    sourceType: 'google-doc',
    cached: false,
  });
}
```

## Cache Strategies

### TTL (Time-To-Live)

```typescript
// Entry expires after specified time
await cache.set(key, value, 3600000); // 1 hour
```

### LRU (Least Recently Used)

```typescript
// When cache is full, least recently used entries are evicted
const cache = createInMemoryCache({
  maxSize: 1000, // Max 1000 entries
});
```

### Size-Based Eviction

```typescript
// Combined with LRU for memory management
const cache = createInMemoryCache({
  maxSize: 1000,
  defaultTTL: 3600000,
});
```

## Cache Invalidation

### Manual Invalidation

```typescript
// Invalidate specific entry
await cache.delete(cacheKey);

// Invalidate by pattern
await cache.invalidate('conversion:*');

// Invalidate all Google Doc conversions
await cache.invalidate('google-doc:*');

// Invalidate all demo conversions
await cache.invalidate('demo:*');
```

### Automatic Invalidation (TTL)

```typescript
// Entries automatically expire after TTL
await cache.set(key, value, 3600000); // Expires after 1 hour
```

### Event-Based Invalidation

```typescript
// Listen to cache events
const backend = cache.getBackend();
if (backend instanceof InMemoryCacheBackend) {
  backend.on((event) => {
    if (event.type === 'evict') {
      console.log(`Evicted: ${event.key}`);
    }
  });
}
```

## Metrics & Monitoring

### Cache Statistics

```typescript
const stats = await cache.stats();

console.log(`
  Hits: ${stats.hits}
  Misses: ${stats.misses}
  Hit Rate: ${(stats.hitRate * 100).toFixed(2)}%
  Size: ${stats.size} entries
  Memory: ${(stats.memoryUsage / 1024 / 1024).toFixed(2)} MB
  Sets: ${stats.sets}
  Deletes: ${stats.deletes}
  Evictions: ${stats.evictions}
`);
```

### Performance Tracking

```typescript
// Track cache performance
const start = performance.now();
const result = await cache.getOrCompute(key, async () => {
  return await expensiveOperation();
});
const duration = performance.now() - start;

console.log(`Operation took ${duration.toFixed(2)}ms`);
console.log(`Cache hit: ${result !== null}`);
```

## Configuration Options

### CacheOptions

```typescript
interface CacheOptions {
  /** Maximum number of entries (default: 1000) */
  maxSize?: number;
  /** Default TTL in milliseconds (default: 3600000 = 1 hour) */
  defaultTTL?: number;
  /** Enable metrics tracking (default: true) */
  enableMetrics?: boolean;
  /** Cleanup interval in milliseconds (default: 60000 = 1 minute) */
  cleanupInterval?: number;
  /** Redis connection URL (optional) */
  redisUrl?: string;
}
```

### RedisConfig

```typescript
interface RedisConfig {
  /** Redis connection URL */
  url: string;
  /** Key prefix */
  prefix?: string;
  /** TTL in seconds */
  ttl?: number;
  /** Max memory in bytes */
  maxMemory?: number;
  /** Retry strategy */
  retryStrategy?: (retries: number) => number | null;
}
```

## Best Practices

### 1. Cache Key Design

```typescript
// ✅ Good: Include content hash and options
const cacheKey = {
  contentHash: md5(fileContent),
  fileType: 'html',
  options: { /* conversion options */ }
};

// ❌ Bad: Include sensitive data
const cacheKey = {
  token: oauthToken, // Don't cache tokens!
  content: fileContent, // Too large
};
```

### 2. TTL Selection

```typescript
// Short TTL for frequently changing data
await cache.set(key, value, 300000); // 5 minutes

// Long TTL for stable data
await cache.set(key, value, 86400000); // 24 hours

// No TTL for permanent data
await cache.set(key, value, null);
```

### 3. Cache Warming

```typescript
// Pre-populate cache for common conversions
async function warmCache() {
  const commonDocs = ['doc1', 'doc2', 'doc3'];
  for (const docId of commonDocs) {
    await convertWithCache(docId, token);
  }
}
```

### 4. Cache Size Management

```typescript
// Monitor cache size
const stats = await cache.stats();
if (stats.size > 900) { // 90% of maxSize
  console.warn('Cache approaching capacity');
}

// Clear old entries if needed
if (stats.hitRate < 0.1) { // Low hit rate
  await cache.clear();
}
```

### 5. Error Handling

```typescript
try {
  const result = await cache.getOrCompute(key, async () => {
    return await convertFile(file);
  });
} catch (error) {
  // Cache failed, compute directly
  console.warn('Cache error, computing directly:', error);
  return await convertFile(file);
}
```

## Performance Characteristics

### In-Memory Cache

| Metric | Value |
|--------|-------|
| **Get Latency** | < 1ms |
| **Set Latency** | < 1ms |
| **Memory Overhead** | ~50 bytes per entry |
| **Max Entries** | ~1,000,000 (depends on RAM) |
| **Concurrent Access** | Single-threaded |

### Redis Cache

| Metric | Value |
|--------|-------|
| **Get Latency** | 1-5ms (network) |
| **Set Latency** | 1-5ms (network) |
| **Memory Overhead** | ~100 bytes per entry |
| **Max Entries** | Unlimited (depends on Redis) |
| **Concurrent Access** | Multi-threaded, shared |

## Troubleshooting

### Low Hit Rate

**Symptoms:** Hit rate < 50%

**Solutions:**
```typescript
// 1. Increase TTL for stable data
await cache.set(key, value, 86400000); // 24 hours

// 2. Increase cache size
const cache = createInMemoryCache({ maxSize: 5000 });

// 3. Check cache key consistency
console.log('Cache keys:', await cache.keys());
```

### Memory Issues

**Symptoms:** High memory usage, slow performance

**Solutions:**
```typescript
// 1. Reduce cache size
const cache = createInMemoryCache({ maxSize: 500 });

// 2. Use shorter TTL
const cache = createInMemoryCache({ defaultTTL: 1800000 }); // 30 min

// 3. Switch to Redis for production
const cache = await createRedisCache({ url: process.env.REDIS_URL });
```

### Redis Connection Issues

**Symptoms:** "Redis is not available" error

**Solutions:**
```typescript
// 1. Install ioredis
// npm install ioredis

// 2. Check Redis URL
console.log(process.env.REDIS_URL);

// 3. Test Redis connection
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);
await redis.ping(); // Should return 'PONG'
```

## Testing

### Unit Tests

```bash
npm test -- tests/unit/lib/cache/
```

### Integration Tests

```typescript
import { createInMemoryCache } from '@/lib/cache';

describe('Cache Manager', () => {
  let cache: CacheManager;

  beforeEach(async () => {
    cache = createInMemoryCache({ maxSize: 100 });
    await cache.clear();
  });

  afterEach(async () => {
    await cache.close();
  });

  test('should cache and retrieve values', async () => {
    await cache.set('key1', 'value1');
    const result = await cache.get('key1');
    expect(result).toBe('value1');
  });

  test('should return null for missing key', async () => {
    const result = await cache.get('missing');
    expect(result).toBeNull();
  });

  test('should respect TTL', async () => {
    await cache.set('key', 'value', 10); // 10ms TTL
    await new Promise(resolve => setTimeout(resolve, 20));
    const result = await cache.get('key');
    expect(result).toBeNull();
  });

  test('should track statistics', async () => {
    await cache.set('key1', 'value1');
    await cache.get('key1');
    await cache.get('missing');

    const stats = await cache.stats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe(0.5);
  });
});
```

## Environment Variables

```env
# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379

# Cache Configuration (optional)
CACHE_MAX_SIZE=1000
CACHE_DEFAULT_TTL=3600000
CACHE_ENABLE_METRICS=true
```

## API Reference

### CacheManager

| Method | Description |
|--------|-------------|
| `get(input, options)` | Get value from cache |
| `set(input, value, ttl, options)` | Set value in cache |
| `has(input, options)` | Check if value exists |
| `delete(input, options)` | Delete value from cache |
| `getOrCompute(input, fn, options)` | Get or compute value |
| `invalidate(pattern, options)` | Invalidate by pattern |
| `stats()` | Get cache statistics |
| `clear()` | Clear all entries |
| `close()` | Cleanup and close |

### InMemoryCacheBackend

| Method | Description |
|--------|-------------|
| `get(key)` | Get entry by key |
| `set(key, value, ttl)` | Set entry with key |
| `has(key)` | Check if key exists |
| `delete(key)` | Delete entry |
| `keys()` | Get all keys |
| `stats()` | Get statistics |
| `clear()` | Clear all |
| `close()` | Close backend |
| `on(listener)` | Add event listener |
| `off(listener)` | Remove event listener |

### RedisCacheBackend

| Method | Description |
|--------|-------------|
| `get(key)` | Get entry from Redis |
| `set(key, value, ttl)` | Set entry in Redis |
| `has(key)` | Check if key exists |
| `delete(key)` | Delete entry |
| `keys()` | Get all keys |
| `stats()` | Get statistics |
| `clear()` | Clear all |
| `close()` | Close connection |

## Related Files

- `lib/cache/types.ts` - Type definitions
- `lib/cache/cache-manager.ts` - Main implementation
- `lib/cache/index.ts` - Module exports
- `lib/markdown/pipeline/orchestrator.ts` - Pipeline integration
- `app/api/convert-demo/route.ts` - API integration

## Future Enhancements

### Planned Features

1. **Compression** - Compress cached values to save memory
2. **Persistent Storage** - File-based cache for offline use
3. **Cache Preloading** - Warm cache on startup
4. **Distributed Locking** - Prevent cache stampedes
5. **Cache Versioning** - Handle schema changes

### Performance Optimizations

1. **Pipeline Integration** - Cache at each stage
2. **Partial Caching** - Cache intermediate results
3. **Streaming Support** - Cache large files in chunks
4. **Compression** - Use gzip for large values

## References

- [Redis Documentation](https://redis.io/docs/)
- [ioredis Documentation](https://github.com/luin/ioredis)
- [Cache Patterns](https://docs.aws.amazon.com/whitepapers/latest/caching-strategies/cache-patterns.html)
