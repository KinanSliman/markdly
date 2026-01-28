/**
 * Unit tests for validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  validateGoogleDocId,
  validateGitHubRepo,
  validateFile,
  validateFilePath,
  ValidationError,
} from '@/lib/utils/validation';

describe('validateGoogleDocId', () => {
  it('should validate a valid document ID', () => {
    const docId = '1abc123def456';
    expect(validateGoogleDocId(docId)).toBe(docId);
  });

  it('should extract ID from Google Docs URL', () => {
    const url = 'https://docs.google.com/document/d/1abc123def456/edit';
    expect(validateGoogleDocId(url)).toBe('1abc123def456');
  });

  it('should extract ID from shortened URL', () => {
    const url = 'https://docs.google.com/document/d/1abc123def456';
    expect(validateGoogleDocId(url)).toBe('1abc123def456');
  });

  it('should throw error for invalid ID format', () => {
    expect(() => validateGoogleDocId('invalid id with spaces')).toThrow(ValidationError);
  });

  it('should throw error for empty ID', () => {
    expect(() => validateGoogleDocId('')).toThrow(ValidationError);
  });

  it('should throw error for non-string input', () => {
    expect(() => validateGoogleDocId(123 as any)).toThrow(ValidationError);
  });
});

describe('validateGitHubRepo', () => {
  it('should validate a valid repository format', () => {
    const repo = 'owner/repo';
    expect(validateGitHubRepo(repo)).toBe(repo);
  });

  it('should validate repository with hyphens and underscores', () => {
    const repo = 'my-org/my-repo_name';
    expect(validateGitHubRepo(repo)).toBe(repo);
  });

  it('should throw error for invalid format', () => {
    expect(() => validateGitHubRepo('invalid')).toThrow(ValidationError);
  });

  it('should throw error for empty input', () => {
    expect(() => validateGitHubRepo('')).toThrow(ValidationError);
  });

  it('should throw error for invalid characters', () => {
    expect(() => validateGitHubRepo('owner/repo with spaces')).toThrow(ValidationError);
  });
});

describe('validateFile', () => {
  it('should validate a valid file object', () => {
    const file = new File(['content'], 'test.md', { type: 'text/markdown' });
    expect(() => validateFile(file, ['.md', '.txt'], 1024 * 1024)).not.toThrow();
  });

  it('should validate file with allowed extension', () => {
    const file = new File(['content'], 'test.html', { type: 'text/html' });
    expect(() => validateFile(file, ['.html', '.md'], 1024 * 1024)).not.toThrow();
  });

  it('should throw error for disallowed extension', () => {
    const file = new File(['content'], 'test.exe', { type: 'application/octet-stream' });
    expect(() => validateFile(file, ['.md', '.txt'], 1024 * 1024)).toThrow(ValidationError);
  });

  it('should throw error for file exceeding size limit', () => {
    const largeContent = 'x'.repeat(2000);
    const file = new File([largeContent], 'test.md', { type: 'text/markdown' });
    expect(() => validateFile(file, ['.md'], 1000)).toThrow(ValidationError);
  });

  it('should validate DOCX files', () => {
    const file = new File(['content'], 'document.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    expect(() => validateFile(file, ['.docx'], 1024 * 1024)).not.toThrow();
  });

  it('should validate HTML files', () => {
    const file = new File(['<html></html>'], 'page.html', { type: 'text/html' });
    expect(() => validateFile(file, ['.html'], 1024 * 1024)).not.toThrow();
  });
});

describe('validateFilePath', () => {
  it('should validate a valid file path', () => {
    const path = 'content/posts/my-post.md';
    expect(validateFilePath(path)).toBe(path);
  });

  it('should validate path with subdirectories', () => {
    const path = 'docs/guides/getting-started/intro.md';
    expect(validateFilePath(path)).toBe(path);
  });

  it('should throw error for absolute path', () => {
    expect(() => validateFilePath('/absolute/path.md')).toThrow(ValidationError);
  });

  it('should throw error for path with ..', () => {
    expect(() => validateFilePath('../outside/file.md')).toThrow(ValidationError);
  });

  it('should throw error for empty path', () => {
    expect(() => validateFilePath('')).toThrow(ValidationError);
  });

  it('should throw error for path with invalid characters', () => {
    expect(() => validateFilePath('path/with\\backslash.md')).toThrow(ValidationError);
  });
});

describe('ValidationError', () => {
  it('should create error with correct properties', () => {
    const error = new ValidationError('Invalid input', 'INVALID_FORMAT', { field: 'docId' });

    expect(error.message).toBe('Invalid input');
    expect(error.code).toBe('INVALID_FORMAT');
    expect(error.details).toEqual({ field: 'docId' });
    expect(error.name).toBe('ValidationError');
  });
});
