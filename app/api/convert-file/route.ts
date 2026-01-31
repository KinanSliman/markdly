import { NextRequest, NextResponse } from 'next/server';
import { convertDocxToMarkdown } from '@/lib/markdown/unified-converter';
import { validateDocxFile } from '@/lib/utils/validation';
import { InvalidFileError } from '@/lib/utils/errors';

export async function POST(request: NextRequest) {
  try {
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
        const response = await fetch(url);
        if (!response.ok) {
          return NextResponse.json(
            { error: `Failed to fetch file from URL: ${response.statusText}` },
            { status: 400 }
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
