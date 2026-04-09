import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmailSignupForm } from "@/components/forms/email-signup-form";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SignupPage() {
  const session = await auth();

  // If already authenticated, redirect to login
  if (session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
      <div className="space-y-6 w-full max-w-md">
        <EmailSignupForm />

        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?
              <Link
                href="/auth/signin"
                className="text-primary font-medium hover:underline"
              >
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
