import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/database";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const credentialsProvider = Credentials({
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials) {
    if (!credentials?.email || !credentials?.password) {
      return null;
    }

    const email = credentials.email as string;
    const password = credentials.password as string;

    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user || !user.passwordHash) {
      return null;
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return null;
    }

    // Update last login timestamp
    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      isAdmin: user.isAdmin ?? undefined,
      signupSource: (user.signupSource ?? undefined) as
        | "email"
        | "github"
        | "google"
        | undefined,
      plan: (user.plan ?? undefined) as
        | "free"
        | "pro"
        | "enterprise"
        | undefined,
    };
  },
});

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
