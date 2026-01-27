"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BookOpen, ArrowRight, Download, Loader2, Copy, CheckCircle, Lock } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface ConversionResult {
  title: string;
  content: string;
  images: number;
  tables: number;
  headings: number;
}

export default function ConverterPage() {
  const [docUrl, setDocUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      toast.success("Copied to clipboard!");
    }
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
          Convert your Google Docs to clean Markdown instantly — no sign-in required.
          See the conversion in action with our split-screen preview.
        </p>

        {/* Input Section */}
        <Card className="max-w-2xl mx-auto mb-8">
          <CardHeader>
            <CardTitle>Enter Google Doc URL</CardTitle>
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

        {/* Split Screen Preview */}
        {result && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">{result.title}</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Markdown
                </Button>
                <Button size="sm" disabled>
                  <Lock className="mr-2 h-4 w-4" />
                  Sign In to Download
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

            {/* Split Screen */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left: Original Google Doc (simulated) */}
              <Card className="bg-gradient-to-b from-muted/50 to-background">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Google Doc (Original)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-white rounded-lg p-4 shadow-sm border text-left">
                    <div className="text-sm text-gray-500 mb-2">Preview not available - Google Doc requires authentication</div>
                    <div className="text-sm text-gray-400">
                      The original document is protected by Google OAuth.
                      Sign in to access the full document preview.
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Right: Converted Markdown */}
              <Card className="bg-gradient-to-b from-muted/50 to-background">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
                    </svg>
                    Converted Markdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-900 rounded-lg p-4 text-left overflow-auto max-h-96">
                    <pre className="text-sm text-gray-100 whitespace-pre-wrap font-mono">
                      {result.content.length > 2000
                        ? result.content.substring(0, 2000) + "\n\n... (truncated - sign in to see full content)"
                        : result.content}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sign In Prompt */}
            <Card className="max-w-2xl mx-auto mt-6 bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
              <CardContent className="p-6 text-center">
                <h3 className="text-xl font-bold mb-2">Ready to download and sync?</h3>
                <p className="text-muted-foreground mb-4">
                  Sign in to download your converted Markdown file or sync it directly to GitHub.
                </p>
                <Button size="lg" asChild>
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
          <p>© 2025 Markdly. The fastest way to convert Google Docs to Markdown.</p>
        </div>
      </footer>
    </div>
  );
}
