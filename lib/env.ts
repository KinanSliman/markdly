/**
 * Runtime environment-variable validation.
 *
 * Imported once from the auth setup so it runs early on cold start. Required
 * vars cause the app to throw a clear error in production; in development we
 * log a warning so devs can still iterate without every credential set.
 *
 * Optional vars are tracked so we can surface "feature X disabled because
 * VAR is unset" messages instead of confusing runtime stack traces.
 */

const REQUIRED = [
  "POSTGRES_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
] as const;

const OPTIONAL_FEATURES: Record<string, string[]> = {
  "GitHub OAuth": ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
  "Google OAuth + Drive sync": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  "Cloudinary image uploads": [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ],
  "Admin dashboard access": ["ADMIN_EMAIL"],
  "Redis cache (otherwise in-memory)": ["REDIS_URL"],
};

let validated = false;

export function validateEnv(): void {
  if (validated) return;
  validated = true;

  const missing = REQUIRED.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(
      ", "
    )}. The application cannot start.`;

    if (process.env.NODE_ENV === "production") {
      // Hard fail in prod so we never serve a half-broken app
      throw new Error(message);
    }

    // In dev, warn loudly but don't stop the dev server
    console.warn(`[env] ${message}`);
  }

  // Surface which optional features are degraded
  if (process.env.NODE_ENV === "production") {
    for (const [feature, keys] of Object.entries(OPTIONAL_FEATURES)) {
      const missingKeys = keys.filter((k) => !process.env[k]);
      if (missingKeys.length > 0) {
        console.warn(
          `[env] ${feature} disabled — missing: ${missingKeys.join(", ")}`
        );
      }
    }
  }
}

// Eagerly validate on import. Safe because this module has no side effects
// beyond logging / throwing.
validateEnv();
