"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitCommit, FileText, Clock, Download, Eye, Copy, Check } from "lucide-react";
import { DeleteSyncButton } from "@/components/forms/delete-sync-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface SyncHistoryEntry {
  id: string;
  docTitle?: string | null;
  status?: string | null;
  commitSha?: string | null;
  filesChanged?: string | null;
  errorMessage?: string | null;
  startedAt?: Date | null;
  filePath?: string | null;
}

interface PreviewContent {
  content: string;
  isTruncated: boolean;
  fullLength: number;
  fileName: string;
}

interface SyncHistoryListProps {
  initialHistory: SyncHistoryEntry[];
}

export function SyncHistoryList({ initialHistory }: SyncHistoryListProps) {
  const [history, setHistory] = useState<SyncHistoryEntry[]>(initialHistory);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<PreviewContent | null>(null);
  const [previewOpenSyncId, setPreviewOpenSyncId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleDelete = (syncId: string) => {
    setHistory((prev) => prev.filter((entry) => entry.id !== syncId));
  };

  const handleDownload = async (syncId: string, fileName?: string | null) => {
    setDownloading(syncId);
    try {
      const response = await fetch(`/api/download?syncId=${syncId}`);

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || "download.md";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
    } finally {
      setDownloading(null);
    }
  };

  const handlePreview = async (syncId: string) => {
    setPreviewLoading(syncId);
    setPreviewContent(null);
    try {
      const response = await fetch(`/api/preview?syncId=${syncId}`);

      if (!response.ok) {
        throw new Error("Preview failed");
      }

      const data = await response.json();
      setPreviewContent(data);
      setPreviewOpenSyncId(syncId);
    } catch (error) {
      console.error("Preview error:", error);
    } finally {
      setPreviewLoading(null);
    }
  };

  const handlePreviewOpenChange = (open: boolean) => {
    if (!open) {
      setPreviewOpenSyncId(null);
      setPreviewContent(null);
    }
  };

  const handleCopyContent = () => {
    if (previewContent?.content) {
      navigator.clipboard.writeText(previewContent.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
              <div className="ml-4 flex gap-2">
                {entry.status === "success" && entry.filePath && (
                  <>
                    <Dialog open={previewOpenSyncId === entry.id} onOpenChange={handlePreviewOpenChange}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePreview(entry.id)}
                          disabled={previewLoading === entry.id}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          {previewLoading === entry.id ? "Loading..." : "Preview"}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-5xl max-h-[85vh] p-0 gap-0">
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                          <div>
                            <DialogTitle className="text-lg font-semibold">
                              {previewContent?.fileName || "Document Preview"}
                            </DialogTitle>
                            <DialogDescription className="mt-1">
                              {previewContent ? (
                                <span className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">
                                    {previewContent.fullLength.toLocaleString()} chars
                                  </span>
                                  {previewContent.isTruncated && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                      Truncated
                                    </span>
                                  )}
                                </span>
                              ) : (
                                "Loading preview..."
                              )}
                            </DialogDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCopyContent}
                              disabled={!previewContent?.content}
                              className="h-9"
                            >
                              {copied ? (
                                <>
                                  <Check className="h-4 w-4 mr-2 text-green-600" />
                                  <span className="text-green-600">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Copy
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                        <div className="p-0">
                          <div className="h-[55vh] overflow-auto bg-slate-50 dark:bg-slate-950/50 border-b">
                            <pre className="p-6 text-sm font-mono leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
                              {previewContent?.content || "Loading..."}
                            </pre>
                          </div>
                          {previewContent?.isTruncated && (
                            <div className="px-6 py-3 bg-amber-50 dark:bg-amber-900/20 border-t">
                              <p className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Content truncated to first 2,000 characters. Download the full file to see complete content.
                              </p>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(entry.id, entry.docTitle)}
                      disabled={downloading === entry.id}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {downloading === entry.id ? "Downloading..." : "Download"}
                    </Button>
                  </>
                )}
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
