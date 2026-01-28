/**
 * Web Workers Module
 *
 * Exports Web Worker functionality for client-side file conversion
 */

// Types
export type {
  WorkerMessage,
  WorkerMessageType,
  WorkerConvertPayload,
  WorkerProgressPayload,
  WorkerResultPayload,
  WorkerErrorPayload,
} from './types/worker-messages';

// Type guards
export {
  isWorkerMessage,
  isConvertPayload,
  isProgressPayload,
  isResultPayload,
  isErrorPayload,
} from './types/worker-messages';

// Worker wrapper
export {
  WorkerWrapper,
  isWebWorkerSupported,
  getFileConversionWorkerUrl,
  createFileConversionWorker,
} from './worker-wrapper';

// Types
export type {
  WorkerWrapperOptions,
  ConversionRequest,
} from './worker-wrapper';
