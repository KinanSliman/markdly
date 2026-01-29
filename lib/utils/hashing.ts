/**
 * Content Hashing Utilities
 *
 * Provides content-based hashing for change detection.
 * Uses SHA-256 for cryptographic hashing of document content.
 */

import { createHash } from 'crypto';

/**
 * Generate a SHA-256 hash of the given content
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Generate a hash from multiple content parts
 * Useful for hashing document structure with metadata
 */
export function hashContentParts(parts: Record<string, string | number>): string {
  const normalized = Object.keys(parts)
    .sort()
    .map((key) => `${key}:${parts[key]}`)
    .join('|');
  return hashContent(normalized);
}

/**
 * Generate a hash for a Google Doc
 * Includes document content and metadata
 */
export function hashGoogleDoc(
  docId: string,
  content: string,
  metadata?: {
    title?: string;
    paragraphCount?: number;
    tableCount?: number;
    imageCount?: number;
  }
): string {
  const parts: Record<string, string | number> = {
    docId,
    content: content.substring(0, 10000), // Use first 10k chars for performance
  };

  if (metadata) {
    if (metadata.title) parts.title = metadata.title;
    if (metadata.paragraphCount) parts.paragraphCount = metadata.paragraphCount;
    if (metadata.tableCount) parts.tableCount = metadata.tableCount;
    if (metadata.imageCount) parts.imageCount = metadata.imageCount;
  }

  return hashContentParts(parts);
}

/**
 * Generate a hash for a file
 * Includes file content and type
 */
export function hashFile(
  content: string,
  fileType: string,
  fileName?: string
): string {
  const parts: Record<string, string> = {
    content: content.substring(0, 10000), // Use first 10k chars for performance
    fileType,
  };

  if (fileName) {
    parts.fileName = fileName;
  }

  return hashContentParts(parts);
}

/**
 * Compare two hashes to check if content has changed
 */
export function hasContentChanged(oldHash: string | null, newHash: string): boolean {
  if (!oldHash) return true;
  return oldHash !== newHash;
}

/**
 * Generate a diff-friendly hash for partial content comparison
 * Creates hashes for individual sections that can be compared separately
 */
export function hashContentSections(content: string, sectionSize: number = 1000): Record<number, string> {
  const sections: Record<number, string> = {};
  const numSections = Math.ceil(content.length / sectionSize);

  for (let i = 0; i < numSections; i++) {
    const start = i * sectionSize;
    const end = Math.min(start + sectionSize, content.length);
    const section = content.substring(start, end);
    sections[i] = hashContent(section);
  }

  return sections;
}

/**
 * Compare section hashes to identify which sections have changed
 */
export function getChangedSections(
  oldSections: Record<number, string> | null,
  newSections: Record<number, string>
): number[] {
  if (!oldSections) return Object.keys(newSections).map(Number);

  const changed: number[] = [];
  for (const [index, hash] of Object.entries(newSections)) {
    const idx = Number(index);
    if (oldSections[idx] !== hash) {
      changed.push(idx);
    }
  }
  return changed;
}

/**
 * Generate a short, human-readable hash (first 8 characters)
 */
export function shortHash(hash: string): string {
  return hash.substring(0, 8);
}

/**
 * Check if two strings are similar (for fuzzy change detection)
 * Uses Levenshtein distance approximation
 */
export function areStringsSimilar(
  str1: string,
  str2: string,
  threshold: number = 0.95
): boolean {
  if (str1 === str2) return true;

  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return true;

  // Simple similarity based on common substring ratio
  const editDistance = levenshteinDistance(longer, shorter);
  const similarity = 1 - editDistance / longer.length;

  return similarity >= threshold;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}
