/**
 * Input validation utilities for Markdly
 */

import {
  ValidationError,
  InvalidGoogleDocIdError,
  InvalidFileError,
  FileTooLargeError,
} from "./errors";

/**
 * Validates a Google Doc ID
 *
 * Google Doc IDs are typically 44 characters long and contain:
 * - Letters (a-z, A-Z)
 * - Numbers (0-9)
 * - Hyphens (-)
 * - Underscores (_)
 *
 * @param docId - The Google Doc ID or URL to validate
 * @returns The validated Google Doc ID
 * @throws {InvalidGoogleDocIdError} If the doc ID is invalid
 *
 * @example
 * // Valid IDs
 * validateGoogleDocId("1abc123def456ghi789jkl012mno345pqr678stu901vwx")
 * validateGoogleDocId("https://docs.google.com/document/d/1abc123def456ghi789jkl012mno345pqr678stu901vwx/edit")
 *
 * @example
 * // Invalid IDs
 * validateGoogleDocId("invalid-id") // Throws InvalidGoogleDocIdError
 */
export function validateGoogleDocId(docId: string): string {
  if (!docId || typeof docId !== "string") {
    throw new InvalidGoogleDocIdError(String(docId));
  }

  // Extract ID from URL if provided
  let extractedId = docId.trim();

  // Match Google Docs URL patterns
  const urlPattern = /docs\.google\.com\/document\/d\/([a-zA-Z0-9-_]+)/;
  const urlMatch = docId.match(urlPattern);

  if (urlMatch) {
    extractedId = urlMatch[1];
  }

  // Validate the ID format
  // Google Doc IDs are typically 44 characters and contain only alphanumeric, hyphens, and underscores
  const idPattern = /^[a-zA-Z0-9-_]{30,50}$/;

  if (!idPattern.test(extractedId)) {
    throw new InvalidGoogleDocIdError(docId);
  }

  return extractedId;
}

/**
 * Validates a GitHub repository name
 *
 * @param owner - The repository owner (user or organization)
 * @param repo - The repository name
 * @returns An object with validated owner and repo
 * @throws {ValidationError} If the repository name is invalid
 *
 * @example
 * validateGitHubRepo("username", "my-repo") // Returns { owner: "username", repo: "my-repo" }
 */
export function validateGitHubRepo(owner: string, repo: string): { owner: string; repo: string } {
  if (!owner || typeof owner !== "string") {
    throw new ValidationError(
      "Invalid GitHub owner",
      "INVALID_GITHUB_OWNER",
      {
        suggestion: "GitHub owner should be a valid username or organization name.",
      }
    );
  }

  if (!repo || typeof repo !== "string") {
    throw new ValidationError(
      "Invalid GitHub repository name",
      "INVALID_GITHUB_REPO",
      {
        suggestion: "GitHub repository name should be a valid string.",
      }
    );
  }

  // Validate owner format (alphanumeric, hyphens, underscores, dots)
  const ownerPattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9-_.]*[a-zA-Z0-9])?$/;
  if (!ownerPattern.test(owner)) {
    throw new ValidationError(
      `Invalid GitHub owner: "${owner}"`,
      "INVALID_GITHUB_OWNER",
      {
        suggestion: "GitHub owner can only contain letters, numbers, hyphens, underscores, and dots. It must start and end with alphanumeric characters.",
      }
    );
  }

  // Validate repo format (alphanumeric, hyphens, underscores, dots)
  const repoPattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9-_.]*[a-zA-Z0-9])?$/;
  if (!repoPattern.test(repo)) {
    throw new ValidationError(
      `Invalid GitHub repository name: "${repo}"`,
      "INVALID_GITHUB_REPO",
      {
        suggestion: "GitHub repository name can only contain letters, numbers, hyphens, underscores, and dots. It must start and end with alphanumeric characters.",
      }
    );
  }

  return { owner, repo };
}

/**
 * Validates a file for upload
 *
 * @param file - The file to validate
 * @param options - Validation options
 * @returns The validated file
 * @throws {ValidationError} If the file is invalid
 *
 * @example
 * const file = validateFile(selectedFile, {
 *   allowedTypes: ["text/html", "application/pdf"],
 *   maxSize: 10 * 1024 * 1024 // 10MB
 * });
 */
export function validateFile(
  file: File,
  options: {
    allowedTypes?: string[];
    allowedExtensions?: string[];
    maxSize?: number;
  } = {}
): File {
  const { allowedTypes, allowedExtensions, maxSize = 10 * 1024 * 1024 } = options;

  if (!file || !(file instanceof File)) {
    throw new ValidationError(
      "No file provided or invalid file",
      "INVALID_FILE",
      {
        suggestion: "Please select a valid file to upload.",
      }
    );
  }

  // Validate file size
  if (file.size > maxSize) {
    throw new FileTooLargeError(file.size, maxSize);
  }

  // Validate file type
  if (allowedTypes && allowedTypes.length > 0) {
    const isValidType = allowedTypes.some((type) => file.type === type);
    if (!isValidType) {
      throw new InvalidFileError(file.name, allowedTypes);
    }
  }

  // Validate file extension
  if (allowedExtensions && allowedExtensions.length > 0) {
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const isValidExtension = allowedExtensions.some((ext) => ext.toLowerCase() === fileExtension);
    if (!isValidExtension) {
      const supportedFormats = allowedExtensions.map((ext) => `.${ext}`);
      throw new InvalidFileError(file.name, supportedFormats);
    }
  }

  return file;
}

/**
 * Validates a file path for GitHub
 *
 * @param filePath - The file path to validate
 * @returns The validated file path
 * @throws {ValidationError} If the file path is invalid
 *
 * @example
 * validateFilePath("content/posts/my-post.md") // Returns "content/posts/my-post.md"
 */
export function validateFilePath(filePath: string): string {
  if (!filePath || typeof filePath !== "string") {
    throw new ValidationError(
      "Invalid file path",
      "INVALID_FILE_PATH",
      {
        suggestion: "File path should be a valid string.",
      }
    );
  }

  const trimmedPath = filePath.trim();

  // Check for common issues
  if (trimmedPath.startsWith("/")) {
    throw new ValidationError(
      "File path should not start with a slash",
      "INVALID_FILE_PATH",
      {
        suggestion: "Use relative paths without leading slashes, e.g., 'content/posts/my-post.md' instead of '/content/posts/my-post.md'.",
      }
    );
  }

  if (trimmedPath.includes("..")) {
    throw new ValidationError(
      "File path should not contain parent directory references",
      "INVALID_FILE_PATH",
      {
        suggestion: "Use absolute paths within the repository, not relative paths outside the repository.",
      }
    );
  }

  if (trimmedPath.includes("\\")) {
    throw new ValidationError(
      "File path should use forward slashes",
      "INVALID_FILE_PATH",
      {
        suggestion: "Use forward slashes (/) for file paths, not backslashes (\\).",
      }
    );
  }

  return trimmedPath;
}

/**
 * Validates an email address
 *
 * @param email - The email to validate
 * @returns The validated email
 * @throws {ValidationError} If the email is invalid
 *
 * @example
 * validateEmail("user@example.com") // Returns "user@example.com"
 */
export function validateEmail(email: string): string {
  if (!email || typeof email !== "string") {
    throw new ValidationError(
      "Invalid email address",
      "INVALID_EMAIL",
      {
        suggestion: "Please enter a valid email address.",
      }
    );
  }

  const trimmedEmail = email.trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(trimmedEmail)) {
    throw new ValidationError(
      `Invalid email address: "${email}"`,
      "INVALID_EMAIL",
      {
        suggestion: "Please enter a valid email address in the format: user@example.com",
      }
    );
  }

  return trimmedEmail;
}

/**
 * Validates a password
 *
 * @param password - The password to validate
 * @returns The validated password
 * @throws {ValidationError} If the password is invalid
 *
 * @example
 * validatePassword("SecurePassword123!") // Returns "SecurePassword123!"
 */
export function validatePassword(password: string): string {
  if (!password || typeof password !== "string") {
    throw new ValidationError(
      "Invalid password",
      "INVALID_PASSWORD",
      {
        suggestion: "Password must be provided.",
      }
    );
  }

  if (password.length < 8) {
    throw new ValidationError(
      "Password must be at least 8 characters long",
      "INVALID_PASSWORD",
      {
        suggestion: "Use a password with at least 8 characters, including uppercase, lowercase, numbers, and special characters.",
      }
    );
  }

  return password;
}

/**
 * Validates a name
 *
 * @param name - The name to validate
 * @returns The validated name
 * @throws {ValidationError} If the name is invalid
 *
 * @example
 * validateName("John Doe") // Returns "John Doe"
 */
export function validateName(name: string): string {
  if (!name || typeof name !== "string") {
    throw new ValidationError(
      "Invalid name",
      "INVALID_NAME",
      {
        suggestion: "Please enter a valid name.",
      }
    );
  }

  const trimmedName = name.trim();

  if (trimmedName.length < 2) {
    throw new ValidationError(
      "Name must be at least 2 characters long",
      "INVALID_NAME",
      {
        suggestion: "Please enter your full name.",
      }
    );
  }

  if (trimmedName.length > 100) {
    throw new ValidationError(
      "Name is too long (maximum 100 characters)",
      "INVALID_NAME",
      {
        suggestion: "Please use a shorter name.",
      }
    );
  }

  return trimmedName;
}

/**
 * Validates a URL
 *
 * @param url - The URL to validate
 * @returns The validated URL
 * @throws {ValidationError} If the URL is invalid
 *
 * @example
 * validateUrl("https://example.com") // Returns "https://example.com"
 */
export function validateUrl(url: string): string {
  if (!url || typeof url !== "string") {
    throw new ValidationError(
      "Invalid URL",
      "INVALID_URL",
      {
        suggestion: "Please enter a valid URL.",
      }
    );
  }

  const trimmedUrl = url.trim();

  try {
    const parsedUrl = new URL(trimmedUrl);
    return parsedUrl.toString();
  } catch {
    throw new ValidationError(
      `Invalid URL: "${url}"`,
      "INVALID_URL",
      {
        suggestion: "Please enter a valid URL starting with http:// or https://",
      }
    );
  }
}

/**
 * Validates a framework name
 *
 * @param framework - The framework name to validate
 * @returns The validated framework name
 * @throws {ValidationError} If the framework is invalid
 *
 * @example
 * validateFramework("nextjs") // Returns "nextjs"
 */
export function validateFramework(framework: string): string {
  const validFrameworks = ["nextjs", "hugo", "docusaurus", "astro", "jekyll", "custom"];

  if (!framework || typeof framework !== "string") {
    throw new ValidationError(
      "Invalid framework",
      "INVALID_FRAMEWORK",
      {
        suggestion: `Please select a valid framework: ${validFrameworks.join(", ")}`,
      }
    );
  }

  const trimmedFramework = framework.trim().toLowerCase();

  if (!validFrameworks.includes(trimmedFramework)) {
    throw new ValidationError(
      `Invalid framework: "${framework}"`,
      "INVALID_FRAMEWORK",
      {
        suggestion: `Please select one of: ${validFrameworks.join(", ")}`,
      }
    );
  }

  return trimmedFramework;
}

/**
 * Validates an image strategy
 *
 * @param strategy - The image strategy to validate
 * @returns The validated image strategy
 * @throws {ValidationError} If the strategy is invalid
 *
 * @example
 * validateImageStrategy("cloudinary") // Returns "cloudinary"
 */
export function validateImageStrategy(strategy: string): string {
  const validStrategies = ["cloudinary", "github", "keep"];

  if (!strategy || typeof strategy !== "string") {
    throw new ValidationError(
      "Invalid image strategy",
      "INVALID_IMAGE_STRATEGY",
      {
        suggestion: `Please select a valid image strategy: ${validStrategies.join(", ")}`,
      }
    );
  }

  const trimmedStrategy = strategy.trim().toLowerCase();

  if (!validStrategies.includes(trimmedStrategy)) {
    throw new ValidationError(
      `Invalid image strategy: "${strategy}"`,
      "INVALID_IMAGE_STRATEGY",
      {
        suggestion: `Please select one of: ${validStrategies.join(", ")}`,
      }
    );
  }

  return trimmedStrategy;
}

/**
 * Validates a sync mode
 *
 * @param mode - The sync mode to validate
 * @returns The validated sync mode
 * @throws {ValidationError} If the mode is invalid
 *
 * @example
 * validateSyncMode("github") // Returns "github"
 */
export function validateSyncMode(mode: string): string {
  const validModes = ["github", "convert-only"];

  if (!mode || typeof mode !== "string") {
    throw new ValidationError(
      "Invalid sync mode",
      "INVALID_SYNC_MODE",
      {
        suggestion: `Please select a valid sync mode: ${validModes.join(", ")}`,
      }
    );
  }

  const trimmedMode = mode.trim().toLowerCase();

  if (!validModes.includes(trimmedMode)) {
    throw new ValidationError(
      `Invalid sync mode: "${mode}"`,
      "INVALID_SYNC_MODE",
      {
        suggestion: `Please select one of: ${validModes.join(", ")}`,
      }
    );
  }

  return trimmedMode;
}

/**
 * Validates a .docx file
 *
 * @param file - The file to validate
 * @returns The validated file
 * @throws {InvalidFileError} If the file is not a valid .docx file
 *
 * @example
 * const file = validateDocxFile(selectedFile);
 */
export function validateDocxFile(file: File): File {
  if (!file || !(file instanceof File)) {
    throw new InvalidFileError(file?.name || 'unknown', ['.docx']);
  }

  // Check file extension
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension !== 'docx') {
    throw new InvalidFileError(file.name, ['.docx']);
  }

  // Check MIME type (optional, as some browsers may not report it correctly)
  const validMimeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip', // .docx files are ZIP archives
  ];

  if (file.type && !validMimeTypes.includes(file.type)) {
    throw new InvalidFileError(file.name, ['.docx']);
  }

  return file;
}
