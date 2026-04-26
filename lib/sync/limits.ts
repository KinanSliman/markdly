import { db } from "@/lib/database";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

// Free tier limit: 5 syncs per month
export const FREE_SYNC_LIMIT = 5;

/**
 * Check if a user has reached their sync limit
 * @param userId - The user ID to check
 * @returns Object with canSync, remainingSyncs, and resetDate
 */
export async function checkSyncLimit(userId: string): Promise<{
  canSync: boolean;
  remainingSyncs: number;
  resetDate: Date | null;
  limit: number;
}> {
  const [user] = await db
    .select({ plan: users.plan, syncCount: users.syncCount, syncResetDate: users.syncResetDate })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return { canSync: false, remainingSyncs: 0, resetDate: null, limit: 0 };
  }

  // Pro and Enterprise users have unlimited syncs
  if (user.plan === "pro" || user.plan === "enterprise") {
    return { canSync: true, remainingSyncs: Infinity, resetDate: null, limit: Infinity };
  }

  // Free tier: check monthly limit
  const now = new Date();
  const resetDate = user.syncResetDate || now;
  const isResetMonth = now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear();

  // Reset count if it's a new month
  if (isResetMonth) {
    await db
      .update(users)
      .set({
        syncCount: 0,
        syncResetDate: now,
      })
      .where(eq(users.id, userId));

    return {
      canSync: true,
      remainingSyncs: FREE_SYNC_LIMIT,
      resetDate: now,
      limit: FREE_SYNC_LIMIT,
    };
  }

  const remainingSyncs = FREE_SYNC_LIMIT - (user.syncCount || 0);
  const canSync = remainingSyncs > 0;

  return {
    canSync,
    remainingSyncs,
    resetDate,
    limit: FREE_SYNC_LIMIT,
  };
}

/**
 * Increment sync count for a user
 * @param userId - The user ID to increment
 */
export async function incrementSyncCount(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      syncCount: sql`COALESCE(${users.syncCount}, 0) + 1`,
    })
    .where(eq(users.id, userId));
}

/**
 * Get sync usage for a user
 * @param userId - The user ID
 */
export async function getSyncUsage(userId: string): Promise<{
  currentCount: number;
  limit: number;
  resetDate: Date | null;
  plan: string;
}> {
  const [user] = await db
    .select({ plan: users.plan, syncCount: users.syncCount, syncResetDate: users.syncResetDate })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return { currentCount: 0, limit: 0, resetDate: null, plan: "free" };
  }

  const limit = user.plan === "pro" || user.plan === "enterprise" ? Infinity : FREE_SYNC_LIMIT;

  return {
    currentCount: user.syncCount || 0,
    limit,
    resetDate: user.syncResetDate,
    plan: user.plan || "free",
  };
}
