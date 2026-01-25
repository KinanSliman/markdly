import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface UploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
}

/**
 * Uploads an image to Cloudinary
 * Accepts either a URL or base64 data
 */
export async function uploadImageToCloudinary(
  imageSource: string,
  options: {
    folder?: string;
    transformation?: any[];
  } = {}
): Promise<UploadResult> {
  try {
    const result = await cloudinary.uploader.upload(imageSource, {
      folder: options.folder || "markdly",
      transformation: options.transformation || [
        { quality: "auto:good" },
        { fetch_format: "auto" },
      ],
      resource_type: "auto",
    });

    return {
      url: result.url,
      secureUrl: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    };
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    throw new Error("Failed to upload image to Cloudinary");
  }
}

/**
 * Processes markdown content and replaces image URLs with Cloudinary URLs
 * Preserves Markdown image syntax: ![alt](url)
 */
export async function processImagesInMarkdown(
  content: string,
  imageUrls: string[],
  options: {
    folder?: string;
    transformation?: any[];
  } = {}
): Promise<string> {
  let processedContent = content;

  for (const imageUrl of imageUrls) {
    try {
      const result = await uploadImageToCloudinary(imageUrl, options);

      // Replace the original URL with Cloudinary URL in Markdown format
      // Pattern: ![alt text](url) -> ![alt text](cloudinaryUrl)
      const escapedUrl = imageUrl.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");

      // Match the full markdown image syntax including the alt text
      const markdownImageRegex = new RegExp(`!\\[(.*?)\\]\\(${escapedUrl}\\)`, "g");

      // Keep the original alt text, just replace the URL
      processedContent = processedContent.replace(markdownImageRegex, (match, altText) => {
        return `![${altText}](${result.secureUrl})`;
      });
    } catch (error) {
      console.error(`Failed to process image ${imageUrl}:`, error);
      // Keep original URL if upload fails
    }
  }

  return processedContent;
}

/**
 * Extracts image URLs from markdown content
 */
export function extractImageUrls(content: string): string[] {
  const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
  const urls: string[] = [];
  let match;

  while ((match = imageRegex.exec(content)) !== null) {
    urls.push(match[2]);
  }

  return urls;
}
