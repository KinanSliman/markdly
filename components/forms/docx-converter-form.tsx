'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Loader2, AlertCircle, CheckCircle2, Copy, Download, Globe, FileUp } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MarkdownPreview } from '@/components/markdown-preview';
import { Label } from '@/components/ui/label';

interface ConversionResult {
  title: string;
  content: string;
  warnings: Array<{ type: string; message: string; suggestion: string }>;
  metrics?: { totalTime: number; stages: Record<string, number> };
  cached?: boolean;
}

interface DocxConverterFormProps {
  isDemo?: boolean;
  isAuthenticated?: boolean;
  onConvert?: (result: ConversionResult) => void;
}

export function DocxConverterForm({ isDemo = false, isAuthenticated = false, onConvert }: DocxConverterFormProps) {
  const [activeTab, setActiveTab] = useState<'url' | 'upload'>('url');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [originalContent, setOriginalContent] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.docx')) {
        setError('Please select a .docx file');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleConvert = async () => {
    setError(null);
    setResult(null);
    setOriginalContent(null);
    setIsConverting(true);

    try {
      const formData = new FormData();

      if (activeTab === 'upload' && file) {
        formData.append('file', file);

        // Extract raw text from .docx file for preview
        const arrayBuffer = await file.arrayBuffer();
        try {
          // Use mammoth to extract raw text
          const mammoth = await import('mammoth');
          const textResult = await mammoth.extractRawText({ arrayBuffer });
          const rawText = textResult.value
            .replace(/\n{4,}/g, '\n\n')
            .replace(/[ \t]+$/gm, '')
            .trim();
          setOriginalContent(rawText || '[No text content found]');
        } catch (mammothError) {
          console.error('Mammoth error:', mammothError);
          setOriginalContent('[Could not extract text from file]');
        }
      } else if (activeTab === 'url' && url) {
        formData.append('url', url);

        // Fetch and try to store original content from URL
        try {
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();
          const text = new TextDecoder().decode(arrayBuffer);
          setOriginalContent(text);
        } catch (decodeError) {
          // If decoding fails, it's likely a binary file
          setOriginalContent('[Binary file - content cannot be displayed as text]');
        }
      } else {
        setError('Please provide a file or URL');
        setIsConverting(false);
        return;
      }

      if (isDemo) {
        formData.append('isDemo', 'true');
      }

      const response = await fetch('/api/convert-file', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Conversion failed');
      }

      const conversionResult: ConversionResult = {
        title: data.title,
        content: data.content,
        warnings: data.warnings || [],
        metrics: data.metrics,
        cached: data.cached,
      };

      setResult(conversionResult);
      onConvert?.(conversionResult);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsConverting(false);
    }
  };

  const handleCopy = async () => {
    if (result?.content) {
      await navigator.clipboard.writeText(result.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (result?.content) {
      const blob = new Blob([result.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${result.title || 'document'}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const isValid = activeTab === 'url' ? url.trim() !== '' : file !== null;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <div className="space-y-6">
            {/* Input Method Selection */}
            <div className="space-y-3">
              <Label>Input Method</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={activeTab === 'url' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('url')}
                  disabled={isConverting}
                >
                  <Globe className="w-4 h-4 mr-2" />
                  URL
                </Button>
                <Button
                  variant={activeTab === 'upload' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('upload')}
                  disabled={isConverting}
                >
                  <FileUp className="w-4 h-4 mr-2" />
                  Upload
                </Button>
              </div>
            </div>

            {/* URL Input */}
            {activeTab === 'url' && (
              <div className="space-y-2">
                <Input
                  type="url"
                  placeholder="https://example.com/document.docx"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isConverting}
                />
                <p className="text-sm text-muted-foreground">
                  Enter a direct URL to a .docx file
                </p>
              </div>
            )}

            {/* File Upload */}
            {activeTab === 'upload' && (
              <div className="space-y-2">
                <Input
                  type="file"
                  accept=".docx"
                  onChange={handleFileChange}
                  disabled={isConverting}
                />
                <p className="text-sm text-muted-foreground">
                  Select a .docx file from your device
                </p>
                {file && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    {file.name}
                  </div>
                )}
              </div>
            )}

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="w-4 h-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleConvert}
              disabled={isConverting || !isValid}
              className="w-full"
            >
              {isConverting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  Convert to Markdown
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          {/* Download Button - Centered Above Split Screen */}
          <div className="flex flex-col items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={isConverting || !isAuthenticated}
              className="w-full max-w-xs"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Markdown
            </Button>
            {!isAuthenticated && (
              <p className="text-sm text-muted-foreground">
                <Link href="/auth/signin" className="text-primary hover:underline">
                  Sign in
                </Link>{" "}
                to download your converted file
              </p>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Conversion Result</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    disabled={isConverting}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </CardTitle>
              {result.cached && (
                <CardDescription className="text-green-600">
                  ⚡ Cached result (instant)
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {/* Split View - Full Width */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {/* Left Side - Original File */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Original File</h3>
                    <span className="text-xs text-muted-foreground">
                      {activeTab === 'upload' ? file?.name : 'URL'}
                    </span>
                  </div>
                  <div className="bg-muted p-3 rounded-lg overflow-auto max-h-[500px] text-sm font-mono">
                    {originalContent ? (
                      <pre>{originalContent}</pre>
                    ) : (
                      'Loading...'
                    )}
                  </div>
                </div>

                {/* Right Side - Converted Markdown */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Converted Markdown</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPreview(!showPreview)}
                    >
                      {showPreview ? 'Show Code' : 'Show Preview'}
                    </Button>
                  </div>
                  {showPreview ? (
                    <MarkdownPreview content={result.content} />
                  ) : (
                    <pre className="bg-muted p-3 rounded-lg overflow-auto max-h-[500px] text-sm font-mono">
                      {result.content}
                    </pre>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {result.warnings && result.warnings.length > 0 && (
            <Alert variant="warning">
              <AlertCircle className="w-4 h-4" />
              <AlertTitle>Conversion Warnings</AlertTitle>
              <AlertDescription asChild>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  {result.warnings.map((warning, index) => (
                    <li key={index}>
                      <strong>{warning.type}:</strong> {warning.message}
                      {warning.suggestion && (
                        <span className="text-muted-foreground block ml-4">
                          Suggestion: {warning.suggestion}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {result.metrics && (
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Time:</span>
                    <span className="font-mono ml-2">
                      {result.metrics.totalTime.toFixed(2)}ms
                    </span>
                  </div>
                  {Object.entries(result.metrics.stages).map(([stage, time]) => (
                    <div key={stage}>
                      <span className="text-muted-foreground capitalize">{stage}:</span>
                      <span className="font-mono ml-2">{time.toFixed(2)}ms</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
