/**
 * Token bucket rate limiter for API calls
 */

export interface RateLimitConfig {
  tokens: number; // Maximum number of tokens in the bucket
  refillInterval: number; // Time in milliseconds to refill tokens
  refillAmount: number; // Number of tokens to add per interval
}

export interface RateLimitState {
  tokens: number;
  lastRefill: number;
}

/**
 * Token bucket rate limiter implementation
 */
export class RateLimiter {
  private config: RateLimitConfig;
  private state: RateLimitState;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.state = {
      tokens: config.tokens,
      lastRefill: Date.now(),
    };
  }

  /**
   * Refills tokens based on elapsed time
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.state.lastRefill;

    if (elapsed >= this.config.refillInterval) {
      const intervals = Math.floor(elapsed / this.config.refillInterval);
      const tokensToAdd = intervals * this.config.refillAmount;

      this.state.tokens = Math.min(this.config.tokens, this.state.tokens + tokensToAdd);
      this.state.lastRefill = now;
    }
  }

  /**
   * Attempts to consume a token
   * Returns true if successful, false if no tokens available
   */
  tryConsume(): boolean {
    this.refillTokens();

    if (this.state.tokens >= 1) {
      this.state.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Waits until a token is available and consumes it
   */
  async consume(): Promise<void> {
    while (!this.tryConsume()) {
      // Calculate time until next token refill
      const now = Date.now();
      const timeSinceLastRefill = now - this.state.lastRefill;
      const timeUntilNextRefill = this.config.refillInterval - timeSinceLastRefill;

      // Wait for the next refill
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, timeUntilNextRefill)));
      this.refillTokens();
    }
  }

  /**
   * Gets the current number of available tokens
   */
  getAvailableTokens(): number {
    this.refillTokens();
    return this.state.tokens;
  }

  /**
   * Gets the time until the next token is available (in milliseconds)
   */
  getTimeUntilNextToken(): number {
    this.refillTokens();

    if (this.state.tokens >= 1) {
      return 0;
    }

    const now = Date.now();
    const timeSinceLastRefill = now - this.state.lastRefill;
    return Math.max(0, this.config.refillInterval - timeSinceLastRefill);
  }
}

/**
 * Pre-configured rate limiters for common APIs
 */

// Google Docs API: 300 requests per minute
export const GOOGLE_DOCS_RATE_LIMITER = new RateLimiter({
  tokens: 300,
  refillInterval: 60 * 1000, // 1 minute
  refillAmount: 300,
});

// GitHub API: 5000 requests per hour (for authenticated users)
export const GITHUB_RATE_LIMITER = new RateLimiter({
  tokens: 5000,
  refillInterval: 60 * 60 * 1000, // 1 hour
  refillAmount: 5000,
});

// Cloudinary API: 1000 requests per hour (free tier)
export const CLOUDINARY_RATE_LIMITER = new RateLimiter({
  tokens: 1000,
  refillInterval: 60 * 60 * 1000, // 1 hour
  refillAmount: 1000,
});

// Google Drive API: 1000 requests per 100 seconds
export const GOOGLE_DRIVE_RATE_LIMITER = new RateLimiter({
  tokens: 1000,
  refillInterval: 100 * 1000, // 100 seconds
  refillAmount: 1000,
});

/**
 * Executes a function with rate limiting
 *
 * @param fn - The async function to execute
 * @param limiter - The rate limiter to use
 * @returns The result of the function call
 *
 * @example
 * const result = await withRateLimit(
 *   () => fetchGoogleDoc(docId, token),
 *   GOOGLE_DOCS_RATE_LIMITER
 * );
 */
export async function withRateLimit<T>(
  fn: () => Promise<T>,
  limiter: RateLimiter
): Promise<T> {
  await limiter.consume();
  return fn();
}

/**
 * Executes multiple functions with rate limiting
 *
 * @param fns - Array of async functions to execute
 * @param limiter - The rate limiter to use
 * @returns Array of results
 *
 * @example
 * const results = await withRateLimitAll(
 *   [() => fetchImage(url1), () => fetchImage(url2)],
 *   GOOGLE_DRIVE_RATE_LIMITER
 * );
 */
export async function withRateLimitAll<T>(
  fns: Array<() => Promise<T>>,
  limiter: RateLimiter
): Promise<T[]> {
  const promises = fns.map((fn) => withRateLimit(fn, limiter));
  return Promise.all(promises);
}

// ============================================================================
// Per-key sliding-window limiter for API request abuse prevention
// ============================================================================

interface RequestBucket {
  hits: number[];
  lastSeen: number;
}

interface RequestRateLimitOptions {
  /** Maximum requests allowed within the window. */
  limit: number;
  /** Window duration in milliseconds. */
  windowMs: number;
  /** Maximum keys to track before evicting the oldest (LRU). */
  maxKeys?: number;
}

export interface RequestRateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

const requestBuckets = new Map<string, RequestBucket>();

/**
 * Sliding-window per-key request limiter for HTTP route handlers.
 *
 * Caveats: per-process state. On serverless / multi-instance deploys the
 * effective limit is multiplied by the number of warm instances. For
 * production-grade protection, swap in a Redis/Upstash backend.
 */
export function checkRequestRate(
  key: string,
  { limit, windowMs, maxKeys = 5000 }: RequestRateLimitOptions
): RequestRateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  let bucket = requestBuckets.get(key);
  if (!bucket) {
    bucket = { hits: [], lastSeen: now };
    requestBuckets.set(key, bucket);
  }

  bucket.hits = bucket.hits.filter((t) => t > cutoff);
  bucket.lastSeen = now;

  // Evict oldest key if we're tracking too many
  if (requestBuckets.size > maxKeys) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [k, v] of requestBuckets) {
      if (v.lastSeen < oldestTime) {
        oldestTime = v.lastSeen;
        oldestKey = k;
      }
    }
    if (oldestKey) requestBuckets.delete(oldestKey);
  }

  const exceeded = bucket.hits.length >= limit;
  if (!exceeded) bucket.hits.push(now);

  const oldest = bucket.hits[0] ?? now;
  const resetAt = oldest + windowMs;
  const retryAfterSeconds = Math.max(0, Math.ceil((resetAt - now) / 1000));

  return {
    success: !exceeded,
    remaining: Math.max(0, limit - bucket.hits.length),
    resetAt,
    retryAfterSeconds,
  };
}

/**
 * Best-effort client identifier from common proxy headers. Used as a
 * rate-limit key for unauthenticated public endpoints.
 */
export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;
  return "unknown";
}
