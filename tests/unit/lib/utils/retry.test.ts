/**
 * Unit tests for retry utility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retry, RetryError } from '@/lib/utils/retry';

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should succeed on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await retry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('First attempt failed'))
      .mockRejectedValueOnce(new Error('Second attempt failed'))
      .mockResolvedValue('success on third');

    const promise = retry(fn, { maxAttempts: 3, backoffMs: 100 });

    // Advance time for first retry
    await vi.advanceTimersByTimeAsync(100);
    // Advance time for second retry
    await vi.advanceTimersByTimeAsync(200);

    const result = await promise;

    expect(result).toBe('success on third');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max attempts exceeded', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Always fails'));

    const promise = retry(fn, { maxAttempts: 3, backoffMs: 100 });

    // Advance time for all retries
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);
    await vi.advanceTimersByTimeAsync(400);

    await expect(promise).rejects.toThrow(RetryError);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should use exponential backoff', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Attempt 1'))
      .mockRejectedValueOnce(new Error('Attempt 2'))
      .mockResolvedValue('success');

    const promise = retry(fn, { maxAttempts: 3, backoffMs: 100 });

    // First retry after 100ms
    await vi.advanceTimersByTimeAsync(100);
    expect(fn).toHaveBeenCalledTimes(2);

    // Second retry after 200ms (100 * 2)
    await vi.advanceTimersByTimeAsync(200);
    expect(fn).toHaveBeenCalledTimes(3);

    const result = await promise;
    expect(result).toBe('success');
  });

  it('should retry only on specified error types', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue('success');

    const promise = retry(fn, {
      maxAttempts: 3,
      backoffMs: 100,
      retryableErrors: ['Network error'],
    });

    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should not retry on non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Fatal error'));

    const promise = retry(fn, {
      maxAttempts: 3,
      backoffMs: 100,
      retryableErrors: ['Network error'], // Only retry network errors
    });

    await expect(promise).rejects.toThrow('Fatal error');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should handle async functions', async () => {
    const fn = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return 'async success';
    });

    const result = await retry(fn);
    expect(result).toBe('async success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should pass arguments to the function', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    await retry(fn, {}, 'arg1', 'arg2');

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });
});

describe('RetryError', () => {
  it('should create error with correct properties', () => {
    const originalError = new Error('Original error');
    const retryError = new RetryError('Failed after 3 attempts', 3, originalError);

    expect(retryError.message).toBe('Failed after 3 attempts');
    expect(retryError.attempts).toBe(3);
    expect(retryError.cause).toBe(originalError);
    expect(retryError.name).toBe('RetryError');
  });
});
