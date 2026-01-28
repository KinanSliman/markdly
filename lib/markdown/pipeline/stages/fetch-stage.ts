/**
 * Fetch Stage
 *
 * Fetches Google Doc content from Google Docs API.
 * Handles authentication and initial document structure extraction.
 */

import { google } from 'googleapis';
import { PipelineStage, PipelineContext, PipelineError } from '../types';
import { retry } from '../../utils/retry';
import { rateLimiter } from '../../utils/rate-limit';

// Google Docs API client
const docs = google.docs('v1');

export class FetchStage implements PipelineStage {
  name = 'fetch';
  description = 'Fetches Google Doc content from Google Docs API';

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { docId, token, isAccessToken = true } = context.input;

    if (!docId) {
      throw new PipelineError('Missing docId', this.name, context);
    }

    if (!token) {
      throw new PipelineError('Missing authentication token', this.name, context);
    }

    try {
      // Create OAuth2 client
      const auth = new google.auth.OAuth2();

      if (isAccessToken) {
        auth.setCredentials({ access_token: token });
      } else {
        // For refresh token, we need to set it properly
        auth.setCredentials({ refresh_token: token });
      }

      // Apply rate limiting
      const rateLimitedGet = rateLimiter.wrap(
        async () => {
          const startTime = performance.now();

          const response = await retry(
            async () => {
              return await docs.documents.get({
                documentId: docId,
                auth: auth,
              });
            },
            {
              maxAttempts: 3,
              backoffMs: 1000,
              retryableErrors: [
                'ECONNRESET',
                'ETIMEDOUT',
                'ENOTFOUND',
                'rateLimitExceeded',
                'quotaExceeded',
              ],
            }
          );

          const endTime = performance.now();
          context.metrics.fetchTime = endTime - startTime;

          return response;
        },
        {
          key: 'google-docs-api',
          limit: 300, // 300 requests per minute
          window: 60000, // 1 minute window
        }
      );

      const response = await rateLimitedGet();

      if (!response.data) {
        throw new PipelineError('Empty response from Google Docs API', this.name, context);
      }

      // Store document in context
      context.document = response.data;

      // Extract title from document
      const title = response.data.title || 'Untitled Document';

      // Initialize stage data
      if (!context.stageData[this.name]) {
        context.stageData[this.name] = {};
      }
      context.stageData[this.name].documentTitle = title;

      // Update metadata
      if (!context.metrics) {
        context.metrics = {} as any;
      }

      return context;
    } catch (error: any) {
      // Handle specific Google API errors
      if (error.response?.status === 404) {
        throw new PipelineError(
          `Google Doc not found: ${docId}. Please check the document ID and ensure it's accessible.`,
          this.name,
          context,
          error
        );
      }

      if (error.response?.status === 403) {
        throw new PipelineError(
          'Access denied to Google Doc. Please ensure you have the correct permissions.',
          this.name,
          context,
          error
        );
      }

      if (error.response?.status === 401) {
        throw new PipelineError(
          'Authentication failed. Your Google token may be expired. Please reconnect your Google account.',
          this.name,
          context,
          error
        );
      }

      throw new PipelineError(
        `Failed to fetch Google Doc: ${error.message}`,
        this.name,
        context,
        error
      );
    }
  }

  async validate(context: PipelineContext): Promise<boolean> {
    if (!context.input.docId) {
      throw new PipelineError('Validation failed: docId is required', this.name, context);
    }

    if (!context.input.token) {
      throw new PipelineError('Validation failed: token is required', this.name, context);
    }

    return true;
  }

  async cleanup(context: PipelineContext): Promise<void> {
    // Clean up any temporary resources
    if (context.stageData[this.name]) {
      delete context.stageData[this.name];
    }
  }
}

// Factory function for easy instantiation
export const createFetchStage = (): PipelineStage => {
  return new FetchStage();
};
