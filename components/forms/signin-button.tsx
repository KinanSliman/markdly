"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Github, Chrome } from "lucide-react";
import { useState } from "react";

interface SignInButtonProps {
  provider: "github" | "google";
  label: string;
  callbackUrl?: string;
}

const iconMap = {
  github: Github,
  google: Chrome,
};

export function SignInButton({ provider, label, callbackUrl = "/settings" }: SignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const Icon = iconMap[provider];

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn(provider, { callbackUrl });
    } catch (error) {
      console.error(`Error signing in with ${provider}:`, error);
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleSignIn}
      disabled={isLoading}
      variant="outline"
      className="w-full"
    >
      <Icon className="mr-2 h-4 w-4" />
      {isLoading ? "Connecting..." : label}
    </Button>
  );
}
