/**
 * Cache Type Definitions
 */

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T = any> {
  /** Cached value */
  value: T;
  /** Timestamp when entry was created */
  createdAt: number;
  /** Timestamp when entry will expire (ms) */
  expiresAt: number | null;
  /** Size in bytes (approximate) */
  size: number;
  /** Access count for LRU tracking */
  accessCount: number;
  /** Last access timestamp */
  lastAccessed: number;
}

/**
 * Cache configuration options
 */
export interface CacheOptions {
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

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total hits */
  hits: number;
  /** Total misses */
  misses: number;
  /** Total sets */
  sets: number;
  /** Total deletes */
  deletes: number;
  /** Total evictions */
  evictions: number;
  /** Current entry count */
  size: number;
  /** Total memory usage in bytes */
  memoryUsage: number;
  /** Hit rate (0-1) */
  hitRate: number;
}

/**
 * Cache key generation options
 */
export interface CacheKeyOptions {
  /** Prefix for the key */
  prefix?: string;
  /** Additional context for key generation */
  context?: Record<string, any>;
}

/**
 * Cache backend interface
 */
export interface CacheBackend {
  /** Get value by key */
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  /** Set value with key */
  set<T>(key: string, value: T, ttl?: number | null): Promise<void>;
  /** Delete value by key */
  delete(key: string): Promise<boolean>;
  /** Check if key exists */
  has(key: string): Promise<boolean>;
  /** Clear all entries */
  clear(): Promise<void>;
  /** Get all keys */
  keys(): Promise<string[]>;
  /** Get statistics */
  stats(): Promise<CacheStats>;
  /** Close backend connection */
  close(): Promise<void>;
}

/**
 * Cache key generator function
 */
export type CacheKeyGenerator = (
  input: any,
  options?: CacheKeyOptions
) => string;

/**
 * Cache invalidation strategy
 */
export type InvalidationStrategy =
  | 'ttl'           // Time-based expiration
  | 'manual'        // Manual invalidation
  | 'lru'           // Least recently used
  | 'lfu'           // Least frequently used
  | 'size'          // Size-based eviction;

/**
 * Cache event types
 */
export type CacheEventType =
  | 'hit'
  | 'miss'
  | 'set'
  | 'delete'
  | 'clear'
  | 'evict'
  | 'error';

/**
 * Cache event listener
 */
export interface CacheEvent {
  type: CacheEventType;
  key?: string;
  value?: any;
  timestamp: number;
  stats?: CacheStats;
}

/**
 * Redis cache configuration
 */
export interface RedisConfig {
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

/**
 * Conversion cache key input
 */
export interface ConversionCacheKeyInput {
  /** File content hash */
  contentHash: string;
  /** File type */
  fileType: string;
  /** Conversion options */
  options?: Record<string, any>;
}

/**
 * Cached conversion result
 */
export interface CachedConversionResult {
  /** Converted markdown content */
  content: string;
  /** Document metadata */
  metadata: {
    title: string;
    headings: Array<{ text: string; level: number }>;
    tables: number;
    images: number;
    warnings: Array<{
      type: string;
      message: string;
      suggestion?: string;
    }>;
  };
  /** Performance metrics */
  metrics: {
    totalTime: number;
    stages: Record<string, number>;
    cached: boolean;
  };
  /** Cache metadata */
  cacheInfo: {
    cachedAt: number;
    ttl: number;
    key: string;
  };
}
