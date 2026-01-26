import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/database";
import { users, syncHistory, workspaces } from "@/db/schema";
import { eq, count } from "drizzle-orm";
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

    // Get all users with their sync counts
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        signupSource: users.signupSource,
        signupDate: users.signupDate,
        lastLogin: users.lastLogin,
        emailVerified: users.emailVerified,
        isAdmin: users.isAdmin,
      })
      .from(users);

    // Get sync counts per user
    const userSyncCounts = await db
      .select({
        userId: syncHistory.userId,
        count: count(),
      })
      .from(syncHistory)
      .where(syncHistory.userId.isNotNull())
      .groupBy(syncHistory.userId);

    // Get user configs count (via workspaces)
    const userConfigCounts = await db
      .select({
        ownerId: workspaces.ownerId,
        count: count(),
      })
      .from(workspaces)
      .groupBy(workspaces.ownerId);

    // Enrich users with sync and config counts
    const enrichedUsers = allUsers.map((user) => {
      const syncCount =
        userSyncCounts.find((sc) => sc.userId === user.id)?.count || 0;
      const configCount =
        userConfigCounts.find((cc) => cc.ownerId === user.id)?.count || 0;

      return {
        ...user,
        syncCount,
        configCount,
      };
    });

    return NextResponse.json({
      users: enrichedUsers,
      total: enrichedUsers.length,
    });
  } catch (error) {
    console.error("Admin users error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
