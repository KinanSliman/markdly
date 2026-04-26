"use client";

import { useEffect, useState } from "react";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import rehypeSlug from "rehype-slug";
import "highlight.js/styles/github-dark.css";

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

export function MarkdownPreview({ content, className = "" }: MarkdownPreviewProps) {
  const [html, setHtml] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!content) return;

    setIsLoading(true);

    unified()
      .use(remarkParse)
      .use(remarkGfm) // Tables, strikethrough, task lists
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw) // Allow raw HTML
      .use(rehypeHighlight, {
        detect: true, // Auto-detect language
        ignoreMissing: true,
      }) // Syntax highlighting
      .use(rehypeSlug) // Add IDs to headings
      .use(rehypeStringify)
      .process(content)
      .then((file) => {
        setHtml(String(file));
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Markdown rendering error:", err);
        setIsLoading(false);
      });
  }, [content]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Rendering preview...</div>
      </div>
    );
  }

  return (
    <div
      className={`prose prose-sm sm:prose-base prose-slate dark:prose-invert max-w-none text-left break-words [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_code]:break-words [&_table]:block [&_table]:overflow-x-auto [&_table]:max-w-full [&_img]:max-w-full [&_img]:h-auto [&_a]:break-all ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
