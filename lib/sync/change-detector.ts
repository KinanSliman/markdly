/**
 * Change Detection System
 *
 * Detects changes in document content to skip unchanged sections
 * during sync operations, reducing API calls and GitHub noise.
 */

import { hashContent, hashGoogleDoc, hasContentChanged } from '@/lib/utils/hashing';

export interface ChangeDetectionResult {
  /** Whether the document has changed */
  hasChanged: boolean;
  /** Overall hash comparison */
  hashComparison: {
    oldHash: string | null;
    newHash: string;
    changed: boolean;
  };
  /** Change summary */
  summary: {
    /** Type of change detected */
    changeType: ChangeType;
    /** Confidence level (0-1) */
    confidence: number;
    /** Reason for change detection */
    reason: string;
  };
  /** Detailed change info */
  details: {
    /** Content size change (bytes) */
    sizeChange?: number;
    /** Percentage change (0-1) */
    percentageChange?: number;
    /** Sections that changed (for partial updates) */
    changedSections?: number[];
  };
}

export type ChangeType =
  | 'unchanged'        // No changes detected
  | 'modified'         // Content modified
  | 'title_changed'    // Only title changed
  | 'metadata_changed' // Only metadata changed
  | 'structure_changed' // Document structure changed (paragraphs, tables, images)
  | 'content_added'    // New content added
  | 'content_removed'  // Content removed
  | 'unknown';         // Cannot determine (first sync)

export interface ChangeDetectionOptions {
  /** Enable fuzzy matching for minor changes */
  fuzzyMatching?: boolean;
  /** Similarity threshold for fuzzy matching (0-1) */
  similarityThreshold?: number;
  /** Minimum content size change to consider (bytes) */
  minSizeChange?: number;
  /** Enable section-based comparison */
  sectionComparison?: boolean;
  /** Section size for comparison (characters) */
  sectionSize?: number;
}

const DEFAULT_OPTIONS: Required<ChangeDetectionOptions> = {
  fuzzyMatching: false,
  similarityThreshold: 0.95,
  minSizeChange: 100, // 100 bytes
  sectionComparison: false,
  sectionSize: 1000,
};

/**
 * Detect changes between old and new document content
 */
export function detectDocumentChanges(
  oldContent: string | null,
  newContent: string,
  oldMetadata: {
    title?: string;
    paragraphCount?: number;
    tableCount?: number;
    imageCount?: number;
    contentHash?: string;
  } | null,
  newMetadata: {
    title?: string;
    paragraphCount?: number;
    tableCount?: number;
    imageCount?: number;
  },
  docId: string,
  options: ChangeDetectionOptions = {}
): ChangeDetectionResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // First sync - no old content to compare
  if (!oldContent || !oldMetadata?.contentHash) {
    return {
      hasChanged: true,
      hashComparison: {
        oldHash: null,
        newHash: hashGoogleDoc(docId, newContent, newMetadata),
        changed: true,
      },
      summary: {
        changeType: 'unknown',
        confidence: 1.0,
        reason: 'First sync - no previous content to compare',
      },
      details: {
        sizeChange: newContent.length,
        percentageChange: 1.0,
      },
    };
  }

  // Generate hashes for comparison
  const oldHash = oldMetadata.contentHash;
  const newHash = hashGoogleDoc(docId, newContent, newMetadata);

  // Check if content hash changed
  const contentChanged = hasContentChanged(oldHash, newHash);

  if (!contentChanged) {
    return {
      hasChanged: false,
      hashComparison: {
        oldHash,
        newHash,
        changed: false,
      },
      summary: {
        changeType: 'unchanged',
        confidence: 1.0,
        reason: 'Content hash matches exactly',
      },
      details: {},
    };
  }

  // Content has changed - analyze the type of change
  const sizeChange = newContent.length - oldContent.length;
  const percentageChange = oldContent.length > 0
    ? Math.abs(sizeChange) / oldContent.length
    : 1.0;

  // Check for title-only change
  const titleChanged = oldMetadata.title !== newMetadata.title;
  const structureChanged =
    oldMetadata.paragraphCount !== newMetadata.paragraphCount ||
    oldMetadata.tableCount !== newMetadata.tableCount ||
    oldMetadata.imageCount !== newMetadata.imageCount;

  // Determine change type
  let changeType: ChangeType = 'modified';
  let reason = 'Content hash differs';

  if (titleChanged && !structureChanged && percentageChange < 0.01) {
    changeType = 'title_changed';
    reason = 'Only title changed (minor change)';
  } else if (structureChanged && !titleChanged && percentageChange < 0.05) {
    changeType = 'structure_changed';
    reason = 'Document structure changed (paragraphs, tables, or images)';
  } else if (sizeChange > opts.minSizeChange && percentageChange > 0.1) {
    changeType = sizeChange > 0 ? 'content_added' : 'content_removed';
    reason = `Content ${sizeChange > 0 ? 'added' : 'removed'} (${Math.abs(sizeChange)} bytes)`;
  } else if (titleChanged && structureChanged) {
    changeType = 'modified';
    reason = 'Title and structure both changed';
  }

  // Fuzzy matching for minor changes
  let confidence = 0.95;
  if (opts.fuzzyMatching) {
    const similarity = calculateContentSimilarity(oldContent, newContent);
    if (similarity > opts.similarityThreshold) {
      changeType = 'modified';
      reason = `Minor changes detected (similarity: ${(similarity * 100).toFixed(1)}%)`;
      confidence = similarity;
    }
  }

  return {
    hasChanged: true,
    hashComparison: {
      oldHash,
      newHash,
      changed: true,
    },
    summary: {
      changeType,
      confidence,
      reason,
    },
    details: {
      sizeChange,
      percentageChange,
    },
  };
}

/**
 * Detect changes in sync history entries
 */
export function detectSyncChanges(
  oldContent: string | null,
  newContent: string,
  oldHash: string | null,
  options: ChangeDetectionOptions = {}
): ChangeDetectionResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // First sync
  if (!oldContent || !oldHash) {
    return {
      hasChanged: true,
      hashComparison: {
        oldHash: null,
        newHash: hashContent(newContent),
        changed: true,
      },
      summary: {
        changeType: 'unknown',
        confidence: 1.0,
        reason: 'First sync - no previous content',
      },
      details: {
        sizeChange: newContent.length,
        percentageChange: 1.0,
      },
    };
  }

  const newHash = hashContent(newContent);
  const contentChanged = hasContentChanged(oldHash, newHash);

  if (!contentChanged) {
    return {
      hasChanged: false,
      hashComparison: {
        oldHash,
        newHash,
        changed: false,
      },
      summary: {
        changeType: 'unchanged',
        confidence: 1.0,
        reason: 'Content hash matches exactly',
      },
      details: {},
    };
  }

  const sizeChange = newContent.length - oldContent.length;
  const percentageChange = oldContent.length > 0
    ? Math.abs(sizeChange) / oldContent.length
    : 1.0;

  let changeType: ChangeType = 'modified';
  let reason = 'Content has changed';

  if (sizeChange > opts.minSizeChange) {
    changeType = sizeChange > 0 ? 'content_added' : 'content_removed';
    reason = `Content ${sizeChange > 0 ? 'added' : 'removed'} (${Math.abs(sizeChange)} bytes)`;
  }

  return {
    hasChanged: true,
    hashComparison: {
      oldHash,
      newHash,
      changed: true,
    },
    summary: {
      changeType,
      confidence: 0.95,
      reason,
    },
    details: {
      sizeChange,
      percentageChange,
    },
  };
}

/**
 * Calculate content similarity using simple ratio
 */
function calculateContentSimilarity(oldContent: string, newContent: string): number {
  if (oldContent === newContent) return 1.0;

  const longer = oldContent.length > newContent.length ? oldContent : newContent;
  const shorter = oldContent.length > newContent.length ? newContent : oldContent;

  if (longer.length === 0) return 1.0;

  // Simple similarity based on common prefix/suffix
  const prefixLength = getCommonPrefixLength(oldContent, newContent);
  const suffixLength = getCommonSuffixLength(oldContent, newContent);

  const commonLength = prefixLength + suffixLength;
  const similarity = commonLength / longer.length;

  return Math.min(similarity, 1.0);
}

/**
 * Get length of common prefix
 */
function getCommonPrefixLength(str1: string, str2: string): number {
  let i = 0;
  while (i < str1.length && i < str2.length && str1[i] === str2[i]) {
    i++;
  }
  return i;
}

/**
 * Get length of common suffix
 */
function getCommonSuffixLength(str1: string, str2: string): number {
  let i = 0;
  while (
    i < str1.length &&
    i < str2.length &&
    str1[str1.length - 1 - i] === str2[str2.length - 1 - i]
  ) {
    i++;
  }
  return i;
}

/**
 * Check if sync should be skipped based on change detection
 */
export function shouldSkipSync(
  changeResult: ChangeDetectionResult,
  options: {
    skipUnchanged?: boolean;
    skipMinorChanges?: boolean;
    minConfidence?: number;
  } = {}
): boolean {
  const {
    skipUnchanged = true,
    skipMinorChanges = false,
    minConfidence = 0.8,
  } = options;

  // Always sync if content has changed
  if (!changeResult.hasChanged) {
    return skipUnchanged;
  }

  // Check confidence level
  if (changeResult.summary.confidence < minConfidence) {
    return false; // Low confidence - sync to be safe
  }

  // Skip minor changes if configured
  if (skipMinorChanges) {
    const minorChangeTypes: ChangeType[] = ['title_changed', 'metadata_changed'];
    if (minorChangeTypes.includes(changeResult.summary.changeType)) {
      return true;
    }
  }

  return false;
}

/**
 * Get human-readable change description
 */
export function getChangeDescription(result: ChangeDetectionResult): string {
  if (!result.hasChanged) {
    return 'No changes detected - sync skipped';
  }

  const { changeType, reason } = result.summary;

  switch (changeType) {
    case 'unchanged':
      return 'Content unchanged';
    case 'title_changed':
      return `Title changed: ${reason}`;
    case 'structure_changed':
      return `Structure changed: ${reason}`;
    case 'content_added':
      return `Content added: ${reason}`;
    case 'content_removed':
      return `Content removed: ${reason}`;
    case 'modified':
      return `Content modified: ${reason}`;
    default:
      return reason;
  }
}
