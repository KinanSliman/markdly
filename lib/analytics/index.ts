import { db } from "@/lib/database";
import { analytics } from "@/db/schema";

export interface AnalyticsEvent {
  event: string;
  metadata?: Record<string, unknown>;
}

/**
 * Track an analytics event for a user
 * @param userId - The user ID
 * @param event - The event name (e.g., 'signup', 'sync', 'oauth_connect')
 * @param metadata - Optional event-specific data
 */
export async function trackEvent(
  userId: string,
  event: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await db.insert(analytics).values({
      userId,
      event,
      metadata,
      createdAt: new Date(),
    });
  } catch (error) {
    // Log error but don't throw - analytics should not break the app
    console.error("Failed to track analytics event:", error);
  }
}

/**
 * Track a sync event
 */
export async function trackSync(
  userId: string,
  configId: string,
  mode: "github" | "convert-only",
  success: boolean,
  metadata?: Record<string, unknown>
): Promise<void> {
  await trackEvent(userId, success ? "sync_success" : "sync_failed", {
    configId,
    mode,
    ...metadata,
  });
}

/**
 * Track OAuth connection
 */
export async function trackOAuthConnect(
  userId: string,
  provider: "github" | "google"
): Promise<void> {
  await trackEvent(userId, "oauth_connect", { provider });
}

/**
 * Track signup
 */
export async function trackSignup(
  userId: string,
  source: "email" | "github" | "google"
): Promise<void> {
  await trackEvent(userId, "signup", { source });
}
