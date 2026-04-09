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
import { credentialsProvider, hashPassword } from "@/lib/auth/credentials";
import { trackSignup, trackOAuthConnect } from "@/lib/analytics";

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
        token.id = user.id;
        token.isAdmin = user.isAdmin;
        token.signupSource = user.signupSource;
        token.plan = user.plan;
      }
      if (account) {
        token.accessToken = account.access_token;
        token.provider = account.provider;
      }
      // Validate user still exists in database (handles DB truncation)
      if (token.id) {
        try {
          const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.id, token.id as string))
            .limit(1);

          // If user doesn't exist in DB, return null to sign them out
          if (existingUser.length === 0) {
            console.log("User not found in database, signing out...");
            return null;
          }

          // Update token with latest user data
          token.isAdmin = existingUser[0].isAdmin ?? false;
          token.signupSource = existingUser[0].signupSource ?? "email";
          token.plan = existingUser[0].plan ?? "free";

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

          // Ensure user has a plan set (for existing users without plan)
          if (!existingUser[0].plan) {
            await db
              .update(users)
              .set({ plan: "free" })
              .where(eq(users.id, token.id as string));
          }

          // Ensure user has sync tracking initialized (for existing users)
          if (!existingUser[0].syncCount && !existingUser[0].syncResetDate) {
            await db
              .update(users)
              .set({
                syncCount: 0,
                syncResetDate: new Date(),
              })
              .where(eq(users.id, token.id as string));
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
        session.user.isAdmin = token.isAdmin;
        session.user.signupSource = token.signupSource;
        session.user.plan = token.plan;
      }
      return session;
    },
    async signIn({ user, account }) {
      // Update signup source for OAuth users and track analytics
      if (account?.provider && user?.email) {
        try {
          const source = account.provider === "github" ? "github" : "google";

          // Check if this is a new signup (email not verified yet)
          const [existingUser] = await db
            .select({ emailVerified: users.emailVerified, plan: users.plan })
            .from(users)
            .where(eq(users.email, user.email))
            .limit(1);

          const isNewSignup = !existingUser?.emailVerified;

          // Set plan to free for new users
          const updateData: any = {
            signupSource: source,
            emailVerified: new Date(), // OAuth emails are verified
          };

          // Only set plan if it's a new signup or doesn't have a plan
          if (isNewSignup || !existingUser?.plan) {
            updateData.plan = "free";
          }

          await db
            .update(users)
            .set(updateData)
            .where(eq(users.email, user.email));

          // Track signup for new users
          if (isNewSignup) {
            await trackSignup(user.id, source);
          }

          // Track OAuth connection
          await trackOAuthConnect(user.id, source);
        } catch (error) {
          console.error("Error updating signup source:", error);
        }
      }
      // Workspace creation is now handled in the jwt callback
      // to ensure the user is persisted before creating the workspace
      return true;
    },
  },
});
