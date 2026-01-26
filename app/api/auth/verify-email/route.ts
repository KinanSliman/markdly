import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/database";
import { users, verificationTokens } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

// Generate a verification token (for demo purposes - in production, use a proper email service)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Find user
    const [user] = await db
      .select({ id: users.id, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { message: "Email already verified" },
        { status: 200 }
      );
    }

    // Generate verification token
    const token = randomUUID();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store token (replace any existing token for this email)
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.identifier, email.toLowerCase()));

    await db.insert(verificationTokens).values({
      identifier: email.toLowerCase(),
      token,
      expires,
    });

    // In production, send email with verification link
    // For demo, return the token
    return NextResponse.json(
      {
        message: "Verification token generated",
        token,
        // In production, this would be sent via email
        verificationUrl: `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${token}`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Generate verification token error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Verify email from token (GET endpoint for email link)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(new URL("/auth/verify-email?error=missing-token", request.url));
    }

    // Find token
    const [verificationToken] = await db
      .select({ identifier: verificationTokens.identifier, expires: verificationTokens.expires })
      .from(verificationTokens)
      .where(eq(verificationTokens.token, token))
      .limit(1);

    if (!verificationToken) {
      return NextResponse.redirect(new URL("/auth/verify-email?error=invalid-token", request.url));
    }

    // Check if token expired
    if (verificationToken.expires < new Date()) {
      return NextResponse.redirect(new URL("/auth/verify-email?error=expired-token", request.url));
    }

    // Mark user as verified
    await db
      .update(users)
      .set({ emailVerified: new Date() })
      .where(eq(users.email, verificationToken.identifier));

    // Delete used token
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.token, token));

    // Redirect to success page
    return NextResponse.redirect(new URL("/auth/verify-email?success=true", request.url));
  } catch (error) {
    console.error("Verify email error:", error);
    return NextResponse.redirect(new URL("/auth/verify-email?error=server-error", request.url));
  }
}
