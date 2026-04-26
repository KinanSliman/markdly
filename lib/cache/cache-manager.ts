/**
 * Cache Manager Implementation
 *
 * Provides caching functionality for conversion results with:
 * - In-memory cache (default, no external dependencies)
 * - Redis support (optional, for production)
 * - TTL-based expiration
 * - LRU eviction
 * - Metrics tracking
 * - Size limits
 */

import type {
  CacheEntry,
  CacheOptions,
  CacheStats,
  CacheBackend,
  CacheKeyGenerator,
  CacheEvent,
  CacheEventType,
  InvalidationStrategy,
  RedisConfig,
} from './types';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate hash from string (simple but effective for cache keys)
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Calculate approximate size of value in bytes
 */
function calculateSize(value: any): number {
  try {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    return new Blob([str]).size;
  } catch {
    return 0;
  }
}

/**
 * Default cache key generator
 */
export const defaultCacheKeyGenerator: CacheKeyGenerator = (
  input: any,
  options?: { prefix?: string; context?: Record<string, any> }
): string => {
  const prefix = options?.prefix || 'cache';
  const contextStr = options?.context ? JSON.stringify(options.context) : '';
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
  const hash = hashString(inputStr + contextStr);
  return `${prefix}:${hash}`;
};

// ============================================================================
// In-Memory Cache Backend
// ============================================================================

export class InMemoryCacheBackend implements CacheBackend {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private options: Required<CacheOptions>;
  private _stats: CacheStats;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private listeners: Array<(event: CacheEvent) => void> = [];

  constructor(options: CacheOptions = {}) {
    this.options = {
      maxSize: options.maxSize || 1000,
      defaultTTL: options.defaultTTL || 3600000, // 1 hour
      enableMetrics: options.enableMetrics !== false,
      cleanupInterval: options.cleanupInterval || 60000, // 1 minute
      redisUrl: options.redisUrl || '',
    };

    this._stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      size: 0,
      memoryUsage: 0,
      hitRate: 0,
    };

    // Start cleanup timer
    if (this.options.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(
        () => this.cleanup(),
        this.options.cleanupInterval
      );
    }
  }

  /**
   * Get value by key
   */
  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this._stats.misses++;
      this.emit('miss', key);
      return null;
    }

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this._stats.misses++;
      this.emit('miss', key);
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    this._stats.hits++;
    this.emit('hit', key);
    return entry;
  }

  /**
   * Set value with key
   */
  async set<T>(
    key: string,
    value: T,
    ttl: number | null = null
  ): Promise<void> {
    // Check if we need to evict entries
    if (this.cache.size >= this.options.maxSize) {
      this.evict();
    }

    const size = calculateSize(value);
    const expiresAt = ttl !== null ? Date.now() + ttl : null;

    const entry: CacheEntry<T> = {
      value,
      createdAt: Date.now(),
      expiresAt,
      size,
      accessCount: 0,
      lastAccessed: Date.now(),
    };

    this.cache.set(key, entry);

    this._stats.sets++;
    this._stats.size = this.cache.size;
    this._stats.memoryUsage += size;

    this.emit('set', key, value);
  }

  /**
   * Delete value by key
   */
  async delete(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (entry) {
      this._stats.memoryUsage -= entry.size;
    }

    const deleted = this.cache.delete(key);
    if (deleted) {
      this._stats.deletes++;
      this._stats.size = this.cache.size;
      this.emit('delete', key);
    }

    return deleted;
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check expiration
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this._stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      size: 0,
      memoryUsage: 0,
      hitRate: 0,
    };
    this.emit('clear');
  }

  /**
   * Get all keys
   */
  async keys(): Promise<string[]> {
    return Array.from(this.cache.keys());
  }

  /**
   * Get statistics
   */
  async stats(): Promise<CacheStats> {
    const total = this._stats.hits + this._stats.misses;
    return {
      ...this._stats,
      hitRate: total > 0 ? this._stats.hits / total : 0,
    };
  }

  /**
   * Close backend and cleanup
   */
  async close(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    await this.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Evict least recently used entry
   */
  private evict(): void {
    if (this.cache.size === 0) return;

    // Find least recently used entry
    let lruKey: string | null = null;
    let lruAccess = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruAccess) {
        lruAccess = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      const entry = this.cache.get(lruKey);
      if (entry) {
        this._stats.memoryUsage -= entry.size;
      }
      this.cache.delete(lruKey);
      this._stats.evictions++;
      this._stats.size = this.cache.size;
      this.emit('evict', lruKey);
    }
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      const entry = this.cache.get(key);
      if (entry) {
        this._stats.memoryUsage -= entry.size;
      }
      this.cache.delete(key);
      this._stats.size = this.cache.size;
      this.emit('evict', key);
    }
  }

  /**
   * Emit cache event
   */
  private emit(type: CacheEventType, key?: string, value?: any): void {
    if (!this.options.enableMetrics) return;

    const event: CacheEvent = {
      type,
      key,
      value,
      timestamp: Date.now(),
    };

    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /**
   * Add event listener
   */
  on(listener: (event: CacheEvent) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove event listener
   */
  off(listener: (event: CacheEvent) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }
}

// ============================================================================
// Redis Cache Backend (Optional)
// ============================================================================

export class RedisCacheBackend implements CacheBackend {
  private redis: any | null = null;
  private config: RedisConfig;
  private prefix: string;

  constructor(config: RedisConfig) {
    this.config = config;
    this.prefix = config.prefix || 'cache';
  }

  /**
   * Initialize Redis connection
   */
  private async init(): Promise<void> {
    if (this.redis) return;

    try {
      // Try to import ioredis (optional dependency, not installed by default)
      const Redis = await (new Function('m', 'return import(m)'))('ioredis');
      const RedisCtor = Redis.default || Redis;
      this.redis = new RedisCtor(this.config.url, {
        retryStrategy: this.config.retryStrategy,
      });
    } catch (error) {
      throw new Error(
        'Redis is not available. Install ioredis: npm install ioredis'
      );
    }
  }

  /**
   * Get value by key
   */
  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    await this.init();
    const fullKey = `${this.prefix}:${key}`;

    try {
      const data = await this.redis.get(fullKey);
      if (!data) return null;

      const entry: CacheEntry<T> = JSON.parse(data);

      // Check expiration
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        await this.redis.del(fullKey);
        return null;
      }

      return entry;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  /**
   * Set value with key
   */
  async set<T>(
    key: string,
    value: T,
    ttl: number | null = null
  ): Promise<void> {
    await this.init();
    const fullKey = `${this.prefix}:${key}`;

    const entry: CacheEntry<T> = {
      value,
      createdAt: Date.now(),
      expiresAt: ttl !== null ? Date.now() + ttl : null,
      size: calculateSize(value),
      accessCount: 0,
      lastAccessed: Date.now(),
    };

    try {
      const data = JSON.stringify(entry);
      if (ttl !== null) {
        await this.redis.setex(fullKey, Math.ceil(ttl / 1000), data);
      } else {
        await this.redis.set(fullKey, data);
      }
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  /**
   * Delete value by key
   */
  async delete(key: string): Promise<boolean> {
    await this.init();
    const fullKey = `${this.prefix}:${key}`;

    try {
      const result = await this.redis.del(fullKey);
      return result > 0;
    } catch (error) {
      console.error('Redis delete error:', error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    await this.init();
    const fullKey = `${this.prefix}:${key}`;

    try {
      const exists = await this.redis.exists(fullKey);
      return exists > 0;
    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    await this.init();

    try {
      const keys = await this.redis.keys(`${this.prefix}:*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Redis clear error:', error);
    }
  }

  /**
   * Get all keys
   */
  async keys(): Promise<string[]> {
    await this.init();

    try {
      const keys = await this.redis.keys(`${this.prefix}:*`);
      return keys.map((key: string) => key.substring(this.prefix.length + 1));
    } catch (error) {
      console.error('Redis keys error:', error);
      return [];
    }
  }

  /**
   * Get statistics
   */
  async stats(): Promise<CacheStats> {
    await this.init();

    try {
      const keys = await this.redis.keys(`${this.prefix}:*`);
      let memoryUsage = 0;

      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          memoryUsage += new Blob([data]).size;
        }
      }

      return {
        hits: 0, // Redis doesn't track this
        misses: 0,
        sets: 0,
        deletes: 0,
        evictions: 0,
        size: keys.length,
        memoryUsage,
        hitRate: 0,
      };
    } catch (error) {
      console.error('Redis stats error:', error);
      return {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        evictions: 0,
        size: 0,
        memoryUsage: 0,
        hitRate: 0,
      };
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}

// ============================================================================
// Cache Manager (Main Class)
// ============================================================================

export class CacheManager {
  private backend: CacheBackend;
  private keyGenerator: CacheKeyGenerator;
  private options: Required<CacheOptions>;
  private strategy: InvalidationStrategy;

  constructor(
    backend: CacheBackend,
    options: CacheOptions = {},
    keyGenerator: CacheKeyGenerator = defaultCacheKeyGenerator,
    strategy: InvalidationStrategy = 'ttl'
  ) {
    this.backend = backend;
    this.keyGenerator = keyGenerator;
    this.options = {
      maxSize: options.maxSize || 1000,
      defaultTTL: options.defaultTTL || 3600000,
      enableMetrics: options.enableMetrics !== false,
      cleanupInterval: options.cleanupInterval || 60000,
      redisUrl: options.redisUrl || '',
    };
    this.strategy = strategy;
  }

  /**
   * Get value from cache
   */
  async get<T>(
    input: any,
    options?: { prefix?: string; context?: Record<string, any> }
  ): Promise<T | null> {
    const key = this.keyGenerator(input, options);
    const entry = await this.backend.get<T>(key);

    if (!entry) return null;
    return entry.value;
  }

  /**
   * Set value in cache
   */
  async set<T>(
    input: any,
    value: T,
    ttl?: number | null,
    options?: { prefix?: string; context?: Record<string, any> }
  ): Promise<void> {
    const key = this.keyGenerator(input, options);
    const effectiveTTL = ttl !== undefined ? ttl : this.options.defaultTTL;
    await this.backend.set(key, value, effectiveTTL);
  }

  /**
   * Check if value exists in cache
   */
  async has(
    input: any,
    options?: { prefix?: string; context?: Record<string, any> }
  ): Promise<boolean> {
    const key = this.keyGenerator(input, options);
    return await this.backend.has(key);
  }

  /**
   * Delete value from cache
   */
  async delete(
    input: any,
    options?: { prefix?: string; context?: Record<string, any> }
  ): Promise<boolean> {
    const key = this.keyGenerator(input, options);
    return await this.backend.delete(key);
  }

  /**
   * Get or compute value (cache-aside pattern)
   */
  async getOrCompute<T>(
    input: any,
    computeFn: () => Promise<T>,
    options?: {
      prefix?: string;
      context?: Record<string, any>;
      ttl?: number;
    }
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(input, {
      prefix: options?.prefix,
      context: options?.context,
    });

    if (cached !== null) {
      return cached;
    }

    // Compute value
    const value = await computeFn();

    // Store in cache
    await this.set(
      input,
      value,
      options?.ttl,
      {
        prefix: options?.prefix,
        context: options?.context,
      }
    );

    return value;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    await this.backend.clear();
  }

  /**
   * Get cache statistics
   */
  async stats(): Promise<CacheStats> {
    return await this.backend.stats();
  }

  /**
   * Invalidate cache entries based on pattern
   */
  async invalidate(
    pattern: string,
    options?: { prefix?: string }
  ): Promise<number> {
    const prefix = options?.prefix || '';
    const fullPattern = prefix ? `${prefix}:${pattern}` : pattern;
    const keys = await this.backend.keys();

    let deleted = 0;
    for (const key of keys) {
      if (key.match(new RegExp(fullPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))) {
        if (await this.backend.delete(key)) {
          deleted++;
        }
      }
    }

    return deleted;
  }

  /**
   * Close cache manager and cleanup resources
   */
  async close(): Promise<void> {
    await this.backend.close();
  }

  /**
   * Get the underlying backend
   */
  getBackend(): CacheBackend {
    return this.backend;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create cache manager with in-memory backend
 */
export function createInMemoryCache(
  options: CacheOptions = {}
): CacheManager {
  const backend = new InMemoryCacheBackend(options);
  return new CacheManager(backend, options);
}

/**
 * Create cache manager with Redis backend
 */
export async function createRedisCache(
  config: RedisConfig,
  options: CacheOptions = {}
): Promise<CacheManager> {
  const backend = new RedisCacheBackend(config);
  return new CacheManager(backend, options);
}

/**
 * Create cache manager with auto-detection
 * Uses Redis if REDIS_URL is set, otherwise in-memory
 */
export async function createCacheManager(
  options: CacheOptions = {}
): Promise<CacheManager> {
  const redisUrl = process.env.REDIS_URL || options.redisUrl;

  if (redisUrl) {
    // Probe ioredis availability eagerly so we can fall back instead of
    // crashing on the first .get()/.set() call.
    try {
      await (new Function('m', 'return import(m)'))('ioredis');
      console.info('[cache] Using Redis backend (REDIS_URL configured)');
      return await createRedisCache(
        { url: redisUrl, prefix: 'markdly' },
        options
      );
    } catch (error) {
      console.warn(
        '[cache] REDIS_URL is set but ioredis is not installed — falling back to in-memory cache. Install ioredis to enable Redis.',
        error instanceof Error ? error.message : error
      );
      return createInMemoryCache(options);
    }
  }

  console.info('[cache] Using in-memory backend (no REDIS_URL set)');
  return createInMemoryCache(options);
}
