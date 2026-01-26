import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/database";
import { users, syncHistory, analytics } from "@/db/schema";
import { eq, gt, count, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin access
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail !== session.user.email && !session.user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get total users
    const [totalUsersResult] = await db
      .select({ count: count() })
      .from(users);

    // Get users from last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [newUsersResult] = await db
      .select({ count: count() })
      .from(users)
      .where(gt(users.signupDate, sevenDaysAgo));

    // Get active users (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [activeUsersResult] = await db
      .select({ count: count() })
      .from(users)
      .where(users.lastLogin.isNotNull().and(gt(users.lastLogin, thirtyDaysAgo)));

    // Get total syncs
    const [totalSyncsResult] = await db
      .select({ count: count() })
      .from(syncHistory);

    // Get successful syncs
    const [successfulSyncsResult] = await db
      .select({ count: count() })
      .from(syncHistory)
      .where(eq(syncHistory.status, "success"));

    // Get sync success rate
    const totalSyncs = totalSyncsResult.count || 0;
    const successfulSyncs = successfulSyncsResult.count || 0;
    const successRate = totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 0;

    // Get recent signups
    const recentSignups = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        signupSource: users.signupSource,
        signupDate: users.signupDate,
      })
      .from(users)
      .orderBy(users.signupDate)
      .limit(10);

    // Get recent sync events
    const recentSyncs = await db
      .select({
        id: syncHistory.id,
        docTitle: syncHistory.docTitle,
        status: syncHistory.status,
        startedAt: syncHistory.startedAt,
      })
      .from(syncHistory)
      .orderBy(syncHistory.startedAt)
      .limit(10);

    return NextResponse.json({
      stats: {
        totalUsers: totalUsersResult.count,
        newUsers7d: newUsersResult.count,
        activeUsers30d: activeUsersResult.count,
        totalSyncs,
        successfulSyncs,
        successRate: Math.round(successRate * 100) / 100,
      },
      recentSignups,
      recentSyncs,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
