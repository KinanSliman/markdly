import NextAuth, { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isAdmin?: boolean;
      signupSource?: "email" | "github" | "google";
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    isAdmin?: boolean;
    signupSource?: "email" | "github" | "google";
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    isAdmin?: boolean;
    signupSource?: "email" | "github" | "google";
  }
}
