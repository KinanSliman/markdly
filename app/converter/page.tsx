"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BookOpen, ArrowRight, Download, Loader2, Copy, CheckCircle, Lock, Upload, FileText, Check } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { MarkdownPreview } from "@/components/markdown-preview";

interface ConversionResult {
  title: string;
  content: string;
  images: number;
  tables: number;
  headings: number;
  sourceType: "google-doc" | "file-upload";
  originalContent?: string;
}

export default function ConverterPage() {
  const [docUrl, setDocUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewMode, setViewMode] = useState<"markdown" | "preview">("markdown");
  const [copied, setCopied] = useState(false);

  // Extract Google Doc ID from URL
  const extractDocId = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      const match = urlObj.pathname.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
      return match ? match[1] : null;
    } catch {
      // Try as plain doc ID
      return /^[a-zA-Z0-9-_]+$/.test(url) ? url : null;
    }
  };

  const handleConvert = async () => {
    setError(null);
    setResult(null);

    const docId = extractDocId(docUrl);
    if (!docId) {
      setError("Please enter a valid Google Doc URL or ID");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/convert-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Conversion failed");
      }

      setResult({
        title: data.title,
        content: data.content,
        images: data.images?.length || 0,
        tables: data.tables?.length || 0,
        headings: data.headings?.length || 0,
        sourceType: data.sourceType || "google-doc",
        originalContent: data.originalContent,
      });

      toast.success("Conversion successful!");
    } catch (err: any) {
      setError(err.message);
      toast.error("Conversion failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type
      const validTypes = [
        "text/html",
        "application/rtf",
        "text/plain",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];

      if (!validTypes.includes(file.type) && !file.name.match(/\.(html|htm|rtf|txt|docx)$/i)) {
        setError("Please select a valid file (HTML, RTF, TXT, or DOCX)");
        toast.error("Invalid file type");
        return;
      }

      // Warn about legacy .doc files
      if (file.name.toLowerCase().endsWith(".doc") && !file.name.toLowerCase().endsWith(".docx")) {
        setError("Legacy .doc format not supported. Please save as .docx.");
        toast.error("Legacy .doc format not supported");
        return;
      }

      setSelectedFile(file);
      setError(null);
      toast.success(`Selected: ${file.name}`);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file first");
      return;
    }

    setError(null);
    setResult(null);
    setIsLoading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("/api/convert-demo", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Conversion failed");
      }

      setResult({
        title: data.title || selectedFile.name,
        content: data.content,
        images: data.images?.length || 0,
        tables: data.tables?.length || 0,
        headings: data.headings?.length || 0,
        sourceType: data.sourceType || "file-upload",
        originalContent: data.originalContent,
      });

      toast.success("Conversion successful!");
    } catch (err: any) {
      setError(err.message);
      toast.error("Conversion failed");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (result?.content) {
      navigator.clipboard.writeText(result.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Copied to clipboard!");
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const downloadMarkdown = () => {
    if (!result?.content) return;

    const blob = new Blob([result.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.title.replace(/\s+/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Download started!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Navigation */}
      <nav className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Markdly</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/auth/signin">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 py-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          Try Markdly Converter
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Convert your documents to clean Markdown instantly.
          <br className="hidden md:block" />
          Upload files for free, or sign in for Google Docs.
        </p>

        {/* Input Section */}
        <Card className="max-w-2xl mx-auto mb-8">
          <CardHeader>
            <CardTitle>Convert from Google Doc URL</CardTitle>
            <CardDescription>
              Requires Google OAuth sign-in. For public file uploads, see below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="https://docs.google.com/document/d/YOUR_DOC_ID/edit"
                value={docUrl}
                onChange={(e) => setDocUrl(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleConvert}
                disabled={isLoading || !docUrl}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    Convert
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* File Upload Section */}
        <Card className="max-w-2xl mx-auto mb-8">
          <CardHeader>
            <CardTitle>Or Upload a File from Your Device</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".html,.htm,.rtf,.txt,.docx"
              className="hidden"
            />

            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                 onClick={triggerFileInput}>
              {selectedFile ? (
                <div className="flex items-center justify-center gap-3 text-primary">
                  <FileText className="h-8 w-8" />
                  <span className="font-medium">{selectedFile.name}</span>
                  <span className="text-sm text-muted-foreground">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="h-8 w-8" />
                  <span className="font-medium">Click to select a file</span>
                  <span className="text-sm">Supports HTML, RTF, TXT, DOCX</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleFileUpload}
                disabled={isLoading || !selectedFile}
                className="flex-1"
                variant="secondary"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    Convert File
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
              {selectedFile && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Split Screen Preview */}
        {result && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">{result.title}</h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyToClipboard}
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-green-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
                <Button size="sm" onClick={downloadMarkdown} className="gap-2">
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-4 mb-4 justify-center">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                {result.headings} headings
              </span>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2"/>
                  <line x1="3" y1="9" x2="21" y2="9" strokeWidth="2"/>
                  <line x1="9" y1="3" x2="9" y2="21" strokeWidth="2"/>
                </svg>
                {result.tables} tables
              </span>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2"/>
                </svg>
                {result.images} images
              </span>
            </div>

            {/* Split Screen - VS Code Style */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left: Original Document */}
              <Card className="bg-gradient-to-b from-muted/50 to-background overflow-hidden">
                <CardHeader className="pb-2 bg-slate-900 text-slate-100 px-4 py-2">
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <span className="font-medium">
                      {result.sourceType === "file-upload" ? "Original File" : "Original Document"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {result.sourceType === "file-upload" && result.originalContent ? (
                    <div className="bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm text-left">
                      <div className="flex items-center gap-2 px-4 py-2 bg-[#252526] border-b border-[#3c3c3c]">
                        <div className="flex gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        </div>
                        <span className="text-xs text-slate-400 ml-2">Text Preview</span>
                      </div>
                      <pre className="p-4 overflow-auto max-h-[500px] whitespace-pre-wrap break-words text-left leading-tight">
                        {result.originalContent}
                      </pre>
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg p-4 shadow-sm border text-left">
                      <div className="text-sm text-gray-500 mb-2">Preview not available</div>
                      <div className="text-sm text-gray-400">
                        The original document content is protected or not accessible in demo mode.
                        Sign in to access full document preview.
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Right: Converted Markdown - VS Code Style */}
              <Card className="bg-gradient-to-b from-muted/50 to-background overflow-hidden">
                <CardHeader className="pb-2 bg-slate-900 text-slate-100 px-4 py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
                      </svg>
                      <span className="font-medium">converted.md</span>
                      <span className="text-xs text-slate-400">• {result.content.length} chars</span>
                    </div>

                    {/* VS Code-style Tabs */}
                    <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
                      <Button
                        size="sm"
                        variant={viewMode === "markdown" ? "secondary" : "ghost"}
                        onClick={() => setViewMode("markdown")}
                        className="h-7 px-3 text-xs"
                      >
                        Code
                      </Button>
                      <Button
                        size="sm"
                        variant={viewMode === "preview" ? "secondary" : "ghost"}
                        onClick={() => setViewMode("preview")}
                        className="h-7 px-3 text-xs"
                      >
                        Preview
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {viewMode === "markdown" ? (
                    // VS Code-style code editor
                    <div className="bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm text-left">
                      <div className="flex items-center gap-2 px-4 py-2 bg-[#252526] border-b border-[#3c3c3c]">
                        <div className="flex gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        </div>
                        <span className="text-xs text-slate-400 ml-2">Markdown</span>
                      </div>
                      <pre className="p-4 overflow-auto max-h-[500px] whitespace-pre-wrap break-words text-left leading-tight">
                        {result.content}
                      </pre>
                    </div>
                  ) : (
                    // Preview mode with syntax highlighting
                    <div className="bg-white dark:bg-slate-950 p-6 overflow-auto max-h-[500px] text-left">
                      <MarkdownPreview content={result.content} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sign In Prompt */}
            <Card className="max-w-2xl mx-auto mt-6 bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
              <CardContent className="p-6 text-center space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <Button size="lg" onClick={downloadMarkdown} className="gap-2">
                    <Download className="h-5 w-5" />
                    Download Markdown
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  Or sign in to sync directly to GitHub
                </div>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/auth/signin">
                    Sign In Now
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 Markdly. The fastest way to convert documents to Markdown.</p>
        </div>
      </footer>
    </div>
  );
}
