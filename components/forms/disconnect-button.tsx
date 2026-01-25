"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import { LogOut, Loader2 } from "lucide-react";

interface DisconnectButtonProps {
  provider: "github" | "google";
  label?: string;
}

export function DisconnectButton({ provider, label = "Disconnect" }: DisconnectButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleDisconnect = async () => {
    if (!confirm(`Are you sure you want to disconnect your ${provider} account?`)) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/auth/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to disconnect");
      }

      toast({
        title: "Disconnected",
        description: `Your ${provider} account has been disconnected.`,
      });

      // Refresh the page to update the UI
      window.location.reload();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to disconnect",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleDisconnect}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Disconnecting...
        </>
      ) : (
        <>
          <LogOut className="h-4 w-4 mr-2" />
          {label}
        </>
      )}
    </Button>
  );
}
