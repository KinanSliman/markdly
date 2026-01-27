import { NextRequest, NextResponse } from "next/server";
import { convertGoogleDocToMarkdown } from "@/lib/markdown/converter";

/**
 * POST /api/convert-demo
 * Converts a Google Doc to Markdown without authentication (demo mode)
 * This is a public endpoint for trying Markdly without signing in
 *
 * Body: { docId: string }
 *
 * Note: This requires the Google Doc to be publicly accessible or shared with
 * the Google OAuth client. For private docs, users need to sign in.
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { docId } = body;

    if (!docId) {
      return NextResponse.json(
        { error: "docId is required" },
        { status: 400 }
      );
    }

    // For demo mode, we need a Google access token
    // Since this is a public endpoint without user authentication,
    // we can't access private Google Docs
    //
    // Option 1: Use a service account (requires Google Workspace)
    // Option 2: Require the doc to be publicly shared
    // Option 3: Return a sample/demo conversion for testing
    //
    // For now, we'll attempt conversion with the assumption that
    // the doc might be publicly accessible or we have a demo token
    // In production, this would require proper authentication

    // Check if we have a demo Google access token configured
    // This would be for publicly accessible docs only
    const demoAccessToken = process.env.GOOGLE_DEMO_ACCESS_TOKEN;

    if (!demoAccessToken) {
      return NextResponse.json(
        {
          error: "Demo conversion requires Google OAuth. Please sign in to convert private documents.",
          details: "This endpoint is designed for publicly shared Google Docs. Sign in for full access to your private documents."
        },
        { status: 401 }
      );
    }

    // Attempt to convert the document
    const result = await convertGoogleDocToMarkdown(
      docId,
      demoAccessToken,
      true, // isAccessToken
      undefined // Don't upload images to Cloudinary in demo mode
    );

    return NextResponse.json({
      success: true,
      title: result.title,
      content: result.content,
      images: result.images,
      headings: result.headings,
      tables: result.tables,
    });

  } catch (error: any) {
    console.error("Demo conversion error:", error);

    // Check if it's an authentication error
    if (error.message?.includes("401") || error.message?.includes("403")) {
      return NextResponse.json(
        {
          error: "Authentication required",
          details: "This Google Doc requires authentication. Please sign in to access private documents."
        },
        { status: 401 }
      );
    }

    // Check if document not found
    if (error.message?.includes("404")) {
      return NextResponse.json(
        {
          error: "Document not found",
          details: "Please check the Google Doc URL or ID and try again."
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: "Conversion failed",
        details: error.message || "An unexpected error occurred"
      },
      { status: 500 }
    );
  }
}
