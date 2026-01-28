/**
 * Custom error classes for Markdly with actionable error messages
 */

/**
 * Base error class for all Markdly errors
 */
export class MarkdlyError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly suggestion?: string;
  public readonly documentationUrl?: string;

  constructor(
    message: string,
    code: string,
    options?: {
      statusCode?: number;
      suggestion?: string;
      documentationUrl?: string;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = "MarkdlyError";
    this.code = code;
    this.statusCode = options?.statusCode;
    this.suggestion = options?.suggestion;
    this.documentationUrl = options?.documentationUrl;

    if (options?.cause) {
      this.cause = options.cause;
    }
  }

  /**
   * Returns a user-friendly error message with suggestion
   */
  toUserMessage(): string {
    let message = `${this.message}\n\n`;
    if (this.suggestion) {
      message += `💡 Suggestion: ${this.suggestion}\n`;
    }
    if (this.documentationUrl) {
      message += `📚 Documentation: ${this.documentationUrl}\n`;
    }
    return message.trim();
  }

  /**
   * Returns a JSON-serializable error object
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        suggestion: this.suggestion,
        documentationUrl: this.documentationUrl,
        statusCode: this.statusCode,
      },
    };
  }
}

/**
 * Validation Errors
 */
export class ValidationError extends MarkdlyError {
  constructor(
    message: string,
    code: string,
    options?: {
      suggestion?: string;
      documentationUrl?: string;
    }
  ) {
    super(message, code, { statusCode: 400, ...options });
    this.name = "ValidationError";
  }
}

export class InvalidGoogleDocIdError extends ValidationError {
  constructor(docId: string) {
    super(
      `Invalid Google Doc ID: "${docId}"`,
      "INVALID_GOOGLE_DOC_ID",
      {
        suggestion: "Google Doc IDs should be 44 characters long and contain only letters, numbers, hyphens, and underscores. Extract the ID from the URL: https://docs.google.com/document/d/{ID}/edit",
        documentationUrl: "https://developers.google.com/docs/api/guides/quickstart",
      }
    );
    this.name = "InvalidGoogleDocIdError";
  }
}

export class InvalidFileError extends ValidationError {
  constructor(fileName: string, supportedFormats: string[]) {
    super(
      `Unsupported file format: "${fileName}"`,
      "INVALID_FILE_FORMAT",
      {
        suggestion: `Please upload one of the supported formats: ${supportedFormats.join(", ")}`,
      }
    );
    this.name = "InvalidFileError";
  }
}

export class FileTooLargeError extends ValidationError {
  constructor(fileSize: number, maxSize: number) {
    super(
      `File size (${formatBytes(fileSize)}) exceeds maximum allowed size (${formatBytes(maxSize)})`,
      "FILE_TOO_LARGE",
      {
        suggestion: "Please upload a smaller file or compress the image before uploading.",
      }
    );
    this.name = "FileTooLargeError";
  }
}

/**
 * Authentication & Authorization Errors
 */
export class AuthenticationError extends MarkdlyError {
  constructor(
    message: string,
    code: string,
    options?: {
      suggestion?: string;
      documentationUrl?: string;
    }
  ) {
    super(message, code, { statusCode: 401, ...options });
    this.name = "AuthenticationError";
  }
}

export class GoogleAuthError extends AuthenticationError {
  constructor(
    message: string,
    options?: {
      suggestion?: string;
      documentationUrl?: string;
    }
  ) {
    super(message, "GOOGLE_AUTH_ERROR", options);
    this.name = "GoogleAuthError";
  }
}

export class GoogleTokenExpiredError extends GoogleAuthError {
  constructor() {
    super(
      "Your Google access token has expired",
      {
        suggestion: "Please reconnect your Google account. Go to Settings → Google Connection and click 'Reconnect'.",
      }
    );
    this.name = "GoogleTokenExpiredError";
  }
}

export class GoogleDocNotFoundError extends GoogleAuthError {
  constructor(docId: string) {
    super(
      `Google Doc not found: "${docId}"`,
      {
        suggestion: "Make sure the document exists and is accessible. Check that the document is shared with the Markdly OAuth client or is publicly accessible.",
      }
    );
    this.name = "GoogleDocNotFoundError";
  }
}

export class GoogleDocNotAccessibleError extends GoogleAuthError {
  constructor(docId: string) {
    super(
      `Google Doc is not accessible: "${docId}"`,
      {
        suggestion: "The document may be private or not shared with Markdly. Please share the document with Markdly's OAuth client or make it publicly accessible.",
      }
    );
    this.name = "GoogleDocNotAccessibleError";
  }
}

export class GitHubAuthError extends AuthenticationError {
  constructor(
    message: string,
    options?: {
      suggestion?: string;
      documentationUrl?: string;
    }
  ) {
    super(message, "GITHUB_AUTH_ERROR", options);
    this.name = "GitHubAuthError";
  }
}

export class GitHubRepoNotFoundError extends GitHubAuthError {
  constructor(owner: string, repo: string) {
    super(
      `GitHub repository not found: "${owner}/${repo}"`,
      {
        suggestion: "Make sure the repository exists and you have access to it. Check that the repository is not private or archived.",
      }
    );
    this.name = "GitHubRepoNotFoundError";
  }
}

/**
 * API Errors
 */
export class APIError extends MarkdlyError {
  constructor(
    message: string,
    code: string,
    options?: {
      statusCode?: number;
      suggestion?: string;
      documentationUrl?: string;
    }
  ) {
    super(message, code, options);
    this.name = "APIError";
  }
}

export class RateLimitError extends APIError {
  constructor(service: string, resetTime?: Date) {
    const resetMessage = resetTime
      ? ` (resets at ${resetTime.toLocaleTimeString()})`
      : "";
    super(
      `Rate limit exceeded for ${service}${resetMessage}`,
      "RATE_LIMIT_EXCEEDED",
      {
        statusCode: 429,
        suggestion: "Please wait a moment and try again. If you're syncing multiple documents, consider spacing out your requests.",
      }
    );
    this.name = "RateLimitError";
  }
}

export class NetworkError extends APIError {
  constructor(service: string, originalError: Error) {
    super(
      `Network error connecting to ${service}: ${originalError.message}`,
      "NETWORK_ERROR",
      {
        suggestion: "Check your internet connection and try again. If the problem persists, the service may be temporarily unavailable.",
      }
    );
    this.name = "NetworkError";
  }
}

export class TimeoutError extends APIError {
  constructor(service: string, timeoutMs: number) {
    super(
      `Request to ${service} timed out after ${timeoutMs}ms`,
      "REQUEST_TIMEOUT",
      {
        suggestion: "The server may be under heavy load. Please try again in a moment.",
      }
    );
    this.name = "TimeoutError";
  }
}

/**
 * Conversion Errors
 */
export class ConversionError extends MarkdlyError {
  constructor(
    message: string,
    code: string,
    options?: {
      suggestion?: string;
      documentationUrl?: string;
    }
  ) {
    super(message, code, { statusCode: 500, ...options });
    this.name = "ConversionError";
  }
}

export class ImageProcessingError extends ConversionError {
  constructor(imageUrl: string, originalError: Error) {
    super(
      `Failed to process image: ${imageUrl}`,
      "IMAGE_PROCESSING_ERROR",
      {
        suggestion: "The image may be corrupted or in an unsupported format. Try removing the image from the document and syncing again.",
      }
    );
    this.name = "ImageProcessingError";
  }
}

export class CloudinaryUploadError extends ConversionError {
  constructor(originalError: Error) {
    super(
      `Failed to upload image to Cloudinary: ${originalError.message}`,
      "CLOUDINARY_UPLOAD_ERROR",
      {
        suggestion: "Check your Cloudinary configuration and ensure your API credentials are correct. The image will be linked from its original source instead.",
      }
    );
    this.name = "CloudinaryUploadError";
  }
}

export class MarkdownValidationError extends ConversionError {
  constructor(warnings: string[]) {
    super(
      `Markdown validation failed: ${warnings.join(", ")}`,
      "MARKDOWN_VALIDATION_ERROR",
      {
        suggestion: "The converted markdown has some issues. Review the content manually or try converting the document again.",
      }
    );
    this.name = "MarkdownValidationError";
  }
}

/**
 * Sync Errors
 */
export class SyncError extends MarkdlyError {
  constructor(
    message: string,
    code: string,
    options?: {
      suggestion?: string;
      documentationUrl?: string;
    }
  ) {
    super(message, code, { statusCode: 500, ...options });
    this.name = "SyncError";
  }
}

export class GitHubCommitError extends SyncError {
  constructor(originalError: Error) {
    super(
      `Failed to commit to GitHub: ${originalError.message}`,
      "GITHUB_COMMIT_ERROR",
      {
        suggestion: "Check that you have write access to the repository and that the branch doesn't already exist. Try again in a moment.",
      }
    );
    this.name = "GitHubCommitError";
  }
}

export class GitHubPRError extends SyncError {
  constructor(originalError: Error) {
    super(
      `Failed to create pull request: ${originalError.message}`,
      "GITHUB_PR_ERROR",
      {
        suggestion: "The pull request may already exist or there may be a conflict. Check your GitHub repository for existing PRs.",
      }
    );
    this.name = "GitHubPRError";
  }
}

export class SyncConfigNotFoundError extends SyncError {
  constructor(configId: string) {
    super(
      `Sync configuration not found: "${configId}"`,
      "SYNC_CONFIG_NOT_FOUND",
      {
        suggestion: "The sync configuration may have been deleted. Create a new sync configuration in Settings → Sync Configurations.",
      }
    );
    this.name = "SyncConfigNotFoundError";
  }
}

/**
 * Utility function to format bytes
 */
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Utility function to extract error code from various error types
 */
export function getErrorCode(error: unknown): string {
  if (error instanceof MarkdlyError) {
    return error.code;
  }
  if (error instanceof Error) {
    return error.name;
  }
  return "UNKNOWN_ERROR";
}

/**
 * Utility function to create a user-friendly error message
 */
export function getUserErrorMessage(error: unknown): string {
  if (error instanceof MarkdlyError) {
    return error.toUserMessage();
  }
  if (error instanceof Error) {
    return `${error.message}\n\n💡 Please try again or contact support if the problem persists.`;
  }
  return "An unexpected error occurred. Please try again or contact support.";
}

/**
 * Utility function to log errors with context
 */
export function logError(error: unknown, context: Record<string, unknown> = {}): void {
  const errorData = {
    timestamp: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : "Unknown",
    code: error instanceof MarkdlyError ? error.code : undefined,
    stack: error instanceof Error ? error.stack : undefined,
    context,
  };

  console.error("Markdly Error:", JSON.stringify(errorData, null, 2));
}
