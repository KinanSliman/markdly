import { NextRequest, NextResponse } from 'next/server';
import { convertDocxToMarkdown } from '@/lib/markdown/unified-converter';
import { validateDocxFile } from '@/lib/utils/validation';
import { InvalidFileError } from '@/lib/utils/errors';
import { checkRequestRate, getClientIdentifier } from '@/lib/utils/rate-limit';
import { auth } from '@/lib/auth';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limit per client. Authenticated users get a higher quota,
    //    anonymous users (the public converter) get a much tighter one.
    const session = await auth();
    const identity = session?.user?.id
      ? `user:${session.user.id}`
      : `ip:${getClientIdentifier(request)}`;

    const limit = session?.user?.id
      ? { limit: 60, windowMs: 60_000 }   // 60/min for signed-in users
      : { limit: 10, windowMs: 60_000 };  // 10/min for anonymous

    const rl = checkRequestRate(`convert-file:${identity}`, limit);
    if (!rl.success) {
      return NextResponse.json(
        {
          error: `Too many requests. Try again in ${rl.retryAfterSeconds}s.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rl.retryAfterSeconds),
            'X-RateLimit-Reset': String(rl.resetAt),
          },
        }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const url = formData.get('url') as string | null;
    const isDemo = formData.get('isDemo') === 'true';

    // Validate input
    if (!file && !url) {
      return NextResponse.json(
        { error: 'Either a file or a URL must be provided' },
        { status: 400 }
      );
    }

    // Server-side file size guard (in addition to next.config.ts bodySizeLimit)
    if (file && file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        {
          error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.`,
        },
        { status: 413 }
      );
    }

    let fileName: string | undefined;
    let fileContent: Buffer | string;

    if (file) {
      // Validate file type
      try {
        validateDocxFile(file);
      } catch (error) {
        if (error instanceof InvalidFileError) {
          return NextResponse.json(
            { error: error.message },
            { status: 400 }
          );
        }
        throw error;
      }

      fileName = file.name;
      const arrayBuffer = await file.arrayBuffer();
      fileContent = Buffer.from(arrayBuffer);
    } else if (url) {
      // Fetch .docx file from URL
      try {
        // SSRF protection: only http/https, no internal addresses
        let parsed: URL;
        try {
          parsed = new URL(url);
        } catch {
          return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return NextResponse.json(
            { error: 'Only http(s) URLs are supported' },
            { status: 400 }
          );
        }
        if (
          /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|::1)/i.test(
            parsed.hostname
          )
        ) {
          return NextResponse.json(
            { error: 'URL points to an internal address' },
            { status: 400 }
          );
        }

        // 10s timeout to avoid hanging connections eating the lambda
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);

        const response = await fetch(url, { signal: controller.signal }).finally(
          () => clearTimeout(timeout)
        );
        if (!response.ok) {
          return NextResponse.json(
            { error: `Failed to fetch file from URL: ${response.statusText}` },
            { status: 400 }
          );
        }

        // Reject early if content-length advertises an oversized file
        const contentLength = Number(response.headers.get('content-length') || 0);
        if (contentLength && contentLength > MAX_FILE_BYTES) {
          return NextResponse.json(
            { error: 'Remote file exceeds 10MB limit' },
            { status: 413 }
          );
        }

        // Check content type
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
          return NextResponse.json(
            { error: 'URL does not point to a valid .docx file' },
            { status: 400 }
          );
        }

        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_FILE_BYTES) {
          return NextResponse.json(
            { error: 'Remote file exceeds 10MB limit' },
            { status: 413 }
          );
        }
        fileContent = Buffer.from(arrayBuffer);
        fileName = url.split('/').pop() || 'document.docx';
      } catch (error) {
        return NextResponse.json(
          { error: `Failed to fetch file from URL: ${error}` },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'No file or URL provided' },
        { status: 400 }
      );
    }

    // Convert the file
    const result = await convertDocxToMarkdown(
      fileContent,
      fileName,
      undefined, // No Cloudinary folder for demo/preview
      isDemo
    );

    return NextResponse.json({
      success: true,
      title: result.title,
      content: result.content,
      warnings: result.warnings,
      metrics: result.metrics,
      cached: result.cached || false,
    });
  } catch (error: any) {
    console.error('File conversion error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to convert file' },
      { status: 500 }
    );
  }
}
