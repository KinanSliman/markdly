"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Mail, Loader2, ArrowLeft } from "lucide-react";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const success = searchParams.get("success");
  const errorParam = searchParams.get("error");

  useEffect(() => {
    if (success === "true") {
      setMessage("Email verified successfully! You can now sign in.");
    } else if (errorParam === "expired-token") {
      setError("Verification link has expired. Please request a new one.");
    } else if (errorParam === "invalid-token") {
      setError("Invalid verification link. Please request a new one.");
    } else if (errorParam === "missing-token") {
      setError("No verification token provided. Please check your email.");
    } else if (errorParam === "server-error") {
      setError("An error occurred. Please try again.");
    }
  }, [success, errorParam]);

  const handleResendVerification = async () => {
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const email = prompt("Please enter your email address:");
      if (!email) {
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send verification email");
        setIsLoading(false);
        return;
      }

      setMessage("Verification email sent! Please check your inbox.");
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Mail className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">Email Verification</CardTitle>
          <CardDescription>
            Email verification is optional for this demo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4 mr-2" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {message && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
              <AlertDescription className="text-green-800">{message}</AlertDescription>
            </Alert>
          )}

          <p className="text-sm text-muted-foreground text-center">
            Email verification is optional for this demo. You can sign in and connect your GitHub and Google accounts to start syncing documents.
          </p>

          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={handleResendVerification}
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Resend Verification Email
                </>
              )}
            </Button>

            <Button
              className="w-full"
              asChild
            >
              <Link href="/auth/signin">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Sign In
              </Link>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Note: For demo purposes, verification is simulated. In production, you would receive an email with a verification link.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
