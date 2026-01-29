/**
 * Web Worker Wrapper for Main Thread
 *
 * Provides a clean API for communicating with the Web Worker
 * Handles worker lifecycle, message routing, and error recovery
 */

import {
  isWorkerMessage,             // 🟢 Imported as a value (Function)
  type WorkerMessage,          // 🔵 Imported as a type
  type WorkerConvertPayload,   // 🔵 Imported as a type
  type WorkerProgressPayload,  // 🔵 Imported as a type
  type WorkerResultPayload,    // 🔵 Imported as a type
  type WorkerErrorPayload,     // 🔵 Imported as a type
  type WorkerMessageType,      // 🔵 Imported as a type
} from './types/worker-messages';

// ============================================================================
// Types
// ============================================================================

export interface WorkerWrapperOptions {
  /** Called when progress updates are received */
  onProgress?: (progress: WorkerProgressPayload) => void;
  /** Called when conversion completes successfully */
  onResult?: (result: WorkerResultPayload) => void;
  /** Called when an error occurs */
  onError?: (error: WorkerErrorPayload) => void;
  /** Called when worker becomes ready */
  onReady?: () => void;
  /** Called when worker encounters an error */
  onWorkerError?: (error: Error) => void;
  /** Timeout in milliseconds (default: 60000) */
  timeout?: number;
}

export interface ConversionRequest {
  requestId: string;
  payload: WorkerConvertPayload;
  resolve: (result: WorkerResultPayload) => void;
  reject: (error: WorkerErrorPayload | Error) => void;
  timeoutId: NodeJS.Timeout;
}

// ============================================================================
// Worker Wrapper Class
// ============================================================================

export class WorkerWrapper {
  private worker: Worker | null = null;
  private isReady = false;
  private isDisposed = false;
  private pendingRequests: Map<string, ConversionRequest> = new Map();
  private options: WorkerWrapperOptions;
  private workerUrl: string;

  constructor(workerUrl: string, options: WorkerWrapperOptions = {}) {
    this.workerUrl = workerUrl;
    this.options = {
      timeout: 60000, // 60 seconds default
      ...options,
    };
  }

  /**
   * Initialize the worker
   */
  async init(): Promise<void> {
    if (this.isDisposed) {
      throw new Error('Worker wrapper has been disposed');
    }

    if (this.worker) {
      return; // Already initialized
    }

    return new Promise((resolve, reject) => {
      try {
        // Create worker using Next.js recommended pattern
        // This allows Next.js to bundle the worker file with all its imports
        // IMPORTANT: The constructor and URL must be one expression for Turbopack
        // to detect and bundle the worker file
        if (this.workerUrl === 'file-conversion-worker') {
          // ⬇️ CRITICAL: The constructor and URL must be contiguous
          this.worker = new Worker(
            new URL('./file-conversion-worker.ts', import.meta.url)
          );
        } else {
          // Fallback for testing or external URLs
          this.worker = new Worker(this.workerUrl);
        }

        // Set up message handler
        this.worker.onmessage = (event: MessageEvent) => {
          this.handleMessage(event.data);
        };

        // Set up error handler
        this.worker.onerror = (error: ErrorEvent) => {
          this.handleWorkerError(error);
        };

        // Set up message channel for ready signal
        const readyTimeout = setTimeout(() => {
          reject(new Error('Worker failed to initialize within timeout'));
        }, 5000);

        // Override onReady to resolve initialization
        const originalOnReady = this.options.onReady;
        this.options.onReady = () => {
          clearTimeout(readyTimeout);
          this.isReady = true;
          if (originalOnReady) {
            originalOnReady();
          }
          resolve();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Convert a file using the worker
   */
  async convert(payload: WorkerConvertPayload): Promise<WorkerResultPayload> {
    if (this.isDisposed) {
      throw new Error('Worker wrapper has been disposed');
    }

    if (!this.worker) {
      throw new Error('Worker not initialized. Call init() first.');
    }

    if (!this.isReady) {
      throw new Error('Worker not ready yet');
    }

    const requestId = this.generateRequestId();

    return new Promise<WorkerResultPayload>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Conversion timeout after ${this.options.timeout}ms`));
      }, this.options.timeout);

      const request: ConversionRequest = {
        requestId,
        payload,
        resolve,
        reject,
        timeoutId,
      };

      this.pendingRequests.set(requestId, request);

      const message: WorkerMessage<WorkerConvertPayload> = {
        type: 'CONVERT',
        payload,
        requestId,
        timestamp: Date.now(),
      };

      this.worker!.postMessage(message);
    });
  }

  /**
   * Cancel the current conversion
   */
  cancel(): void {
    if (!this.worker || this.isDisposed) {
      return;
    }

    const message: WorkerMessage = {
      type: 'CANCEL',
      timestamp: Date.now(),
    };

    this.worker.postMessage(message);

    // Reject all pending requests
    for (const [requestId, request] of this.pendingRequests.entries()) {
      clearTimeout(request.timeoutId);
      request.reject(new Error('Conversion cancelled'));
      this.pendingRequests.delete(requestId);
    }
  }

  /**
   * Check if worker is ready
   */
  isWorkerReady(): boolean {
    return this.isReady && !this.isDisposed;
  }

  /**
   * Check if worker is currently processing
   */
  isProcessing(): boolean {
    return this.pendingRequests.size > 0;
  }

  /**
   * Dispose of the worker and clean up resources
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;
    this.isReady = false;

    // Cancel any pending requests
    for (const [requestId, request] of this.pendingRequests.entries()) {
      clearTimeout(request.timeoutId);
      request.reject(new Error('Worker disposed'));
      this.pendingRequests.delete(requestId);
    }

    // Terminate the worker
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private handleMessage(data: unknown): void {
    if (!isWorkerMessage(data)) {
      console.warn('Received invalid message from worker:', data);
      return;
    }

    const message = data as WorkerMessage;

    switch (message.type) {
      case 'WORKER_READY':
        this.options.onReady?.();
        break;

      case 'PROGRESS':
        if (message.payload) {
          this.options.onProgress?.(message.payload as WorkerProgressPayload);
        }
        break;

      case 'RESULT':
        this.handleResult(message);
        break;

      case 'ERROR':
        this.handleError(message);
        break;

      case 'WORKER_ERROR':
        this.handleWorkerError(new ErrorEvent('workererror', { error: message.payload }));
        break;

      default:
        console.warn('Unknown message type from worker:', message.type);
    }
  }

  private handleResult(message: WorkerMessage): void {
    const requestId = message.requestId;
    if (!requestId) {
      console.warn('Result message without requestId');
      return;
    }

    const request = this.pendingRequests.get(requestId);
    if (!request) {
      console.warn(`No pending request found for requestId: ${requestId}`);
      return;
    }

    clearTimeout(request.timeoutId);
    this.pendingRequests.delete(requestId);

    if (message.payload) {
      request.resolve(message.payload as WorkerResultPayload);
    } else {
      request.reject(new Error('Result payload is empty'));
    }
  }

  private handleError(message: WorkerMessage): void {
    const requestId = message.requestId;
    if (!requestId) {
      console.warn('Error message without requestId');
      return;
    }

    const request = this.pendingRequests.get(requestId);
    if (!request) {
      console.warn(`No pending request found for requestId: ${requestId}`);
      return;
    }

    clearTimeout(request.timeoutId);
    this.pendingRequests.delete(requestId);

    if (message.payload) {
      const error = message.payload as WorkerErrorPayload;
      this.options.onError?.(error);
      request.reject(error);
    } else {
      request.reject(new Error('Unknown error from worker'));
    }
  }

  private handleWorkerError(error: ErrorEvent): void {
    console.error('Worker error:', error);

    // Reject all pending requests
    for (const [requestId, request] of this.pendingRequests.entries()) {
      clearTimeout(request.timeoutId);
      request.reject(new Error(`Worker error: ${error.message}`));
      this.pendingRequests.delete(requestId);
    }

    this.options.onWorkerError?.(new Error(error.message || 'Worker error'));

    // Mark worker as not ready
    this.isReady = false;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if Web Workers are supported in the current environment
 */
export function isWebWorkerSupported(): boolean {
  return typeof window !== 'undefined' && 'Worker' in window;
}

/**
 * Create a worker URL for the file conversion worker
 * This is needed for Next.js dynamic imports
 */
export function getFileConversionWorkerUrl(): string {
  // In Next.js with Turbopack, workers need special handling
  // Use the new URL() pattern which is the recommended approach
  // This allows Next.js to bundle the worker file with all its imports
  // Note: This function returns a string, but the actual URL is created
  // using new URL() in the init() method
  return 'file-conversion-worker';
}

/**
 * Create a worker wrapper instance for file conversion
 */
export async function createFileConversionWorker(
  options?: WorkerWrapperOptions
): Promise<WorkerWrapper> {
  if (!isWebWorkerSupported()) {
    throw new Error('Web Workers are not supported in this browser');
  }

  const workerUrl = getFileConversionWorkerUrl();
  const wrapper = new WorkerWrapper(workerUrl, options);
  await wrapper.init();
  return wrapper;
}

// ============================================================================
// Type Guards (re-exported for convenience)
// ============================================================================

export { isWorkerMessage } from './types/worker-messages';
