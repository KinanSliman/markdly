import "@/lib/env"; // Validate required env vars on cold start
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/database";
import {
  users,
  sessions,
  accounts,
  verificationTokens,
  workspaces,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { credentialsProvider } from "@/lib/auth/credentials";
import { trackSignup, trackOAuthConnect } from "@/lib/analytics";
import { logger } from "@/lib/logger";

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
          scope:
            "openid email profile https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file",
          prompt: "consent",
          access_type: "offline",
          include_granted_scopes: "true",
        },
      },
    }),
    credentialsProvider,
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        if (user.id) token.id = user.id;
        token.isAdmin = user.isAdmin;
        token.signupSource = user.signupSource;
        token.plan = user.plan;
      }
      if (account) {
        token.accessToken = account.access_token;
        token.provider = account.provider;
      }

      // Narrowing token.id to a constant 'userId' fixes the TS(2322) error
      const userId = token.id as string;

      if (userId) {
        try {
          const [existingUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

          // If user doesn't exist in DB, return null to sign them out
          if (!existingUser) {
            logger.warn("User not found in database, signing out");
            return null;
          }

          // Update token with latest user data from DB
          token.isAdmin = existingUser.isAdmin ?? false;
          token.signupSource = (existingUser.signupSource ?? "email") as
            | "email"
            | "github"
            | "google";
          token.plan = (existingUser.plan ?? "free") as
            | "free"
            | "pro"
            | "enterprise";

          // Create workspace logic
          const existingWorkspace = await db
            .select()
            .from(workspaces)
            .where(eq(workspaces.ownerId, userId));

          if (existingWorkspace.length === 0) {
            // Get user info to create workspace name
            const [userInfo] = await db
              .select({ name: users.name, email: users.email })
              .from(users)
              .where(eq(users.id, userId))
              .limit(1);

            if (userInfo) {
              await db.insert(workspaces).values({
                ownerId: userId,
                name: `${userInfo.name || userInfo.email}'s Workspace`,
                plan: "free",
              });
              logger.info(`Created workspace for user ${userId}`);
            }
          }

          // Ensure user has a plan set
          if (!existingUser.plan) {
            await db
              .update(users)
              .set({ plan: "free" })
              .where(eq(users.id, userId));
          }

          // Ensure user has sync tracking initialized
          if (!existingUser.syncCount && !existingUser.syncResetDate) {
            await db
              .update(users)
              .set({
                syncCount: 0,
                syncResetDate: new Date(),
              })
              .where(eq(users.id, userId));
          }
        } catch (error) {
          console.error("Error in JWT callback logic:", error);
          // We don't return null here so the user isn't bricked by a transient DB error
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.isAdmin = token.isAdmin as boolean;
        session.user.signupSource = token.signupSource as
          | "email"
          | "github"
          | "google";
        session.user.plan = token.plan as "free" | "pro" | "enterprise";
      }
      return session;
    },

    async signIn({ user, account }) {
      if (account?.provider && user?.email) {
        try {
          const source = account.provider === "github" ? "github" : "google";

          const [existingUser] = await db
            .select({ emailVerified: users.emailVerified, plan: users.plan })
            .from(users)
            .where(eq(users.email, user.email))
            .limit(1);

          const isNewSignup = !existingUser?.emailVerified;

          const updateData: any = {
            signupSource: source,
            emailVerified: new Date(),
          };

          if (isNewSignup || !existingUser?.plan) {
            updateData.plan = "free";
          }

          await db
            .update(users)
            .set(updateData)
            .where(eq(users.email, user.email));

          if (isNewSignup && user.id) {
            await trackSignup(user.id, source);
          }

          if (user.id) {
            await trackOAuthConnect(user.id, source);
          }
        } catch (error) {
          console.error("Error updating signup source:", error);
        }
      }
      return true;
    },
  },
});
