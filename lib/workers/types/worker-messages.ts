/**
 * Web Worker Message Types
 * Defines the communication protocol between main thread and worker
 */

/**
 * Message types for worker communication
 */
export type WorkerMessageType =
  | 'CONVERT'           // Request conversion
  | 'PROGRESS'          // Progress update
  | 'RESULT'            // Conversion result
  | 'ERROR'             // Error occurred
  | 'CANCEL'            // Cancel conversion
  | 'WORKER_READY'      // Worker initialized
  | 'WORKER_ERROR';     // Worker initialization error

/**
 * Input data for conversion request
 */
export interface WorkerConvertPayload {
  /** File content as text or base64 */
  content: string;
  /** Original file name */
  fileName: string;
  /** File type: 'html', 'txt', 'rtf', 'docx' */
  fileType: 'html' | 'txt' | 'rtf' | 'docx';
  /** Optional: For DOCX, indicates if content is base64 encoded */
  isBase64?: boolean;
}

/**
 * Progress update data
 */
export interface WorkerProgressPayload {
  /** Current stage name */
  stage: string;
  /** Progress percentage (0-100) */
  progress: number;
  /** Human-readable message */
  message: string;
  /** Optional: Additional context */
  context?: Record<string, any>;
}

/**
 * Result data from conversion
 */
export interface WorkerResultPayload {
  /** Converted markdown content */
  content: string;
  /** Document title (from file name or content) */
  title: string;
  /** Extracted headings */
  headings: Array<{ text: string; level: number }>;
  /** Extracted tables count */
  tables: number;
  /** Extracted images count */
  images: number;
  /** Conversion warnings */
  warnings: Array<{
    type: string;
    message: string;
    suggestion?: string;
    context?: Record<string, any>;
  }>;
  /** Performance metrics */
  metrics: {
    totalTime: number;
    stages: Record<string, number>;
  };
}

/**
 * Error data
 */
export interface WorkerErrorPayload {
  /** Error type/code */
  code: string;
  /** Error message */
  message: string;
  /** Human-readable suggestion */
  suggestion?: string;
  /** Original error stack trace */
  stack?: string;
  /** Additional context */
  context?: Record<string, any>;
}

/**
 * Generic worker message
 */
export interface WorkerMessage<T = any> {
  /** Message type */
  type: WorkerMessageType;
  /** Message payload */
  payload?: T;
  /** Request ID for tracking */
  requestId?: string;
  /** Timestamp */
  timestamp?: number;
}

/**
 * Type guards for message validation
 */
export function isWorkerMessage(data: any): data is WorkerMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.type === 'string' &&
    ['CONVERT', 'PROGRESS', 'RESULT', 'ERROR', 'CANCEL', 'WORKER_READY', 'WORKER_ERROR'].includes(data.type)
  );
}

export function isConvertPayload(data: any): data is WorkerConvertPayload {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.content === 'string' &&
    typeof data.fileName === 'string' &&
    ['html', 'txt', 'rtf', 'docx'].includes(data.fileType)
  );
}

export function isProgressPayload(data: any): data is WorkerProgressPayload {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.stage === 'string' &&
    typeof data.progress === 'number' &&
    typeof data.message === 'string'
  );
}

export function isResultPayload(data: any): data is WorkerResultPayload {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.content === 'string' &&
    typeof data.title === 'string' &&
    Array.isArray(data.headings) &&
    typeof data.tables === 'number' &&
    typeof data.images === 'number' &&
    Array.isArray(data.warnings) &&
    typeof data.metrics === 'object'
  );
}

export function isErrorPayload(data: any): data is WorkerErrorPayload {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.code === 'string' &&
    typeof data.message === 'string'
  );
}
