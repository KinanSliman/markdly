/**
 * Test Setup File
 *
 * Configures the test environment for Vitest.
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to debug tests
  // log: console.log,
  // warn: vi.fn(),
  // error: vi.fn(),
};

// Mock fetch API
global.fetch = vi.fn();

// Mock environment variables
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.GITHUB_CLIENT_ID = 'test-github-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-github-client-secret';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloudinary-cloud';
process.env.CLOUDINARY_API_KEY = 'test-cloudinary-key';
process.env.CLOUDINARY_API_SECRET = 'test-cloudinary-secret';
