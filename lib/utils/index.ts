/**
 * Markdly Utilities
 * Export all utility functions and classes
 */

// Retry logic
export {
  withRetry,
  withRetryAll,
  type RetryOptions,
  type RetryContext,
} from "./retry";

// Rate limiting
export {
  RateLimiter,
  GOOGLE_DOCS_RATE_LIMITER,
  GITHUB_RATE_LIMITER,
  CLOUDINARY_RATE_LIMITER,
  GOOGLE_DRIVE_RATE_LIMITER,
  withRateLimit,
  withRateLimitAll,
  type RateLimitConfig,
  type RateLimitState,
} from "./rate-limit";

// Error handling
export {
  MarkdlyError,
  ValidationError,
  AuthenticationError,
  APIError,
  ConversionError,
  SyncError,
  InvalidGoogleDocIdError,
  InvalidFileError,
  FileTooLargeError,
  GoogleAuthError,
  GoogleTokenExpiredError,
  GoogleDocNotFoundError,
  GoogleDocNotAccessibleError,
  GitHubAuthError,
  GitHubRepoNotFoundError,
  RateLimitError,
  NetworkError,
  TimeoutError,
  ImageProcessingError,
  CloudinaryUploadError,
  MarkdownValidationError,
  GitHubCommitError,
  GitHubPRError,
  SyncConfigNotFoundError,
  getErrorCode,
  getUserErrorMessage,
  logError,
} from "./errors";

// Validation
export {
  validateGoogleDocId,
  validateGitHubRepo,
  validateFile,
  validateFilePath,
  validateEmail,
  validatePassword,
  validateName,
  validateUrl,
  validateFramework,
  validateImageStrategy,
  validateSyncMode,
} from "./validation";
