/**
 * Conversion-Specific Cache Utilities
 *
 * Provides cache key generation and management for conversion operations
 */

import type { ConversionCacheKeyInput, CachedConversionResult } from './types';
import { defaultCacheKeyGenerator } from './cache-manager';
import type { CacheManager } from './cache-manager';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate MD5-like hash from string (simple but effective)
 */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate cache key for file content
 */
export function generateFileCacheKey(
  content: string,
  fileType: string,
  options?: Record<string, any>
): string {
  // Hash the content (first 10KB for performance)
  const contentToHash = content.length > 10000 ? content.substring(0, 10000) : content;
  const contentHash = hashString(contentToHash);

  const cacheInput: ConversionCacheKeyInput = {
    contentHash,
    fileType,
    options,
  };

  return defaultCacheKeyGenerator(cacheInput, { prefix: 'file-conversion' });
}

/**
 * Generate cache key for Google Doc conversion
 */
export function generateGoogleDocCacheKey(
  docId: string,
  timestampBucket: number = 1, // 1 hour buckets
  options?: Record<string, any>
): string {
  const cacheInput = {
    docId,
    timestampBucket,
    options,
  };

  return defaultCacheKeyGenerator(cacheInput, { prefix: 'google-doc' });
}

/**
 * Generate cache key for API demo conversions
 */
export function generateDemoCacheKey(
  input: string,
  options?: Record<string, any>
): string {
  const cacheInput = {
    input,
    options,
  };

  return defaultCacheKeyGenerator(cacheInput, { prefix: 'demo' });
}

// ============================================================================
// Cache Manager with Conversion Helpers
// ============================================================================

export class ConversionCacheManager {
  private cache: CacheManager;

  constructor(cache: CacheManager) {
    this.cache = cache;
  }

  /**
   * Get cached file conversion result
   */
  async getFileConversion(
    content: string,
    fileType: string,
    options?: Record<string, any>
  ): Promise<CachedConversionResult | null> {
    const key = generateFileCacheKey(content, fileType, options);
    return await this.cache.get<CachedConversionResult>(key, { prefix: 'file-conversion' });
  }

  /**
   * Set cached file conversion result
   */
  async setFileConversion(
    content: string,
    fileType: string,
    result: CachedConversionResult,
    ttl?: number
  ): Promise<void> {
    const key = generateFileCacheKey(content, fileType);
    await this.cache.set(key, result, ttl, { prefix: 'file-conversion' });
  }

  /**
   * Check if file conversion is cached
   */
  async hasFileConversion(
    content: string,
    fileType: string,
    options?: Record<string, any>
  ): Promise<boolean> {
    const key = generateFileCacheKey(content, fileType, options);
    return await this.cache.has(key, { prefix: 'file-conversion' });
  }

  /**
   * Delete cached file conversion
   */
  async deleteFileConversion(
    content: string,
    fileType: string,
    options?: Record<string, any>
  ): Promise<boolean> {
    const key = generateFileCacheKey(content, fileType, options);
    return await this.cache.delete(key, { prefix: 'file-conversion' });
  }

  /**
   * Get or compute file conversion
   */
  async getFileConversionOrCompute(
    content: string,
    fileType: string,
    computeFn: () => Promise<CachedConversionResult>,
    options?: {
      ttl?: number;
      computeOptions?: Record<string, any>;
    }
  ): Promise<CachedConversionResult> {
    const cacheKey = generateFileCacheKey(
      content,
      fileType,
      options?.computeOptions
    );

    return await this.cache.getOrCompute(
      cacheKey,
      computeFn,
      {
        prefix: 'file-conversion',
        ttl: options?.ttl,
      }
    );
  }

  /**
   * Get cached Google Doc conversion
   */
  async getGoogleDocConversion(
    docId: string,
    options?: Record<string, any>
  ): Promise<CachedConversionResult | null> {
    // Use hourly buckets to allow for document updates
    const timestampBucket = Math.floor(Date.now() / 3600000);
    const key = generateGoogleDocCacheKey(docId, timestampBucket, options);
    return await this.cache.get<CachedConversionResult>(key, { prefix: 'google-doc' });
  }

  /**
   * Set cached Google Doc conversion
   */
  async setGoogleDocConversion(
    docId: string,
    result: CachedConversionResult,
    ttl?: number
  ): Promise<void> {
    const timestampBucket = Math.floor(Date.now() / 3600000);
    const key = generateGoogleDocCacheKey(docId, timestampBucket);
    await this.cache.set(key, result, ttl, { prefix: 'google-doc' });
  }

  /**
   * Invalidate all Google Doc conversions for a specific document
   */
  async invalidateGoogleDoc(docId: string): Promise<number> {
    return await this.cache.invalidate(`*${docId}*`, { prefix: 'google-doc' });
  }

  /**
   * Invalidate all file conversions
   */
  async invalidateAllFileConversions(): Promise<number> {
    return await this.cache.invalidate('*', { prefix: 'file-conversion' });
  }

  /**
   * Invalidate all demo conversions
   */
  async invalidateAllDemoConversions(): Promise<number> {
    return await this.cache.invalidate('*', { prefix: 'demo' });
  }

  /**
   * Get cache statistics
   */
  async stats() {
    return await this.cache.stats();
  }

  /**
   * Clear all conversion caches
   */
  async clear(): Promise<void> {
    await this.cache.clear();
  }

  /**
   * Close cache manager
   */
  async close(): Promise<void> {
    await this.cache.close();
  }

  /**
   * Get the underlying cache manager
   */
  getCacheManager(): CacheManager {
    return this.cache;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

import { createInMemoryCache, createRedisCache, createCacheManager } from './cache-manager';

/**
 * Create conversion cache with in-memory backend
 */
export function createInMemoryConversionCache(
  options?: Parameters<typeof createInMemoryCache>[0]
): ConversionCacheManager {
  const cache = createInMemoryCache(options);
  return new ConversionCacheManager(cache);
}

/**
 * Create conversion cache with Redis backend
 */
export async function createRedisConversionCache(
  config: Parameters<typeof createRedisCache>[0],
  options?: Parameters<typeof createRedisCache>[1]
): Promise<ConversionCacheManager> {
  const cache = await createRedisCache(config, options);
  return new ConversionCacheManager(cache);
}

/**
 * Create conversion cache with auto-detection
 */
export async function createConversionCache(
  options?: Parameters<typeof createCacheManager>[0]
): Promise<ConversionCacheManager> {
  const cache = await createCacheManager(options);
  return new ConversionCacheManager(cache);
}
