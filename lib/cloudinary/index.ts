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
 */
export async function uploadImageToCloudinary(
  imageUrl: string,
  options: {
    folder?: string;
    transformation?: any[];
  } = {}
): Promise<UploadResult> {
  try {
    const result = await cloudinary.uploader.upload(imageUrl, {
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
 * Generates responsive image URLs for srcset
 */
export function generateResponsiveUrls(
  publicId: string,
  widths: number[] = [320, 640, 768, 1024, 1280, 1920]
): string[] {
  return widths.map((width) => {
    return cloudinary.url(publicId, {
      width,
      crop: "scale",
      quality: "auto:good",
      fetch_format: "auto",
    });
  });
}

/**
 * Generates srcset attribute for responsive images
 */
export function generateSrcset(publicId: string): string {
  const urls = generateResponsiveUrls(publicId);
  return urls.map((url, index) => {
    const width = [320, 640, 768, 1024, 1280, 1920][index];
    return `${url} ${width}w`;
  }).join(", ");
}

/**
 * Generates sizes attribute for responsive images
 */
export function generateSizes(): string {
  return "(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw";
}

/**
 * Processes markdown content and replaces image URLs with Cloudinary URLs
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

      // Replace the original URL with Cloudinary URL
      // Handle both absolute URLs and relative paths
      const escapedUrl = imageUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escapedUrl, "g");

      // Use the responsive image HTML format
      const responsiveImg = `<img src="${result.secureUrl}" srcset="${generateSrcset(result.publicId)}" sizes="${generateSizes()}" alt="" loading="lazy" />`;

      processedContent = processedContent.replace(regex, responsiveImg);
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
  const imageRegex = /!\[.*?\]\((.*?)\)/g;
  const urls: string[] = [];
  let match;

  while ((match = imageRegex.exec(content)) !== null) {
    urls.push(match[1]);
  }

  return urls;
}

/**
 * Generates optimized image tags with lazy loading
 */
export function generateOptimizedImageTag(
  url: string,
  alt: string = "",
  className: string = ""
): string {
  const loadingAttr = "loading=\"lazy\"";
  const classAttr = className ? `class="${className}"` : "";

  return `<img src="${url}" alt="${alt}" ${loadingAttr} ${classAttr} />`;
}
