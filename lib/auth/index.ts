import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/database";
import { users, sessions, accounts, verificationTokens, workspaces } from "@/db/schema";
import { eq } from "drizzle-orm";

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    sessionsTable: sessions,
    accountsTable: accounts,
    verificationTokensTable: verificationTokens,
  }),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
  },
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "repo user:email",
        },
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/drive.readonly",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      if (account) {
        token.accessToken = account.access_token;
        token.provider = account.provider;
      }
      // Validate user still exists in database (handles DB truncation)
      if (token.id) {
        try {
          const existingUser = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, token.id as string))
            .limit(1);

          // If user doesn't exist in DB, return null to sign them out
          if (existingUser.length === 0) {
            console.log("User not found in database, signing out...");
            return null;
          }

          // Create workspace for new users (only on first sign-in)
          // Check if user already has a workspace
          const existingWorkspace = await db
            .select()
            .from(workspaces)
            .where(eq(workspaces.ownerId, token.id as string));

          if (existingWorkspace.length === 0) {
            // Get user info to create workspace name
            const userInfo = await db
              .select({ name: users.name, email: users.email })
              .from(users)
              .where(eq(users.id, token.id as string))
              .limit(1);

            if (userInfo.length > 0) {
              await db.insert(workspaces).values({
                ownerId: token.id as string,
                name: `${userInfo[0].name || userInfo[0].email}'s Workspace`,
                plan: "free",
              });
              console.log(`Created workspace for user ${token.id}`);
            }
          }
        } catch (error) {
          console.error("Error creating workspace:", error);
          // On DB error, don't break the auth flow
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
    async signIn() {
      // Workspace creation is now handled in the jwt callback
      // to ensure the user is persisted before creating the workspace
      return true;
    },
  },
});
