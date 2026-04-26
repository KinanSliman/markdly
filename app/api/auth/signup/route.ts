import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/database";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/credentials";
import { trackSignup } from "@/lib/analytics";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    // Validation
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email: email.toLowerCase(),
        passwordHash,
        signupSource: "email",
        signupDate: new Date(),
        emailVerified: new Date(), // Email verification skipped for demo
        plan: "free", // Default to free plan
        syncCount: 0, // Initialize sync count
        syncResetDate: new Date(), // Initialize reset date
      })
      .returning({ id: users.id, email: users.email, name: users.name });

    // Track signup event
    await trackSignup(newUser.id, "email");

    // Note: Email verification is skipped for demo purposes
    logger.info(`New user created: ${newUser.email}`);

    return NextResponse.json(
      {
        message: "Account created successfully.",
        user: { id: newUser.id, email: newUser.email },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
