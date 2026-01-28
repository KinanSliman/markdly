/**
 * Retry logic with exponential backoff for transient failures
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

export interface RetryContext {
  attempt: number;
  error: Error;
  delay: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 8000, // 8 seconds
  backoffMultiplier: 2,
  retryableErrors: [
    "ECONNRESET",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "ENOTFOUND",
    "rate limit",
    "rate_limit",
    "ratelimit",
    "429",
    "500",
    "502",
    "503",
    "504",
    "timeout",
    "timeout_error",
    "network error",
    "socket hang up",
    "invalid_grant", // Google OAuth token refresh
    "Invalid Credentials", // Google API
  ],
};

/**
 * Checks if an error is retryable based on the error message or code
 */
function isRetryableError(error: Error, customRetryableErrors?: string[]): boolean {
  const errorMessage = error.message.toLowerCase();
  const errorName = error.name.toLowerCase();

  // Check against default retryable errors
  const isDefaultRetryable = DEFAULT_OPTIONS.retryableErrors.some((pattern) =>
    errorMessage.includes(pattern.toLowerCase()) || errorName.includes(pattern.toLowerCase())
  );

  // Check against custom retryable errors
  const isCustomRetryable = customRetryableErrors?.some((pattern) =>
    errorMessage.includes(pattern.toLowerCase()) || errorName.includes(pattern.toLowerCase())
  ) ?? false;

  return isDefaultRetryable || isCustomRetryable;
}

/**
 * Sleep for a given duration in milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes a function with retry logic and exponential backoff
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration
 * @param onRetry - Optional callback called before each retry
 * @returns The result of the successful function call
 *
 * @example
 * const result = await withRetry(
 *   () => fetchGoogleDoc(docId, token),
 *   { maxRetries: 3, initialDelay: 1000 }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
  onRetry?: (context: RetryContext) => Promise<void> | void
): Promise<T> {
  const {
    maxRetries,
    initialDelay,
    maxDelay,
    backoffMultiplier,
    retryableErrors,
  } = { ...DEFAULT_OPTIONS, ...options };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Attempt to execute the function
      return await fn();
    } catch (error) {
      // Check if we should retry
      if (attempt >= maxRetries || !isRetryableError(error as Error, retryableErrors)) {
        throw error;
      }

      lastError = error as Error;

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      );

      // Call onRetry callback if provided
      if (onRetry) {
        await onRetry({
          attempt: attempt + 1,
          error: lastError,
          delay,
        });
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript requires it
  throw lastError || new Error("Unknown error occurred");
}

/**
 * Executes multiple functions in parallel with individual retry logic
 *
 * @param fns - Array of async functions to execute
 * @param options - Retry configuration
 * @returns Array of results
 *
 * @example
 * const results = await withRetryAll(
 *   [() => fetchImage(url1), () => fetchImage(url2)],
 *   { maxRetries: 2 }
 * );
 */
export async function withRetryAll<T>(
  fns: Array<() => Promise<T>>,
  options: RetryOptions = {}
): Promise<T[]> {
  const promises = fns.map((fn) => withRetry(fn, options));
  return Promise.all(promises);
}
