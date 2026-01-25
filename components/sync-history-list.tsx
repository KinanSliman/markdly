"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitCommit, FileText, Clock } from "lucide-react";
import { DeleteSyncButton } from "@/components/forms/delete-sync-button";

interface SyncHistoryEntry {
  id: string;
  docTitle?: string | null;
  status?: string | null;
  commitSha?: string | null;
  filesChanged?: string | null;
  errorMessage?: string | null;
  startedAt?: Date | null;
}

interface SyncHistoryListProps {
  initialHistory: SyncHistoryEntry[];
}

export function SyncHistoryList({ initialHistory }: SyncHistoryListProps) {
  const [history, setHistory] = useState<SyncHistoryEntry[]>(initialHistory);

  const handleDelete = (syncId: string) => {
    setHistory((prev) => prev.filter((entry) => entry.id !== syncId));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500">Success</Badge>;
      case "failed":
        return <Badge className="bg-red-500">Failed</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500">Pending</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Syncs Yet</CardTitle>
          <CardDescription>
            Start syncing documents to see history here
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Once you sync your first document, you'll see a detailed history of all sync operations here.
            This includes success/failure status, files changed, commit SHAs, and timestamps.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((entry) => (
        <Card key={entry.id}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{entry.docTitle || "Untitled"}</span>
                  {getStatusBadge(entry.status || "pending")}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {entry.startedAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(entry.startedAt).toLocaleString()}
                    </span>
                  )}
                  {entry.commitSha && (
                    <span className="flex items-center gap-1">
                      <GitCommit className="h-3 w-3" />
                      {entry.commitSha.slice(0, 7)}
                    </span>
                  )}
                  {entry.filesChanged && (
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {entry.filesChanged} file(s)
                    </span>
                  )}
                </div>
                {entry.errorMessage && (
                  <p className="text-sm text-red-500 mt-2">
                    Error: {entry.errorMessage}
                  </p>
                )}
              </div>
              <div className="ml-4">
                <DeleteSyncButton
                  syncId={entry.id}
                  docTitle={entry.docTitle || undefined}
                  onDelete={() => handleDelete(entry.id)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
