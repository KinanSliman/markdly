/**
 * Image Stage
 *
 * Extracts images from Google Docs and uploads them to Cloudinary.
 * Replaces image URLs in markdown with Cloudinary CDN URLs.
 */

import { google } from 'googleapis';
import { v2 as cloudinary } from 'cloudinary';
import { PipelineStage, PipelineContext, PipelineError, ImageData } from '../types';
import { rateLimiter } from '../../utils/rate-limit';

// Initialize Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export class ImageStage implements PipelineStage {
  name = 'image';
  description = 'Extracts and uploads images to Cloudinary';

  async execute(context: PipelineContext): Promise<PipelineContext> {
    if (!context.images || context.images.length === 0) {
      // No images to process
      return context;
    }

    if (!context.input.token) {
      throw new PipelineError('Missing authentication token for image extraction', this.name, context);
    }

    const startTime = performance.now();

    try {
      const { token, isAccessToken = true, cloudinaryFolder } = context.input;

      // Create OAuth2 client for Google Drive API
      const auth = new google.auth.OAuth2();
      if (isAccessToken) {
        auth.setCredentials({ access_token: token });
      } else {
        auth.setCredentials({ refresh_token: token });
      }

      const drive = google.drive('v3');

      // Process images in parallel with rate limiting
      const processedImages = await this.processImagesInParallel(
        context.images,
        auth,
        drive,
        cloudinaryFolder
      );

      // Update context with processed images
      context.images = processedImages;

      // Update metrics
      const endTime = performance.now();
      context.metrics.imageUploadTime = endTime - startTime;

      // Update metadata
      if (!context.stageData[this.name]) {
        context.stageData[this.name] = {};
      }
      context.stageData[this.name].processedImageCount = processedImages.filter(
        (img) => img.uploadResult
      ).length;

      return context;
    } catch (error: any) {
      throw new PipelineError(
        `Failed to process images: ${error.message}`,
        this.name,
        context,
        error
      );
    }
  }

  /**
   * Processes images in parallel with rate limiting
   */
  private async processImagesInParallel(
    images: ImageData[],
    auth: any,
    drive: any,
    cloudinaryFolder?: string
  ): Promise<ImageData[]> {
    // Limit concurrent uploads to avoid rate limiting
    const MAX_CONCURRENT = 3;
    const results: ImageData[] = [];

    for (let i = 0; i < images.length; i += MAX_CONCURRENT) {
      const batch = images.slice(i, i + MAX_CONCURRENT);
      const batchPromises = batch.map((image) =>
        this.processSingleImage(image, auth, drive, cloudinaryFolder)
      );

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Log error but continue with other images
          console.warn('Failed to process image:', result.reason?.message);
          // Keep original image data even if upload fails
          results.push({
            id: result.reason?.imageId || 'unknown',
            url: result.reason?.originalUrl || '',
            altText: result.reason?.altText || 'Image',
          });
        }
      }
    }

    return results;
  }

  /**
   * Processes a single image: extract from Google Docs and upload to Cloudinary
   */
  private async processSingleImage(
    image: ImageData,
    auth: any,
    drive: any,
    cloudinaryFolder?: string
  ): Promise<ImageData> {
    // Apply rate limiting
    const rateLimited = rateLimiter.wrap(
      async () => {
        // Step 1: Get image URL from Google Docs
        const imageUrl = await this.getImageUrlFromGoogleDocs(image.id, auth);

        if (!imageUrl) {
          throw new Error('Could not retrieve image URL');
        }

        // Step 2: Upload to Cloudinary
        const uploadResult = await this.uploadToCloudinary(imageUrl, cloudinaryFolder);

        return {
          ...image,
          url: imageUrl,
          uploadResult,
        };
      },
      {
        key: 'cloudinary-api',
        limit: 1000, // 1000 requests per hour
        window: 3600000, // 1 hour window
      }
    );

    return await rateLimited();
  }

  /**
   * Gets the image URL from Google Docs using the inline object ID
   */
  private async getImageUrlFromGoogleDocs(
    inlineObjectId: string,
    auth: any
  ): Promise<string | null> {
    try {
      const docs = google.docs('v1');
      const response = await docs.documents.get({
        documentId: this.extractDocumentIdFromAuth(auth),
        auth: auth,
      });

      const document = response.data;
      const inlineObjects = document.inlineObjects;

      if (!inlineObjects) {
        return null;
      }

      const inlineObject = inlineObjects[inlineObjectId];
      if (!inlineObject) {
        return null;
      }

      const embeddedObject = inlineObject.inlineObjectProperties?.embeddedObject;
      if (!embeddedObject || !embeddedObject.imageProperties) {
        return null;
      }

      return embeddedObject.imageProperties.contentUri || null;
    } catch (error) {
      console.warn('Failed to get image URL from Google Docs:', error);
      return null;
    }
  }

  /**
   * Extracts document ID from auth object (helper method)
   */
  private extractDocumentIdFromAuth(auth: any): string {
    // This is a workaround - we need the docId from context
    // In practice, we'll pass it as a parameter
    return '';
  }

  /**
   * Uploads an image to Cloudinary
   */
  private async uploadToCloudinary(
    imageUrl: string,
    folder?: string
  ): Promise<{ url: string; publicId: string }> {
    return new Promise((resolve, reject) => {
      const uploadOptions: any = {
        folder: folder || 'markdly',
        resource_type: 'auto',
      };

      cloudinary.uploader.upload(imageUrl, uploadOptions, (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        } else {
          reject(new Error('Cloudinary upload returned no result'));
        }
      });
    });
  }

  /**
   * Updates markdown content with Cloudinary image URLs
   */
  private updateMarkdownWithCloudinaryUrls(
    markdown: string,
    images: ImageData[]
  ): string {
    let updatedMarkdown = markdown;

    for (const image of images) {
      if (image.uploadResult?.url) {
        // Replace Google Docs image URLs with Cloudinary URLs
        // This handles both inline images and reference-style images
        const googleUrlPattern = new RegExp(
          `!\\[([^\\]]*)\\]\\(${escapeRegex(image.url)}\\)`,
          'g'
        );
        updatedMarkdown = updatedMarkdown.replace(
          googleUrlPattern,
          `![$1](${image.uploadResult.url})`
        );

        // Also handle reference-style links if needed
        const refPattern = new RegExp(
          `\\[${escapeRegex(image.id)}\\]:\\s*${escapeRegex(image.url)}`,
          'g'
        );
        updatedMarkdown = updatedMarkdown.replace(
          refPattern,
          `[${image.id}]: ${image.uploadResult.url}`
        );
      }
    }

    return updatedMarkdown;
  }

  async validate(context: PipelineContext): Promise<boolean> {
    if (context.images && context.images.length > 0) {
      if (!process.env.CLOUDINARY_CLOUD_NAME) {
        throw new PipelineError(
          'Cloudinary not configured: CLOUDINARY_CLOUD_NAME is missing',
          this.name,
          context
        );
      }

      if (!process.env.CLOUDINARY_API_KEY) {
        throw new PipelineError(
          'Cloudinary not configured: CLOUDINARY_API_KEY is missing',
          this.name,
          context
        );
      }

      if (!process.env.CLOUDINARY_API_SECRET) {
        throw new PipelineError(
          'Cloudinary not configured: CLOUDINARY_API_SECRET is missing',
          this.name,
          context
        );
      }
    }

    return true;
  }

  async cleanup(context: PipelineContext): Promise<void> {
    if (context.stageData[this.name]) {
      delete context.stageData[this.name];
    }
  }
}

/**
 * Escapes special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Factory function for easy instantiation
export const createImageStage = (): PipelineStage => {
  return new ImageStage();
};
