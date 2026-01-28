/**
 * Cache Module Exports
 */

// Types
export type {
  CacheEntry,
  CacheOptions,
  CacheStats,
  CacheBackend,
  CacheKeyGenerator,
  CacheEvent,
  CacheEventType,
  InvalidationStrategy,
  RedisConfig,
  ConversionCacheKeyInput,
  CachedConversionResult,
} from './types';

// Classes and Functions
export {
  InMemoryCacheBackend,
  RedisCacheBackend,
  CacheManager,
  createInMemoryCache,
  createRedisCache,
  createCacheManager,
  defaultCacheKeyGenerator,
} from './cache-manager';

// Conversion-specific cache utilities
export {
  ConversionCacheManager,
  createInMemoryConversionCache,
  createRedisConversionCache,
  createConversionCache,
  generateFileCacheKey,
  generateGoogleDocCacheKey,
  generateDemoCacheKey,
  hashString,
} from './conversion-cache';
