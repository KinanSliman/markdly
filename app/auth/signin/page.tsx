"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Github, Chrome } from "lucide-react";
import { signIn } from "next-auth/react";
import { EmailSigninForm } from "@/components/forms/email-signin-form";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
      <div className="space-y-6 w-full max-w-md">
        <EmailSigninForm />

        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-sm font-medium">
              Or continue with
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full"
              variant="outline"
              onClick={() => signIn("github")}
            >
              <Github className="mr-2 h-4 w-4" />
              Sign in with GitHub
            </Button>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => signIn("google")}
            >
              <Chrome className="mr-2 h-4 w-4" />
              Sign in with Google
            </Button>
          </CardContent>
        </Card>

        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link
                href="/auth/signup"
                className="text-primary font-medium hover:underline"
              >
                Sign up
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
