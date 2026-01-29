/**
 * Tests for hashing utilities
 */

import { describe, it, expect } from 'vitest';
import {
  hashContent,
  hashContentParts,
  hashGoogleDoc,
  hashFile,
  hasContentChanged,
  hashContentSections,
  getChangedSections,
  shortHash,
  areStringsSimilar,
} from '@/lib/utils/hashing';

describe('hashContent', () => {
  it('should generate consistent hash for same content', () => {
    const content = 'Hello, World!';
    const hash1 = hashContent(content);
    const hash2 = hashContent(content);
    expect(hash1).toBe(hash2);
  });

  it('should generate different hashes for different content', () => {
    const hash1 = hashContent('Hello, World!');
    const hash2 = hashContent('Hello, World');
    expect(hash1).not.toBe(hash2);
  });

  it('should generate SHA-256 hash (64 characters)', () => {
    const hash = hashContent('test');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('hashContentParts', () => {
  it('should generate consistent hash regardless of object key order', () => {
    const parts1 = { a: '1', b: '2', c: '3' };
    const parts2 = { c: '3', b: '2', a: '1' };
    const hash1 = hashContentParts(parts1);
    const hash2 = hashContentParts(parts2);
    expect(hash1).toBe(hash2);
  });

  it('should generate different hashes for different parts', () => {
    const hash1 = hashContentParts({ a: '1', b: '2' });
    const hash2 = hashContentParts({ a: '1', b: '3' });
    expect(hash1).not.toBe(hash2);
  });
});

describe('hashGoogleDoc', () => {
  it('should generate consistent hash for same document', () => {
    const docId = '123abc';
    const content = 'Document content';
    const metadata = { title: 'Test Doc', paragraphCount: 5 };

    const hash1 = hashGoogleDoc(docId, content, metadata);
    const hash2 = hashGoogleDoc(docId, content, metadata);
    expect(hash1).toBe(hash2);
  });

  it('should generate different hash for different content', () => {
    const docId = '123abc';
    const content1 = 'Document content 1';
    const content2 = 'Document content 2';

    const hash1 = hashGoogleDoc(docId, content1);
    const hash2 = hashGoogleDoc(docId, content2);
    expect(hash1).not.toBe(hash2);
  });

  it('should work without metadata', () => {
    const hash = hashGoogleDoc('123', 'content');
    expect(hash).toHaveLength(64);
  });
});

describe('hashFile', () => {
  it('should generate consistent hash for same file', () => {
    const content = 'File content';
    const fileType = 'html';

    const hash1 = hashFile(content, fileType);
    const hash2 = hashFile(content, fileType);
    expect(hash1).toBe(hash2);
  });

  it('should include file name in hash', () => {
    const hash1 = hashFile('content', 'html', 'file1.html');
    const hash2 = hashFile('content', 'html', 'file2.html');
    expect(hash1).not.toBe(hash2);
  });
});

describe('hasContentChanged', () => {
  it('should return true when old hash is null', () => {
    expect(hasContentChanged(null, 'new-hash')).toBe(true);
  });

  it('should return true when hashes differ', () => {
    expect(hasContentChanged('old-hash', 'new-hash')).toBe(true);
  });

  it('should return false when hashes are the same', () => {
    expect(hasContentChanged('same-hash', 'same-hash')).toBe(false);
  });
});

describe('hashContentSections', () => {
  it('should create sections of specified size', () => {
    const content = 'a'.repeat(2500);
    const sections = hashContentSections(content, 1000);
    expect(Object.keys(sections)).toHaveLength(3); // 3 sections: 1000, 1000, 500
  });

  it('should generate consistent section hashes', () => {
    const content = 'Test content for sections';
    const sections1 = hashContentSections(content, 10);
    const sections2 = hashContentSections(content, 10);
    expect(sections1).toEqual(sections2);
  });

  it('should handle empty content', () => {
    const sections = hashContentSections('', 100);
    expect(Object.keys(sections)).toHaveLength(0);
  });
});

describe('getChangedSections', () => {
  it('should return all sections when old sections is null', () => {
    const newSections = { 0: 'hash1', 1: 'hash2', 2: 'hash3' };
    const changed = getChangedSections(null, newSections);
    expect(changed).toEqual([0, 1, 2]);
  });

  it('should return only changed section indices', () => {
    const oldSections = { 0: 'hash1', 1: 'hash2', 2: 'hash3' };
    const newSections = { 0: 'hash1', 1: 'hash2-changed', 2: 'hash3' };
    const changed = getChangedSections(oldSections, newSections);
    expect(changed).toEqual([1]);
  });

  it('should return empty array when no changes', () => {
    const oldSections = { 0: 'hash1', 1: 'hash2' };
    const newSections = { 0: 'hash1', 1: 'hash2' };
    const changed = getChangedSections(oldSections, newSections);
    expect(changed).toEqual([]);
  });
});

describe('shortHash', () => {
  it('should return first 8 characters of hash', () => {
    const fullHash = 'abcdef1234567890';
    const short = shortHash(fullHash);
    expect(short).toBe('abcdef12');
  });

  it('should handle hash shorter than 8 characters', () => {
    const short = shortHash('abc');
    expect(short).toBe('abc');
  });
});

describe('areStringsSimilar', () => {
  it('should return true for identical strings', () => {
    expect(areStringsSimilar('test', 'test')).toBe(true);
  });

  it('should return true for very similar strings', () => {
    expect(areStringsSimilar('Hello World', 'Hello World!')).toBe(true);
  });

  it('should return false for very different strings', () => {
    expect(areStringsSimilar('Hello', 'Goodbye')).toBe(false);
  });

  it('should respect custom threshold', () => {
    expect(areStringsSimilar('Hello', 'Hello!', 0.99)).toBe(false);
    expect(areStringsSimilar('Hello', 'Hello!', 0.9)).toBe(true);
  });
});
