import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Check if the current user is an admin
 */
export async function isAdmin(): Promise<boolean> {
  const session = await auth();

  if (!session?.user) {
    return false;
  }

  // Check if user is marked as admin in the database
  // Or if ADMIN_EMAIL env var matches the user's email
  const adminEmail = process.env.ADMIN_EMAIL;

  if (adminEmail && session.user.email === adminEmail) {
    return true;
  }

  // Also check the isAdmin flag from the session
  return session.user.isAdmin === true;
}

/**
 * Middleware-like function to protect admin routes
 */
export async function requireAdmin(): Promise<void> {
  const admin = await isAdmin();
  if (!admin) {
    redirect("/dashboard");
  }
}
