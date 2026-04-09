import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowRight,
  BookOpen,
  GitBranch,
  Image as ImageIcon,
  FileText,
  Zap,
} from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Navigation */}
      <nav className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Markdly</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/auth/signin">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/converter">Try Converter</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
          Turn .docx files into
          <span className="text-primary"> GitHub-ready Markdown</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Convert your Word documents to clean Markdown instantly. Images hosted
          on CDN, tables converted perfectly, ready for GitHub.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" asChild>
            <Link href="/converter">
              Try Converter Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <ImageIcon className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Image Handling Done Right</CardTitle>
              <CardDescription>
                Upload images to Cloudinary with auto-optimization. Generate
                production-ready CDN links with responsive images.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <BookOpen className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Robust Conversion</CardTitle>
              <CardDescription>
                .docx tables, code blocks, headings — all converted accurately
                to clean Markdown.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <GitBranch className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Git-Native Workflow</CardTitle>
              <CardDescription>
                Auto-create feature branches and pull requests for review. Clean
                commits with proper attribution.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Supported Formats */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-8">
          Supported Formats
        </h2>
        <div className="grid md:grid-cols-1 gap-6 max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-primary" />
                <CardTitle className="text-xl">DOCX (Word)</CardTitle>
              </div>
              <CardDescription>
                High-quality conversion using mammoth.js. Upload directly
                without sign-in. Preserves headings, tables, code blocks, and
                formatting.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            © 2025 Markdly. Built for developer relations teams and docs teams.
          </p>
        </div>
      </footer>
    </div>
  );
}
