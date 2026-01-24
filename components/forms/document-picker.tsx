"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/lib/hooks/use-toast";
import { FileText, Calendar, ExternalLink, Loader2 } from "lucide-react";

interface Document {
  id: string;
  name: string;
  modifiedTime?: string;
}

interface DocumentPickerProps {
  configId: string;
  onSyncComplete?: () => void;
}

export function DocumentPicker({ configId, onSyncComplete }: DocumentPickerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchDocuments();
  }, [configId]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`/api/documents?configId=${configId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch documents");
      }

      setDocuments(data.documents || []);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch documents",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (docId: string, docName: string) => {
    setSyncing(docId);

    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docId,
          configId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Sync failed");
      }

      toast({
        title: "Sync completed",
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
        variant: "default",
      });

      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (error) {
      toast({
        title: "Sync failed",
        description: error instanceof Error ? error.message : "Failed to sync document",
        variant: "destructive",
      });
    } finally {
      setSyncing(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>Loading your Google Docs...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>No documents found in the selected folder</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Make sure you have Google Docs in the selected folder and try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents</CardTitle>
        <CardDescription>
          Select a document to sync to GitHub
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{doc.name}</p>
                {doc.modifiedTime && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(doc.modifiedTime).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => handleSync(doc.id, doc.name)}
              disabled={syncing === doc.id}
            >
              {syncing === doc.id ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                "Sync"
              )}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
