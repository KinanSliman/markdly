"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

export function SyncButton() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    setIsLoading(true);

    try {
      // This would trigger the actual sync workflow
      // For now, show a demo toast
      toast({
        title: "Sync started",
        description: "Your document is being synced to GitHub.",
      });

      // Simulate sync delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast({
        title: "Sync completed!",
        description: "Your document has been synced successfully.",
      });
    } catch (error) {
      toast({
        title: "Sync failed",
        description: "An error occurred while syncing.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={handleSync} disabled={isLoading} className="w-full">
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Syncing...
        </>
      ) : (
        <>
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync Document
        </>
      )}
    </Button>
  );
}
