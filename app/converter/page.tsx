"use client";

import { DocxConverterForm } from "@/components/forms/docx-converter-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ConverterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Back Button */}
        <Button variant="ghost" asChild className="mb-6">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>

        {/* Header */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-3xl text-center">Convert .docx to Markdown</CardTitle>
            <CardDescription className="text-center">
              Upload a .docx file or enter a URL to convert to GitHub-ready Markdown
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Converter Form */}
        <DocxConverterForm isDemo={true} />
      </div>
    </div>
  );
}
