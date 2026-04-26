"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import { RefreshCw, Loader2 } from "lucide-react";
import { signIn } from "next-auth/react";

export function ReconnectGoogleButton() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleReconnect = async () => {
    setIsLoading(true);

    try {
      // Disconnect the existing Google account first
      // This ensures we get a new refresh token when reconnecting
      const disconnectResponse = await fetch(`/api/auth/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "google" }),
      });

      if (!disconnectResponse.ok) {
        const data = await disconnectResponse.json();
        throw new Error(data.error || "Failed to disconnect existing account");
      }

      toast({
        title: "Redirecting...",
        description: "Taking you to Google to reconnect your account",
      });

      // Use NextAuth signIn to redirect to Google OAuth
      // The auth config already includes prompt=consent and access_type=offline
      // This will throw a redirect error which is expected
      await signIn("google", { callbackUrl: "/settings/sync-configs", redirect: true });
    } catch (error) {
      // The signIn function with redirect: true will throw an error when redirecting
      // This is expected behavior, so we don't show an error toast
      // Redirect error from signIn() is expected; no-op
    } finally {
      // Reset loading state in case redirect fails
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="default"
      size="sm"
      onClick={handleReconnect}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Reconnecting...
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reconnect Google
        </>
      )}
    </Button>
  );
}
