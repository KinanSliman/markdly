"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-toast";
import { useState } from "react";
import { Loader2, RefreshCw, ExternalLink, Download } from "lucide-react";

interface SyncButtonProps {
  docId: string;
  docName: string;
  mode?: "github" | "convert-only";
}

export function SyncButton({ docId, docName, mode = "github" }: SyncButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    setIsLoading(true);

    try {
      // Trigger the actual sync workflow
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Sync failed");
      }

      toast({
        title: "Sync completed!",
        description: (
          <div>
            <p>{docName} synced successfully!</p>
            {data.data?.prUrl && (
              <a
                href={data.data.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline inline-flex items-center gap-1 mt-1"
              >
                View PR <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ),
      });
    } catch (error) {
      toast({
        title: "Sync failed",
        description: error instanceof Error ? error.message : "An error occurred while syncing.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConvertAndDownload = async () => {
    setIsLoading(true);

    try {
      // Trigger convert-only workflow
      const response = await fetch("/api/convert-and-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Conversion failed");
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${docName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Conversion complete!",
        description: `${docName} converted to Markdown and downloaded.`,
      });
    } catch (error) {
      toast({
        title: "Conversion failed",
        description: error instanceof Error ? error.message : "An error occurred while converting.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (mode === "convert-only") {
    return (
      <Button
        onClick={handleConvertAndDownload}
        disabled={isLoading}
        size="sm"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Converting...
          </>
        ) : (
          <>
            <Download className="h-4 w-4 mr-2" />
            Convert & Download
          </>
        )}
      </Button>
    );
  }

  return (
    <Button
      onClick={handleSync}
      disabled={isLoading}
      size="sm"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Syncing...
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4 mr-2" />
          Sync
        </>
      )}
    </Button>
  );
}
