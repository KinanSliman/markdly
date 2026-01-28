/**
 * Pipeline Types and Interfaces
 *
 * Defines the core types for the modular converter pipeline architecture.
 * Each stage in the pipeline has a clear input/output contract.
 */

import { ConversionWarning } from '../converter';

// ============================================================================
// Core Pipeline Types
// ============================================================================

export interface PipelineInput {
  /** Google Doc ID or URL */
  docId: string;
  /** Google OAuth access token */
  token: string;
  /** Whether token is an access token (true) or refresh token (false) */
  isAccessToken?: boolean;
  /** Cloudinary folder for image uploads */
  cloudinaryFolder?: string;
  /** Optional: pre-fetched document content (for testing/optimization) */
  documentContent?: any;
}

export interface PipelineOutput {
  /** Converted markdown content */
  content: string;
  /** Document metadata */
  metadata: PipelineMetadata;
  /** Conversion warnings */
  warnings: ConversionWarning[];
  /** Performance metrics */
  metrics: PipelineMetrics;
}

export interface PipelineMetadata {
  /** Document title from Google Docs */
  title: string;
  /** Number of paragraphs processed */
  paragraphCount: number;
  /** Number of tables found */
  tableCount: number;
  /** Number of images processed */
  imageCount: number;
  /** Number of code blocks detected */
  codeBlockCount: number;
  /** Number of headings found */
  headingCount: number;
  /** Total characters in output */
  characterCount: number;
  /** Timestamp of conversion */
  timestamp: number;
}

export interface PipelineMetrics {
  /** Total conversion time in ms */
  totalTime: number;
  /** Time spent fetching from Google Docs API */
  fetchTime: number;
  /** Time spent parsing document structure */
  parseTime: number;
  /** Time spent processing content */
  processTime: number;
  /** Time spent uploading images */
  imageUploadTime: number;
  /** Time spent formatting markdown */
  formatTime: number;
  /** Time spent validating output */
  validateTime: number;
  /** Cache hit/miss status */
  cacheHit?: boolean;
}

// ============================================================================
// Pipeline Context (shared state between stages)
// ============================================================================

export interface PipelineContext {
  /** Input data */
  input: PipelineInput;
  /** Current document content (Google Docs API format) */
  document?: any;
  /** Parsed paragraphs */
  paragraphs?: any[];
  /** Processed content blocks */
  contentBlocks?: ContentBlock[];
  /** Extracted images */
  images?: ImageData[];
  /** Final markdown content */
  markdown?: string;
  /** Warnings accumulated during processing */
  warnings: ConversionWarning[];
  /** Stage-specific data */
  stageData: Record<string, any>;
  /** Performance tracking */
  metrics: PipelineMetrics;
}

export interface ContentBlock {
  type: 'paragraph' | 'table' | 'image' | 'code' | 'heading' | 'list';
  content: string;
  metadata?: Record<string, any>;
}

export interface ImageData {
  /** Original Google Docs image ID */
  id: string;
  /** Image URL from Google Docs */
  url: string;
  /** Alt text */
  altText?: string;
  /** Upload result from Cloudinary */
  uploadResult?: {
    url: string;
    publicId: string;
  };
}

// ============================================================================
// Pipeline Stage Interface
// ============================================================================

export interface PipelineStage {
  /** Unique stage name */
  name: string;
  /** Stage description */
  description?: string;
  /** Execute the stage */
  execute(context: PipelineContext): Promise<PipelineContext>;
  /** Validate context before execution (optional) */
  validate?(context: PipelineContext): boolean | Promise<boolean>;
  /** Cleanup on error (optional) */
  cleanup?(context: PipelineContext): Promise<void>;
}

// ============================================================================
// Pipeline Configuration
// ============================================================================

export interface PipelineConfig {
  /** Stages to execute in order */
  stages: PipelineStage[];
  /** Whether to skip validation stages */
  skipValidation?: boolean;
  /** Whether to collect detailed metrics */
  collectMetrics?: boolean;
  /** Maximum time for entire pipeline (ms) */
  timeout?: number;
  /** Retry configuration for failed stages */
  retry?: {
    maxAttempts: number;
    backoffMs: number;
  };
}

// ============================================================================
// Error Types
// ============================================================================

export class PipelineError extends Error {
  constructor(
    message: string,
    public stage: string,
    public context: PipelineContext,
    public originalError?: Error
  ) {
    super(`[Pipeline:${stage}] ${message}`);
    this.name = 'PipelineError';
  }
}

export class StageValidationError extends PipelineError {
  constructor(stage: string, context: PipelineContext, reason: string) {
    super(`Validation failed: ${reason}`, stage, context);
    this.name = 'StageValidationError';
  }
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry {
  /** Cached data */
  data: PipelineOutput;
  /** Timestamp when cached */
  cachedAt: number;
  /** TTL in seconds */
  ttl: number;
  /** Source document modification time (for invalidation) */
  docModifiedTime?: string;
}

export interface CacheConfig {
  /** Time to live in seconds (default: 3600 = 1 hour) */
  ttl: number;
  /** Cache key prefix */
  prefix: string;
  /** Enable memory cache */
  memoryCache: boolean;
  /** Enable Redis cache */
  redisCache: boolean;
}

// ============================================================================
// Worker Message Types (for Web Workers)
// ============================================================================

export interface WorkerMessage {
  type: 'CONVERT' | 'PROGRESS' | 'RESULT' | 'ERROR' | 'CANCEL';
  payload?: any;
  requestId?: string;
}

export interface WorkerProgress {
  stage: string;
  progress: number;
  message: string;
}

// ============================================================================
// Performance Monitoring Types
// ============================================================================

export interface PerformanceReport {
  /** Pipeline execution summary */
  summary: {
    totalTime: number;
    success: boolean;
    cacheHit?: boolean;
  };
  /** Stage-by-stage breakdown */
  stages: Record<string, {
    time: number;
    success: boolean;
    error?: string;
  }>;
  /** Resource usage */
  resources: {
    memory?: number;
    cpu?: number;
  };
  /** Document statistics */
  document: {
    size: number;
    paragraphs: number;
    images: number;
    tables: number;
  };
}

// ============================================================================
// Export all types
// ============================================================================

export * from '../converter';
