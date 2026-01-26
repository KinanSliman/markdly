import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/database";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/credentials";
import { trackSignup } from "@/lib/analytics";

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
        emailVerified: null, // Email verification required
      })
      .returning({ id: users.id, email: users.email, name: users.name });

    // Track signup event
    await trackSignup(newUser.id, "email");

    // Note: In production, you would send a verification email here
    // For now, we'll simulate it by returning success
    console.log(`New user created: ${newUser.email}. Email verification required.`);

    return NextResponse.json(
      {
        message: "Account created successfully. Please verify your email.",
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
